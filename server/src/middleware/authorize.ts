import { Request, Response, NextFunction } from 'express';
import { AppError } from '../common/errors/appError.js';

export const requirePermission = (...requiredPermissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw AppError.unauthorized('User not authenticated');
    }

    const userPermissions = req.user.permissions || [];
    const hasAllPermissions = requiredPermissions.every((perm) =>
      userPermissions.includes(perm)
    );

    if (!hasAllPermissions) {
      throw AppError.forbidden(`Missing required permission(s): ${requiredPermissions.join(', ')}`);
    }

    next();
  };
};

export const requireAnyPermission = (...permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw AppError.unauthorized('User not authenticated');
    }

    const userPermissions = req.user.permissions || [];
    const hasAny = permissions.some((perm) => userPermissions.includes(perm));

    if (!hasAny) {
      throw AppError.forbidden(`Requires at least one of permissions: ${permissions.join(', ')}`);
    }

    next();
  };
};
