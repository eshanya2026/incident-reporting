import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Role } from './role.model.js';
import { User } from '../users/user.model.js';
import { AppError } from '../../common/errors/appError.js';
import { sendSuccess } from '../../common/helpers/response.js';
import { hasPermission } from '../../common/helpers/incidentAccess.js';
import { PERMISSIONS, ROLE_CODES } from '../../common/enums/permissions.js';
import { PERMISSION_CATALOG, isConfigurablePermission } from '../../common/enums/permissionCatalog.js';
import { defaultPermissionsFor } from '../../seeders/systemRoles.js';
import { recordAuditLog } from '../audit/audit.service.js';

const createRoleSchema = z.object({
  name: z.string().min(1, 'Role name is required'),
  code: z.string().min(1, 'Role code is required'),
  permissions: z.array(z.string()).min(1, 'At least one permission must be selected'),
});

/** Roles for the user form. The Super Admin role is only offered to Super Admins. */
export const getRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const canGrantSuperAdmin = hasPermission(req.user, PERMISSIONS.ADMIN_ACCESS_CONTROL);
    const roles = await Role.find(canGrantSuperAdmin ? {} : { code: { $ne: ROLE_CODES.SUPER_ADMIN } }).sort({ name: 1 });
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
    if (data.permissions.includes(PERMISSIONS.ADMIN_ACCESS_CONTROL)) {
      throw AppError.forbidden('Access Control is reserved for the Super Admin role');
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

// ---------- Access Control (Super Admin) ----------

/** Everything the Access Control screen needs: the permission catalogue and each role's current access. */
export const getAccessMatrix = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [roles, counts] = await Promise.all([
      Role.find().sort({ name: 1 }).lean(),
      User.aggregate([{ $match: { status: 'ACTIVE' } }, { $unwind: '$roles' }, { $group: { _id: '$roles', count: { $sum: 1 } } }]),
    ]);
    const userCount = new Map(counts.map((c: any) => [String(c._id), c.count]));
    sendSuccess(
      res,
      {
        catalog: PERMISSION_CATALOG,
        roles: roles.map((r: any) => ({
          _id: r._id,
          name: r.name,
          code: r.code,
          permissions: r.permissions,
          isSystemRole: r.isSystemRole,
          customized: Boolean(r.customized),
          editable: r.code !== ROLE_CODES.SUPER_ADMIN,
          defaults: defaultPermissionsFor(r.code) ?? null,
          activeUsers: userCount.get(String(r._id)) ?? 0,
        })),
      },
      'Access matrix retrieved'
    );
  } catch (error) {
    next(error);
  }
};

const loadEditableRole = async (id: string) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw AppError.badRequest('Invalid role');
  const role = await Role.findById(id);
  if (!role) throw AppError.notFound('Role not found');
  if (role.code === ROLE_CODES.SUPER_ADMIN) {
    throw AppError.badRequest('The Super Admin role always has full access and cannot be changed');
  }
  return role;
};

const setPermissionsSchema = z.object({ permissions: z.array(z.string()) });

/**
 * Sets which screens and administration abilities a role has. Only configurable permissions are
 * taken from the request; the role's workflow steps are kept exactly as they are.
 */
export const setRolePermissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { permissions } = setPermissionsSchema.parse(req.body ?? {});
    const role = await loadEditableRole(req.params.id as string);

    const unknown = permissions.filter((p) => !PERMISSION_CATALOG.some((c) => c.key === p));
    if (unknown.length) throw AppError.badRequest(`Unknown permission: ${unknown.join(', ')}`);

    // Workflow steps and Access Control follow the role; they can be sent back unchanged but never added
    const addedFixed = permissions.filter((p) => !isConfigurablePermission(p) && !role.permissions.includes(p));
    if (addedFixed.length) {
      throw AppError.badRequest(`These cannot be changed from Access Control: ${addedFixed.join(', ')}`);
    }

    const chosen = permissions.filter(isConfigurablePermission);
    const fixed = role.permissions.filter((p) => !isConfigurablePermission(p));
    const next_ = [...new Set([...chosen, ...fixed])];
    const previous = [...role.permissions];

    role.permissions = next_;
    role.customized = true;
    await role.save();

    await recordAuditLog({
      userId: req.user!.userId,
      action: 'ROLE_ACCESS_CHANGED',
      entityType: 'ROLE',
      entityId: String(role._id),
      previousValue: { permissions: previous },
      newValue: { permissions: next_ },
      req,
    });
    sendSuccess(res, role, `Access for ${role.name} updated`);
  } catch (error) {
    next(error);
  }
};

/** Puts a system role back to its default access. */
export const resetRolePermissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const role = await loadEditableRole(req.params.id as string);
    const defaults = defaultPermissionsFor(role.code);
    if (!defaults) throw AppError.badRequest('Only system roles have defaults to reset to');

    const previous = [...role.permissions];
    role.permissions = [...defaults];
    role.customized = false;
    await role.save();

    await recordAuditLog({
      userId: req.user!.userId,
      action: 'ROLE_ACCESS_RESET',
      entityType: 'ROLE',
      entityId: String(role._id),
      previousValue: { permissions: previous },
      newValue: { permissions: role.permissions },
      req,
    });
    sendSuccess(res, role, `Access for ${role.name} reset to default`);
  } catch (error) {
    next(error);
  }
};
