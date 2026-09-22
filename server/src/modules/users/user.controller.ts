import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { User, IUser } from './user.model.js';
import { Role } from '../roles/role.model.js';
import { Department } from '../departments/department.model.js';
import { AppError } from '../../common/errors/appError.js';
import { sendSuccess } from '../../common/helpers/response.js';
import { hashPassword } from '../auth/auth.utils.js';
import { ROLE_CODES } from '../../common/enums/permissions.js';

const objectId = z.string().refine((v) => mongoose.Types.ObjectId.isValid(v), 'Invalid ID');

const createUserSchema = z.object({
  employeeId: z.string().trim().min(1, 'Employee ID is required'),
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  username: z.string().trim().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().optional(),
  whatsappNumber: z.string().optional(),
  departmentId: objectId.optional().nullable(),
  designation: z.string().optional(),
  roles: z.array(objectId).min(1, 'At least one role must be assigned'),
  // When the user is an HOD and their department already has one, replace the current HOD
  replaceDepartmentHod: z.boolean().optional(),
});

const updateUserSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  whatsappNumber: z.string().optional(),
  departmentId: objectId.optional().nullable(),
  designation: z.string().optional(),
  roles: z.array(objectId).min(1, 'At least one role must be assigned').optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'LOCKED']).optional(),
  replaceDepartmentHod: z.boolean().optional(),
});

const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// Roles that must belong to a department
const DEPARTMENT_ROLES: string[] = [ROLE_CODES.STAFF, ROLE_CODES.HOD];

const populateUser = (id: unknown) =>
  User.findById(id).select('-passwordHash').populate('roles', 'name code').populate('departmentId', 'name code');

/** Validates role IDs and returns their codes. */
const resolveRoleCodes = async (roleIds: string[]): Promise<string[]> => {
  const roles = await Role.find({ _id: { $in: roleIds } }).select('code');
  if (roles.length !== new Set(roleIds).size) {
    throw AppError.badRequest('One or more selected roles do not exist');
  }
  return roles.map((r) => r.code);
};

const assertDepartmentForRoles = async (roleCodes: string[], departmentId?: string | null): Promise<void> => {
  const needsDepartment = roleCodes.some((c) => DEPARTMENT_ROLES.includes(c));
  if (needsDepartment && !departmentId) {
    throw AppError.badRequest('Staff and HOD users must belong to a department');
  }
  if (departmentId && !(await Department.exists({ _id: departmentId }))) {
    throw AppError.badRequest('Selected department does not exist');
  }
};

const assertWhatsappForHod = (roleCodes: string[], whatsappNumber?: string | null): void => {
  if (roleCodes.includes(ROLE_CODES.HOD) && !whatsappNumber?.trim()) {
    throw AppError.badRequest('HOD users must have a WhatsApp number');
  }
};

const assertDesignationForHod = (roleCodes: string[], designation?: string | null): void => {
  if (roleCodes.includes(ROLE_CODES.HOD) && !designation?.trim()) {
    throw AppError.badRequest('HOD users must have a designation');
  }
};

/**
 * Refuses to make a user the HOD of a department that already has another active HOD,
 * unless replaceExisting is set. Called before saving so a conflict changes nothing.
 */
const assertHodSlotAvailable = async (params: {
  userId?: string;
  roleCodes: string[];
  departmentId?: string | null;
  status: string;
  replaceExisting: boolean;
}): Promise<void> => {
  const { userId, roleCodes, departmentId, status, replaceExisting } = params;
  if (replaceExisting || !departmentId || status !== 'ACTIVE' || !roleCodes.includes(ROLE_CODES.HOD)) return;

  const dept = await Department.findById(departmentId);
  if (!dept?.hodUserId || dept.hodUserId.toString() === userId) return;

  const current = await User.findById(dept.hodUserId).select('name status');
  if (current && current.status === 'ACTIVE') {
    throw AppError.conflict(
      `${dept.name} already has an HOD (${current.name}). Tick "Replace current HOD" to make this user the HOD instead.`
    );
  }
};

/**
 * Keeps Department.hodUserId in line with the user's HOD role, department and status:
 * an active HOD becomes their department's HOD; a user who stops being an active HOD
 * of a department is unlinked from it. Run assertHodSlotAvailable first.
 */
const syncDepartmentHod = async (user: IUser, roleCodes: string[]): Promise<void> => {
  const isActiveHod = roleCodes.includes(ROLE_CODES.HOD) && user.status === 'ACTIVE' && Boolean(user.departmentId);

  // Unlink from any department this user no longer heads
  await Department.updateMany(
    {
      hodUserId: user._id,
      ...(isActiveHod ? { _id: { $ne: user.departmentId } } : {}),
    },
    { $set: { hodUserId: null } }
  );

  if (!isActiveHod) return;

  await Department.updateOne({ _id: user.departmentId }, { $set: { hodUserId: user._id } });
};

