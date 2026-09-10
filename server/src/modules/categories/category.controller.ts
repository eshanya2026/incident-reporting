import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { IncidentCategory } from './category.model.js';
import { AppError } from '../../common/errors/appError.js';
import { sendSuccess } from '../../common/helpers/response.js';

const createCategorySchema = z.object({
  code: z.string().min(1, 'Category code is required'),
  name: z.string().min(1, 'Category name is required'),
  order: z.number().optional(),
  subcategories: z
    .array(
      z.object({
        code: z.string().min(1),
        name: z.string().min(1),
        active: z.boolean().default(true),
      })
    )
    .optional(),
});

export const getCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const categories = await IncidentCategory.find({ active: true }).sort({ order: 1, name: 1 });
    sendSuccess(res, categories, 'Incident categories retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = createCategorySchema.parse(req.body);

    const existing = await IncidentCategory.findOne({ code: data.code.toUpperCase() });
    if (existing) {
      throw AppError.conflict('Category code already exists');
    }

    const category = await IncidentCategory.create({
      code: data.code.toUpperCase(),
      name: data.name,
      order: data.order ?? 99,
      active: true,
      subcategories: data.subcategories || [],
    });

    sendSuccess(res, category, 'Incident category created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const addSubcategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, code } = req.body;
    if (!name) {
      throw AppError.badRequest('Subcategory name is required');
    }

    const subCode = (code || name).toUpperCase().replace(/[^A-Z0-9]/g, '_');
    const category = await IncidentCategory.findById(id);
    if (!category) {
      throw AppError.notFound('Category not found');
    }

    const exists = category.subcategories.some((sc) => sc.code === subCode);
    if (exists) {
      throw AppError.conflict('Subcategory code already exists in this category');
    }

    category.subcategories.push({ code: subCode, name, active: true });
    await category.save();

    sendSuccess(res, category, 'Subcategory added successfully', 201);
  } catch (error) {
    next(error);
  }
};
