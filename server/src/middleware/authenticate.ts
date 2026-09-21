import { Request, Response, NextFunction } from 'express';
import { AppError } from '../common/errors/appError.js';
import { verifyAccessToken, JwtPayload } from '../modules/auth/auth.utils.js';
import { User } from '../modules/users/user.model.js';

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return next(AppError.unauthorized('Authentication token is required'));
  }

  let payload: JwtPayload;
  try {
    payload = verifyAccessToken(token);
  } catch (error) {
    return next(AppError.unauthorized('Invalid or expired authentication token'));
  }

  try {
    // Resolve roles and permissions from the database on every request so that role changes,
    // removed roles and deactivated accounts take effect immediately instead of at next login.
    const user = await User.findById(payload.userId).populate('roles', 'code permissions');
    if (!user || user.status !== 'ACTIVE') {
      return next(AppError.unauthorized('Account is not active'));
    }

    const roles = (user.roles as unknown as Array<{ code: string; permissions: string[] }>) || [];
    const permissions = new Set<string>();
    roles.forEach((r) => (r.permissions || []).forEach((p) => permissions.add(p)));

    req.user = {
      userId: user._id.toString(),
      username: user.username,
      roles: roles.map((r) => r.code),
      permissions: Array.from(permissions),
      departmentId: user.departmentId ? user.departmentId.toString() : undefined,
    };
    next();
  } catch (error) {
    next(error);
  }
};
