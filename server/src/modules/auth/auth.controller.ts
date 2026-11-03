import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Department } from '../departments/department.model.js';
import { recordAuditLog } from '../audit/audit.service.js';
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
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { username, password } = loginSchema.parse(req.body);

    const user = await User.findOne({
      $or: [{ username: username.toLowerCase() }, { email: username.toLowerCase() }],
    }).populate('roles');

    if (!user) {
      throw AppError.unauthorized('Invalid username or password');
    }

    if (user.status !== 'ACTIVE') {
      throw AppError.forbidden(`Account is ${user.status.toLowerCase()}. Please contact administrator.`);
    }

    // Check password
    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= 5) {
        user.status = 'LOCKED';
      }
      await user.save();
      throw AppError.unauthorized('Invalid username or password');
    }

    // Reset failed attempts & update last login
    user.failedLoginAttempts = 0;
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

    const jwtPayload = {
      userId: user._id.toString(),
      username: user.username,
      roles: roleCodes,
      permissions,
      departmentId: user.departmentId ? user.departmentId.toString() : undefined,
    };

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
    };

    const accessToken = generateAccessToken(newPayload);
    sendSuccess(res, { accessToken }, 'Token refreshed successfully');
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
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
    user.whatsappNumber = normaliseWhatsapp(data.whatsappNumber);
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
    res.clearCookie('refreshToken');
    sendSuccess(res, null, 'Your details are saved. Please sign in with your new password.');
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
      throw AppError.badRequest('Current password is incorrect');
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    sendSuccess(res, null, 'Password updated successfully');
  } catch (error) {
    next(error);
  }
};
