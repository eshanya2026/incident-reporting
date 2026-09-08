import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { User } from './user.model.js';
import { AppError } from '../../common/errors/appError.js';
import { sendSuccess } from '../../common/helpers/response.js';
import { hashPassword } from '../auth/auth.utils.js';

const createUserSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().optional(),
  departmentId: z.string().optional(),
  designation: z.string().optional(),
  roles: z.array(z.string()).min(1, 'At least one role must be assigned'),
});

const updateUserSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  departmentId: z.string().optional(),
  designation: z.string().optional(),
  roles: z.array(z.string()).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'LOCKED']).optional(),
});

export const getUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const search = req.query.search as string;
    const departmentId = req.query.departmentId as string;

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

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select('-passwordHash')
      .populate('roles', 'name code')
      .populate('departmentId', 'name code')
      .sort({ createdAt: -1 })
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
    const user = await User.findById(req.params.id)
      .select('-passwordHash')
      .populate('roles')
      .populate('departmentId');

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

    const passwordHash = await hashPassword(data.password);

    const user = await User.create({
      employeeId: data.employeeId,
      name: data.name,
      email: data.email.toLowerCase(),
      username: data.username.toLowerCase(),
      passwordHash,
      phone: data.phone,
      departmentId: data.departmentId || null,
      designation: data.designation,
      roles: data.roles,
      status: 'ACTIVE',
    });

    const populatedUser = await User.findById(user._id).select('-passwordHash').populate('roles').populate('departmentId');
    sendSuccess(res, populatedUser, 'User created successfully', 201);
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

    if (data.name) user.name = data.name;
    if (data.email) user.email = data.email.toLowerCase();
    if (data.phone !== undefined) user.phone = data.phone;
    if (data.departmentId !== undefined) user.departmentId = data.departmentId as any;
    if (data.designation !== undefined) user.designation = data.designation;
    if (data.roles) user.roles = data.roles as any;
    if (data.status) {
      user.status = data.status;
      if (data.status === 'ACTIVE') {
        user.failedLoginAttempts = 0;
      }
    }

    await user.save();

    const updatedUser = await User.findById(user._id).select('-passwordHash').populate('roles').populate('departmentId');
    sendSuccess(res, updatedUser, 'User updated successfully');
  } catch (error) {
    next(error);
  }
};
