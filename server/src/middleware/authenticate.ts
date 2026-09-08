import { Request, Response, NextFunction } from 'express';
import { AppError } from '../common/errors/appError.js';
import { verifyAccessToken } from '../modules/auth/auth.utils.js';

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    throw AppError.unauthorized('Authentication token is required');
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (error) {
    throw AppError.unauthorized('Invalid or expired authentication token');
  }
};
