import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Department } from './department.model.js';
import { AppError } from '../../common/errors/appError.js';
import { sendSuccess } from '../../common/helpers/response.js';
import { changeDepartmentHod } from './departmentHod.service.js';
import { recordAuditLog } from '../audit/audit.service.js';

const HOD_POPULATE = 'name email employeeId status designation';

/** Changes (or removes) a department's HOD and records who did it. */
const applyHodChange = async (req: Request, departmentId: string, hodUserId: string | null): Promise<void> => {
  const { previousHodId, handedOver } = await changeDepartmentHod(departmentId, hodUserId);
  if (previousHodId === hodUserId) return;
  await recordAuditLog({
    userId: req.user!.userId,
    action: hodUserId ? 'DEPARTMENT_HOD_CHANGED' : 'DEPARTMENT_HOD_REMOVED',
    entityType: 'DEPARTMENT',
    entityId: departmentId,
    previousValue: { hodUserId: previousHodId },
    newValue: { hodUserId, openIncidentsHandedOver: handedOver },
    req,
  });
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
      .populate('hodUserId', HOD_POPULATE)
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

    const dept = await Department.create({
      code: data.code.toUpperCase(),
      name: data.name,
      category: data.category,
      active: true,
    });
    if (data.hodUserId) await applyHodChange(req, dept._id.toString(), data.hodUserId);

    sendSuccess(res, await Department.findById(dept._id).populate('hodUserId', HOD_POPULATE), 'Department created successfully', 201);
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
    if (data.active !== undefined) dept.active = data.active;
    await dept.save();

    if (data.hodUserId !== undefined) await applyHodChange(req, dept._id.toString(), data.hodUserId || null);

    const updated = await Department.findById(dept._id).populate('hodUserId', HOD_POPULATE);
    sendSuccess(res, updated, 'Department updated successfully');
  } catch (error) {
    next(error);
  }
};
