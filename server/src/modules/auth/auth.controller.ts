import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Department } from '../departments/department.model.js';
import { recordAuditLog, logActivity } from '../audit/audit.service.js';
import { startSession, endSession, revokedMessage } from '../audit/session.service.js';
import { UserSession } from '../audit/session.model.js';
import { User } from '../users/user.model.js';
import { Role } from '../roles/role.model.js';
import { AppError } from '../../common/errors/appError.js';
import { sendSuccess } from '../../common/helpers/response.js';
import { env } from '../../config/env.js';
import {
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  hashPassword,
  verifyRefreshToken,
} from './auth.utils.js';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

/** Wrong passwords in a row before the account is locked, and for how long. */
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

const istTime = (d: Date) => d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' });

/** The password every imported staff account starts with; it can never be kept as a real password. */
export const COMMON_STAFF_PASSWORD = 'mapims@123';

const completeProfileSchema = z
  .object({
    departmentId: z.string().refine((v) => mongoose.Types.ObjectId.isValid(v), 'Select your department'),
    designation: z.string().trim().min(2, 'Enter your designation').max(100),
    whatsappNumber: z.string().trim().max(20).optional().or(z.literal('')),
    email: z.string().trim().email('Enter a valid email address').max(200).optional().or(z.literal('')),
    newPassword: z.string().min(8, 'Password must be at least 8 characters').max(100),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { message: 'The two passwords do not match', path: ['confirmPassword'] });

/** Digits only, with India's 91 added to a 10-digit mobile number. Empty when not given. */
export const normaliseWhatsapp = (raw?: string): string | undefined => {
  const digits = (raw ?? '').replace(/\D/g, '').replace(/^0+/, '');
  if (!digits) return undefined;
  const full = digits.length === 10 ? `91${digits}` : digits;
  if (full.length < 11 || full.length > 15) throw AppError.badRequest('Enter a valid WhatsApp number, e.g. 98401 12345');
  return full;
};

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password'),
  newPassword: z.string().min(8, 'The new password must be at least 8 characters').max(100),
});

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { username, password } = loginSchema.parse(req.body);

    // Sign in with username, employee ID or email (the sign-in page offers username or employee ID).
    // Looked up in that order so an employee ID that happens to equal someone's username can't
    // pick the wrong account.
    const loginId = username.trim();
    const user =
      (await User.findOne({ username: loginId.toLowerCase() }).populate('roles')) ??
      (await User.findOne({ employeeId: loginId }).populate('roles')) ??
      (await User.findOne({ employeeId: { $regex: `^${loginId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }).populate('roles')) ??
      (await User.findOne({ email: loginId.toLowerCase() }).populate('roles'));

    if (!user) {
      await logActivity('LOGIN_FAILED', `Failed sign-in: unknown username "${loginId.slice(0, 60)}"`, {
        req,
        meta: { triedUsername: loginId.slice(0, 60), reason: 'unknown_user' },
      });
      throw AppError.unauthorized('Invalid username or password');
    }

    if (user.status !== 'ACTIVE') {
      await logActivity('LOGIN_FAILED', `Failed sign-in: account is ${user.status.toLowerCase()}`, {
        req,
        userId: String(user._id),
        meta: { triedUsername: loginId.slice(0, 60), reason: `account_${user.status.toLowerCase()}` },
      });
      throw AppError.forbidden(`Account is ${user.status.toLowerCase()}. Please contact administrator.`);
    }

    // Locked for a while after too many wrong passwords: refused without checking the password,
    // so the lock can't be used to keep guessing. It lifts by itself when the time is up.
    const now = new Date();
    if (user.lockUntil && user.lockUntil > now) {
      const minutes = Math.ceil((user.lockUntil.getTime() - now.getTime()) / 60000);
      await logActivity('LOGIN_FAILED', `Failed sign-in: locked for ${minutes} more minute${minutes === 1 ? '' : 's'} after wrong passwords`, {
        req,
        userId: String(user._id),
        meta: { triedUsername: loginId.slice(0, 60), reason: 'temporarily_locked', lockUntil: user.lockUntil },
      });
      throw new AppError(
        `Too many wrong passwords. Try again after ${istTime(user.lockUntil)} (in ${minutes} minute${minutes === 1 ? '' : 's'}), or ask an administrator to reset your password.`,
        429,
        'ACCOUNT_TEMPORARILY_LOCKED'
      );
    }
    if (user.lockUntil) {
      // The lock has expired: a fresh set of attempts
      user.lockUntil = undefined;
      user.failedLoginAttempts = 0;
    }

    // Check password
    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      user.failedLoginAttempts += 1;
      const attempt = user.failedLoginAttempts;
      const locking = attempt >= MAX_FAILED_LOGINS;
      if (locking) {
        user.lockUntil = new Date(now.getTime() + LOCK_MINUTES * 60000);
        user.failedLoginAttempts = 0;
      }
      await user.save();
      await logActivity('LOGIN_FAILED', `Failed sign-in: wrong password (attempt ${attempt})`, {
        req,
        userId: String(user._id),
        meta: { triedUsername: loginId.slice(0, 60), reason: 'wrong_password', attempt },
      });
      if (locking) {
        await logActivity('ACCOUNT_LOCKED', `Account locked for ${LOCK_MINUTES} minutes after ${MAX_FAILED_LOGINS} wrong passwords`, {
          req,
          userId: String(user._id),
          meta: { lockUntil: user.lockUntil, minutes: LOCK_MINUTES },
        });
        throw new AppError(
          `Too many wrong passwords. Your account is locked for ${LOCK_MINUTES} minutes (until ${istTime(user.lockUntil!)}). An administrator can unlock it sooner by resetting your password.`,
          429,
          'ACCOUNT_TEMPORARILY_LOCKED'
        );
      }
      const left = MAX_FAILED_LOGINS - attempt;
      throw AppError.unauthorized(
        left <= 2 ? `Invalid username or password. ${left} more wrong ${left === 1 ? 'try' : 'tries'} will lock the account for ${LOCK_MINUTES} minutes.` : 'Invalid username or password'
      );
    }

    // Reset failed attempts & update last login
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLoginAt = new Date();
    await user.save();

    // Extract populated roles & aggregated permissions
    const populatedRoles = user.roles as unknown as Array<{ code: string; permissions: string[] }>;
    const roleCodes = populatedRoles.map((r) => r.code);
    const permissionsSet = new Set<string>();
    populatedRoles.forEach((r) => {
      if (Array.isArray(r.permissions)) {
        r.permissions.forEach((p) => permissionsSet.add(p));
      }
    });
    const permissions = Array.from(permissionsSet);

    const sid = await startSession(req, user._id as mongoose.Types.ObjectId);
    const jwtPayload = {
      userId: user._id.toString(),
      username: user.username,
      roles: roleCodes,
      permissions,
      departmentId: user.departmentId ? user.departmentId.toString() : undefined,
      sid,
    };
    await logActivity('LOGIN_SUCCESS', 'Signed in', { req, userId: user._id.toString(), sessionId: sid });

    const accessToken = generateAccessToken(jwtPayload);
    const refreshToken = generateRefreshToken(jwtPayload);

    // Set Refresh Token HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      // Browsers drop Secure cookies on plain HTTP, so only set it when the app is served over HTTPS
      secure: env.NODE_ENV === 'production' && env.APP_URL.startsWith('https://'),
      sameSite: 'lax',
      maxAge: 12 * 60 * 60 * 1000, // 12 hours
    });

    sendSuccess(
      res,
      {
        user: {
          id: user._id,
          employeeId: user.employeeId,
          name: user.name,
          email: user.email,
          username: user.username,
          departmentId: user.departmentId,
          designation: user.designation,
          roles: roleCodes,
          permissions,
          mustCompleteProfile: Boolean(user.mustCompleteProfile),
        },
        accessToken,
      },
      'Login successful'
    );
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!token) {
      throw AppError.unauthorized('Refresh token is required');
    }

    const payload = verifyRefreshToken(token);
    const user = await User.findById(payload.userId).populate('roles');

    if (!user || user.status !== 'ACTIVE') {
      throw AppError.unauthorized('User not active or found');
    }

    // A session that was signed out (or ended by a Super Admin) cannot be refreshed
    let sid = payload.sid;
    if (sid) {
      const session = await UserSession.findById(sid).select('endedAt endReason revoked');
      if (!session || session.revoked || (session.endedAt && session.endReason !== 'expired')) {
        res.clearCookie('refreshToken');
        throw AppError.unauthorized(
          session?.revoked ? revokedMessage(session.endReason) : 'Your session has ended. Please sign in again.'
        );
      }
      await UserSession.updateOne({ _id: sid }, { $set: { lastSeenAt: new Date() }, $unset: { endedAt: 1, endReason: 1 } });
    }

    const populatedRoles = user.roles as unknown as Array<{ code: string; permissions: string[] }>;
    const roleCodes = populatedRoles.map((r) => r.code);
    const permissionsSet = new Set<string>();
    populatedRoles.forEach((r) => {
      if (Array.isArray(r.permissions)) {
        r.permissions.forEach((p) => permissionsSet.add(p));
      }
    });

    const newPayload = {
      userId: user._id.toString(),
      username: user.username,
      roles: roleCodes,
      permissions: Array.from(permissionsSet),
      departmentId: user.departmentId ? user.departmentId.toString() : undefined,
      sid,
    };

    // Signed in before sessions were tracked: start one now and reissue the refresh cookie with it
    if (!sid) {
      newPayload.sid = sid = await startSession(req, user._id as mongoose.Types.ObjectId);
      res.cookie('refreshToken', generateRefreshToken(newPayload), {
        httpOnly: true,
        secure: env.NODE_ENV === 'production' && env.APP_URL.startsWith('https://'),
        sameSite: 'lax',
        maxAge: 12 * 60 * 60 * 1000,
      });
    }

    const accessToken = generateAccessToken(newPayload);
    sendSuccess(res, { accessToken }, 'Token refreshed successfully');
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  // The logout call is not authenticated (the access token may already be expired); the refresh
  // cookie says whose session is ending
  try {
    const token = req.cookies?.refreshToken;
    if (token) {
      const payload = verifyRefreshToken(token);
      await endSession(payload.sid, 'logout');
      await logActivity('LOGOUT', 'Signed out', { req, userId: payload.userId, sessionId: payload.sid });
    }
  } catch {
    /* expired or invalid cookie: nothing to end */
  }
  res.clearCookie('refreshToken');
  sendSuccess(res, null, 'Logged out successfully');
};

export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw AppError.unauthorized('User not authenticated');
    }

    const user = await User.findById(req.user.userId)
      .select('-passwordHash -__v')
      .populate('roles', 'name code permissions')
      .populate('departmentId', 'name code');

    if (!user) {
      throw AppError.notFound('User profile not found');
    }

    const populatedRoles = (user.roles as any[]) || [];
    const roleCodes = populatedRoles.map((r) => (typeof r === 'object' && r.code ? r.code : String(r)));
    const permissionsSet = new Set<string>();
    populatedRoles.forEach((r) => {
      if (typeof r === 'object' && Array.isArray(r.permissions)) {
        r.permissions.forEach((p: string) => permissionsSet.add(p));
      }
    });

    const userProfile = {
      id: user._id,
      employeeId: user.employeeId,
      name: user.name,
      email: user.email,
      username: user.username,
      departmentId: (user.departmentId as any)?._id?.toString() || undefined,
      department: user.departmentId,
      designation: user.designation,
      whatsappNumber: user.whatsappNumber,
      roles: roleCodes,
      permissions: Array.from(permissionsSet),
      mustCompleteProfile: Boolean(user.mustCompleteProfile),
    };

    sendSuccess(res, userProfile, 'Profile fetched successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * First login of an imported staff member: confirm department and designation, optionally add
 * WhatsApp number and email, and set their own password. They then sign in again with it.
 */
export const completeProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = completeProfileSchema.parse(req.body ?? {});
    const user = await User.findById(req.user!.userId);
    if (!user) throw AppError.notFound('User not found');
    if (!user.mustCompleteProfile) throw AppError.conflict('Your details are already complete');

    const department = await Department.findById(data.departmentId).select('_id active');
    if (!department || (department as any).active === false) throw AppError.badRequest('Select your department');

    if (data.newPassword === COMMON_STAFF_PASSWORD || (await comparePassword(data.newPassword, user.passwordHash))) {
      throw AppError.badRequest('Choose a new password, different from the one you were given');
    }
    if (data.newPassword.toLowerCase() === user.username.toLowerCase()) {
      throw AppError.badRequest('Your password cannot be your Employee ID');
    }

    const email = data.email ? data.email.toLowerCase() : undefined;
    if (email && (await User.exists({ email, _id: { $ne: user._id } }))) {
      throw AppError.conflict('This email is already used by another account');
    }

    const previous = { departmentId: user.departmentId, designation: user.designation };
    user.departmentId = department._id as mongoose.Types.ObjectId;
    user.designation = data.designation;
    // Left blank: keep the number already on record (e.g. from HR) instead of erasing it
    if (data.whatsappNumber?.trim()) user.whatsappNumber = normaliseWhatsapp(data.whatsappNumber);
    if (email) user.email = email;
    user.passwordHash = await hashPassword(data.newPassword);
    user.mustCompleteProfile = false;
    user.profileCompletedAt = new Date();
    user.failedLoginAttempts = 0;
    await user.save();

    await recordAuditLog({
      userId: String(user._id),
      action: 'PROFILE_COMPLETED',
      entityType: 'USER',
      entityId: String(user._id),
      previousValue: previous,
      newValue: { departmentId: user.departmentId, designation: user.designation, whatsappAdded: Boolean(user.whatsappNumber), emailAdded: Boolean(email) },
      req,
    });

    // The session ends here: the client signs out and the user logs in with their new password
    await endSession(req.user?.sid, 'profile_completed');
    res.clearCookie('refreshToken');
    sendSuccess(res, null, 'Your details are saved. Please sign in with your new password.');
  } catch (error) {
    next(error);
  }
};

const updateMyProfileSchema = z.object({
  whatsappNumber: z.string().trim().max(20).optional(),
  email: z.string().trim().email('Enter a valid email address').max(200).optional().or(z.literal('')),
});

/**
 * PATCH /auth/me — the signed-in person updates their own WhatsApp number and email (My Profile).
 * Department, designation and role are managed by Admin and cannot be changed here.
 */
export const updateMyProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = updateMyProfileSchema.parse(req.body ?? {});
    const user = await User.findById(req.user!.userId);
    if (!user) throw AppError.notFound('User not found');

    const changed: string[] = [];
    if (data.whatsappNumber !== undefined) {
      const next = data.whatsappNumber ? normaliseWhatsapp(data.whatsappNumber) : undefined;
      if (next !== user.whatsappNumber) {
        user.whatsappNumber = next;
        changed.push('WhatsApp number');
      }
    }
    if (data.email !== undefined) {
      const email = data.email ? data.email.toLowerCase() : undefined;
      if (email && (await User.exists({ email, _id: { $ne: user._id } }))) {
        throw AppError.conflict('Another account already uses this email');
      }
      if (email !== (user.email || undefined)) {
        user.email = email as any;
        changed.push('email');
      }
    }
    if (changed.length) {
      await user.save();
      await logActivity('PROFILE_UPDATED', `Updated own ${changed.join(' and ')}`, { req });
    }
    sendSuccess(res, { whatsappNumber: user.whatsappNumber ?? null, email: user.email ?? null }, changed.length ? 'Your details are saved' : 'Nothing to change');
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw AppError.unauthorized('User not authenticated');
    }

    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    const user = await User.findById(req.user.userId);
    if (!user) {
      throw AppError.notFound('User not found');
    }

    const isMatch = await comparePassword(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw AppError.badRequest('Your current password is not correct');
    }
    // Same rules as the first sign-in
    if (newPassword === COMMON_STAFF_PASSWORD) throw AppError.badRequest('Choose a password other than the one you were given');
    if ([user.username, user.employeeId].some((v) => v && newPassword.toLowerCase() === String(v).toLowerCase())) {
      throw AppError.badRequest('Your password cannot be your Employee ID or username');
    }
    if (await comparePassword(newPassword, user.passwordHash)) {
      throw AppError.badRequest('The new password must be different from the current one');
    }

    user.passwordHash = await hashPassword(newPassword);
    user.failedLoginAttempts = 0;
    await user.save();

    // Sign out everywhere else, in case someone else knew the old password (this session stays)
    const others = await UserSession.updateMany(
      { userId: user._id, _id: { $ne: req.user.sid }, endedAt: { $exists: false } },
      { $set: { endedAt: new Date(), endReason: 'password_changed', revoked: true } }
    );
    await logActivity('PASSWORD_CHANGED', `Changed own password${others.modifiedCount ? ` (signed out ${others.modifiedCount} other session(s))` : ''}`, { req });

    sendSuccess(res, { otherSessionsEnded: others.modifiedCount }, 'Your password has been changed');
  } catch (error) {
    next(error);
  }
};
