import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { User } from '../users/user.model.js';
import { Role } from '../roles/role.model.js';
import { AppError } from '../../common/errors/appError.js';
import { sendSuccess } from '../../common/helpers/response.js';
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
      secure: process.env.NODE_ENV === 'production',
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
      .populate('roles', 'name code permissions')
      .populate('departmentId', 'name code');

    if (!user) {
      throw AppError.notFound('User profile not found');
    }

    sendSuccess(res, user, 'Profile fetched successfully');
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