export const getUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 200);
    const search = req.query.search as string;
    const departmentId = req.query.departmentId as string;
    const roleCode = req.query.role as string;
    const status = req.query.status as string;

    const query: any = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
      ];
    }
    if (departmentId) {
      query.departmentId = departmentId;
    }
    if (status) {
      query.status = status;
    }
    if (roleCode) {
      const role = await Role.findOne({ code: roleCode.toUpperCase() }).select('_id');
      query.roles = role?._id ?? null;
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select('-passwordHash')
      .populate('roles', 'name code')
      .populate('departmentId', 'name code')
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit);

    sendSuccess(res, users, 'Users retrieved successfully', 200, {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await populateUser(req.params.id);
    if (!user) {
      throw AppError.notFound('User not found');
    }
    sendSuccess(res, user, 'User details retrieved');
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = createUserSchema.parse(req.body);

    const existingUser = await User.findOne({
      $or: [{ username: data.username.toLowerCase() }, { email: data.email.toLowerCase() }, { employeeId: data.employeeId }],
    });
    if (existingUser) {
      throw AppError.conflict('User with this Username, Email or Employee ID already exists');
    }

    const roleCodes = await resolveRoleCodes(data.roles);
    await assertDepartmentForRoles(roleCodes, data.departmentId);
    assertWhatsappForHod(roleCodes, data.whatsappNumber);
    assertDesignationForHod(roleCodes, data.designation);

    await assertHodSlotAvailable({
      roleCodes,
      departmentId: data.departmentId,
      status: 'ACTIVE',
      replaceExisting: Boolean(data.replaceDepartmentHod),
    });

    const user = await User.create({
      employeeId: data.employeeId,
      name: data.name,
      email: data.email.toLowerCase(),
      username: data.username.toLowerCase(),
      passwordHash: await hashPassword(data.password),
      phone: data.phone,
      whatsappNumber: data.whatsappNumber,
      departmentId: data.departmentId || null,
      designation: data.designation,
      roles: data.roles,
      status: 'ACTIVE',
    });

    await syncDepartmentHod(user, roleCodes);

    sendSuccess(res, await populateUser(user._id), 'User created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = updateUserSchema.parse(req.body);

    const user = await User.findById(req.params.id);
    if (!user) {
      throw AppError.notFound('User not found');
    }

    const roleIds = data.roles ?? user.roles.map((r) => r.toString());
    const roleCodes = await resolveRoleCodes(roleIds);
    const departmentId = data.departmentId !== undefined ? data.departmentId : user.departmentId?.toString();
    await assertDepartmentForRoles(roleCodes, departmentId);
    const whatsappNumber = data.whatsappNumber !== undefined ? data.whatsappNumber : user.whatsappNumber;
    assertWhatsappForHod(roleCodes, whatsappNumber);
    const designation = data.designation !== undefined ? data.designation : user.designation;
    assertDesignationForHod(roleCodes, designation);

    // Admins cannot lock themselves out
    if (user._id.toString() === req.user?.userId) {
      if (data.status && data.status !== 'ACTIVE') {
        throw AppError.badRequest('You cannot deactivate your own account');
      }
      if (!roleCodes.includes(ROLE_CODES.ADMIN)) {
        throw AppError.badRequest('You cannot remove the Admin role from your own account');
      }
    }

    await assertHodSlotAvailable({
      userId: user._id.toString(),
      roleCodes,
      departmentId,
      status: data.status ?? user.status,
      replaceExisting: Boolean(data.replaceDepartmentHod),
    });

    if (data.email && data.email.toLowerCase() !== user.email) {
      if (await User.exists({ email: data.email.toLowerCase(), _id: { $ne: user._id } })) {
        throw AppError.conflict('Another user already uses this email');
      }
      user.email = data.email.toLowerCase();
    }
    if (data.name) user.name = data.name;
    if (data.phone !== undefined) user.phone = data.phone;
    if (data.whatsappNumber !== undefined) user.whatsappNumber = data.whatsappNumber;
    if (data.departmentId !== undefined) user.departmentId = (data.departmentId || null) as any;
    if (data.designation !== undefined) user.designation = data.designation;
    if (data.roles) user.roles = data.roles as any;
    if (data.status) {
      user.status = data.status;
      if (data.status === 'ACTIVE') {
        user.failedLoginAttempts = 0;
      }
    }

    await user.save();
    await syncDepartmentHod(user, roleCodes);

    sendSuccess(res, await populateUser(user._id), 'User updated successfully');
  } catch (error) {
    next(error);
  }
};

export const resetUserPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { password } = resetPasswordSchema.parse(req.body);

    const user = await User.findById(req.params.id);
    if (!user) {
      throw AppError.notFound('User not found');
    }

    user.passwordHash = await hashPassword(password);
    user.failedLoginAttempts = 0;
    if (user.status === 'LOCKED') {
      user.status = 'ACTIVE';
    }
    await user.save();

    sendSuccess(res, null, 'Password reset successfully');
  } catch (error) {
    next(error);
  }
};

