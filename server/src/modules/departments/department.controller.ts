import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Department } from './department.model.js';
import { AppError } from '../../common/errors/appError.js';
import { sendSuccess } from '../../common/helpers/response.js';

const createDepartmentSchema = z.object({
  code: z.string().min(1, 'Department code is required'),
  name: z.string().min(1, 'Department name is required'),
  hodUserId: z.string().optional(),
});

const updateDepartmentSchema = z.object({
  name: z.string().optional(),
  hodUserId: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

export const getDepartments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const departments = await Department.find().populate('hodUserId', 'name email employeeId').sort({ name: 1 });
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
    if (data.hodUserId !== undefined) dept.hodUserId = data.hodUserId as any;
    if (data.active !== undefined) dept.active = data.active;

    await dept.save();

    const updated = await Department.findById(dept._id).populate('hodUserId', 'name email employeeId');
    sendSuccess(res, updated, 'Department updated successfully');
  } catch (error) {
    next(error);
  }
};
