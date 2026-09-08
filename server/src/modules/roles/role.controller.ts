import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Role } from './role.model.js';
import { AppError } from '../../common/errors/appError.js';
import { sendSuccess } from '../../common/helpers/response.js';

const createRoleSchema = z.object({
  name: z.string().min(1, 'Role name is required'),
  code: z.string().min(1, 'Role code is required'),
  permissions: z.array(z.string()).min(1, 'At least one permission must be selected'),
});

export const getRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const roles = await Role.find().sort({ name: 1 });
    sendSuccess(res, roles, 'Roles retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const createRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = createRoleSchema.parse(req.body);

    const existingRole = await Role.findOne({ code: data.code.toUpperCase() });
    if (existingRole) {
      throw AppError.conflict('Role code already exists');
    }

    const role = await Role.create({
      name: data.name,
      code: data.code.toUpperCase(),
      permissions: data.permissions,
      isSystemRole: false,
    });

    sendSuccess(res, role, 'Role created successfully', 201);
  } catch (error) {
    next(error);
  }
};