const bulkUserItemSchema = z.object({
  employeeId: z.string().trim().min(1, 'Employee ID is required'),
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  username: z.string().trim().min(3, 'Username must be at least 3 characters'),
  departmentCode: z.string().trim().optional(),
  roleCode: z.string().trim().default('STAFF'),
  designation: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  password: z.string().min(6).optional(),
});

const bulkImportUsersSchema = z.object({
  users: z.array(bulkUserItemSchema).min(1, 'At least one user is required'),
  updateExisting: z.boolean().optional().default(false),
  defaultPassword: z.string().min(6).optional().default('Staff@123'),
});

export const bulkImportUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { users: userList, updateExisting, defaultPassword } = bulkImportUsersSchema.parse(req.body);

    const roles = await Role.find({});
    const roleMap = new Map(roles.map((r) => [r.code.toUpperCase(), r]));

    const departments = await Department.find({});
    const deptByCode = new Map(departments.map((d) => [d.code.toUpperCase(), d]));
    const deptByName = new Map(departments.map((d) => [d.name.toLowerCase(), d]));

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors: Array<{ row: number; employeeId: string; error: string }> = [];

    for (let i = 0; i < userList.length; i++) {
      const item = userList[i];
      const rowNum = i + 1;
      const roleCodeUpper = (item.roleCode || 'STAFF').toUpperCase();
      const targetRole = roleMap.get(roleCodeUpper);

      if (!targetRole) {
        errors.push({
          row: rowNum,
          employeeId: item.employeeId,
          error: `Unknown role: '${item.roleCode}'. Must be one of: STAFF, HOD, QUALITY, ADMIN`,
        });
        continue;
      }

      // Department resolution
      let departmentDoc: any = null;
      if (item.departmentCode) {
        departmentDoc =
          deptByCode.get(item.departmentCode.toUpperCase()) ||
          deptByName.get(item.departmentCode.toLowerCase()) ||
          null;
      }

      const needsDept = DEPARTMENT_ROLES.includes(roleCodeUpper);
      if (needsDept && !departmentDoc) {
        errors.push({
          row: rowNum,
          employeeId: item.employeeId,
          error: `Department '${item.departmentCode || ''}' not found. Required for ${roleCodeUpper} role.`,
        });
        continue;
      }

      try {
        const existing = await User.findOne({
          $or: [
            { employeeId: item.employeeId },
            { username: item.username.toLowerCase() },
            { email: item.email.toLowerCase() },
          ],
        });

        if (existing) {
          if (!updateExisting) {
            skipped++;
            continue;
          }

          // Update existing user
          existing.name = item.name;
          existing.email = item.email.toLowerCase();
          if (item.designation) existing.designation = item.designation;
          if (item.phone) existing.phone = item.phone;
          if (departmentDoc) existing.departmentId = departmentDoc._id;
          if (targetRole) existing.roles = [targetRole._id as any];
          if (item.password) {
            existing.passwordHash = await hashPassword(item.password);
          }
          await existing.save();
          if (roleCodeUpper === ROLE_CODES.HOD && departmentDoc && !departmentDoc.hodUserId) {
            await Department.updateOne({ _id: departmentDoc._id }, { $set: { hodUserId: existing._id } });
          }
          updated++;
        } else {
          // Create new user
          const pwdToHash = item.password || defaultPassword;
          const newUser = await User.create({
            employeeId: item.employeeId,
            name: item.name,
            email: item.email.toLowerCase(),
            username: item.username.toLowerCase(),
            passwordHash: await hashPassword(pwdToHash),
            phone: item.phone,
            departmentId: departmentDoc?._id || null,
            designation: item.designation,
            roles: [targetRole._id],
            status: 'ACTIVE',
          });

          if (roleCodeUpper === ROLE_CODES.HOD && departmentDoc && !departmentDoc.hodUserId) {
            await Department.updateOne({ _id: departmentDoc._id }, { $set: { hodUserId: newUser._id } });
          }
          imported++;
        }
      } catch (err: any) {
        errors.push({
          row: rowNum,
          employeeId: item.employeeId,
          error: err.message || 'Failed to save user',
        });
      }
    }

    sendSuccess(
      res,
      {
        total: userList.length,
        imported,
        updated,
        skipped,
        failed: errors.length,
        errors,
      },
      `Bulk import completed: ${imported} imported, ${updated} updated, ${skipped} skipped, ${errors.length} failed`,
      200
    );
  } catch (error) {
    next(error);
  }
};

