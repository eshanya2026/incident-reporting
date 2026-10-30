import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { IncidentCategory } from './category.model.js';
import { AppError } from '../../common/errors/appError.js';
import { sendSuccess } from '../../common/helpers/response.js';
import { hasPermission } from '../../common/helpers/incidentAccess.js';
import { PERMISSIONS } from '../../common/enums/permissions.js';

const createCategorySchema = z.object({
  code: z.string().min(1, 'Category code is required'),
  name: z.string().min(1, 'Category name is required'),
  domain: z.string().optional(),
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

/**
 * Everyone sees only active categories/subcategories — what a reporter should be able to pick,
 * even someone (e.g. Quality) who can also manage categories and is filing their own report.
 * Only the Master Administration screen explicitly asks for disabled ones too, with
 * ?includeInactive=true, so Admin can review and re-enable them — categories and subcategories
 * are only ever created or disabled, never deleted, since one may already be referenced by a past
 * incident.
 */
export const getCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const includeInactive = req.query.includeInactive === 'true' && hasPermission(req.user, PERMISSIONS.ADMIN_CATEGORY_MANAGE);
    const categories = await IncidentCategory.find(includeInactive ? {} : { active: true })
      .sort({ order: 1, name: 1 })
      .lean();
    const shaped = includeInactive
      ? categories
      : categories.map((c) => ({ ...c, subcategories: c.subcategories.filter((sc) => sc.active) }));
    sendSuccess(res, shaped, 'Incident categories retrieved successfully');
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
      domain: data.domain,
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

const activeSchema = z.object({ active: z.boolean() });

/** Enable/disable a category. Categories are never deleted — one may be referenced by a past incident. */
export const setCategoryActive = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { active } = activeSchema.parse(req.body);
    const category = await IncidentCategory.findByIdAndUpdate(req.params.id, { active }, { new: true });
    if (!category) {
      throw AppError.notFound('Category not found');
    }
    sendSuccess(res, category, `Category ${active ? 'enabled' : 'disabled'} successfully`);
  } catch (error) {
    next(error);
  }
};

/** Enable/disable one subcategory. Subcategories are never deleted, same reason as categories. */
export const setSubcategoryActive = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { active } = activeSchema.parse(req.body);
    const category = await IncidentCategory.findOne({ _id: req.params.id, 'subcategories.code': req.params.code });
    if (!category) {
      throw AppError.notFound('Subcategory not found');
    }
    const sub = category.subcategories.find((sc) => sc.code === req.params.code)!;
    sub.active = active;
    await category.save();
    sendSuccess(res, category, `Subcategory ${active ? 'enabled' : 'disabled'} successfully`);
  } catch (error) {
    next(error);
  }
};
