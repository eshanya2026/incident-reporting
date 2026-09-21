import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Department } from './department.model.js';
import { AppError } from '../../common/errors/appError.js';
import { sendSuccess } from '../../common/helpers/response.js';
import { User } from '../users/user.model.js';
import { ROLE_CODES } from '../../common/enums/permissions.js';

/** The department HOD must be an active user with the HOD role who belongs to that department. */
const assertValidHod = async (hodUserId: string, departmentId?: string): Promise<void> => {
  const user = await User.findById(hodUserId).populate('roles', 'code');
  const isHod = (user?.roles as unknown as Array<{ code: string }> | undefined)?.some((r) => r.code === ROLE_CODES.HOD);
  if (!user || user.status !== 'ACTIVE' || !isHod) {
    throw AppError.badRequest('The department HOD must be an active user with the HOD role');
  }
  if (departmentId && user.departmentId?.toString() !== departmentId) {
    throw AppError.badRequest("The HOD must belong to this department. Change the user's department first.");
  }
};

const createDepartmentSchema = z.object({
  code: z.string().min(1, 'Department code is required'),
  name: z.string().min(1, 'Department name is required'),
  category: z.string().trim().optional(),
  hodUserId: z.string().optional(),
});

const updateDepartmentSchema = z.object({
  name: z.string().optional(),
  category: z.string().trim().optional().nullable(),
  hodUserId: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

export const getDepartments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const departments = await Department.find()
      .populate('hodUserId', 'name email employeeId status')
      .sort({ name: 1 });
    sendSuccess(res, departments, 'Departments retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const createDepartment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = createDepartmentSchema.parse(req.body);

    const existing = await Department.findOne({ code: data.code.toUpperCase() });
    if (existing) {
      throw AppError.conflict('Department code already exists');
    }

    if (data.hodUserId) {
      // A brand-new department has no members yet, so only the role and status are checked
      await assertValidHod(data.hodUserId);
    }

    const dept = await Department.create({
      code: data.code.toUpperCase(),
      name: data.name,
      category: data.category,
      hodUserId: data.hodUserId || null,
      active: true,
    });

    sendSuccess(res, dept, 'Department created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateDepartment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = updateDepartmentSchema.parse(req.body);

    const dept = await Department.findById(req.params.id);
    if (!dept) {
      throw AppError.notFound('Department not found');
    }

    if (data.name) dept.name = data.name;
    if (data.category !== undefined) dept.category = data.category || undefined;
    if (data.hodUserId) {
      await assertValidHod(data.hodUserId, dept._id.toString());
    }
    if (data.hodUserId !== undefined) dept.hodUserId = (data.hodUserId || null) as any;
    if (data.active !== undefined) dept.active = data.active;

    await dept.save();

    const updated = await Department.findById(dept._id).populate('hodUserId', 'name email employeeId');
    sendSuccess(res, updated, 'Department updated successfully');
  } catch (error) {
    next(error);
  }
};
