import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Location } from './location.model.js';
import { AppError } from '../../common/errors/appError.js';
import { sendSuccess } from '../../common/helpers/response.js';

const createLocationSchema = z.object({
  code: z.string().min(1, 'Location code is required'),
  name: z.string().min(1, 'Location name is required'),
  type: z.enum(['WARD', 'ROOM', 'OT', 'ICU', 'LAB', 'OPD', 'OTHER']),
  floor: z.enum(['Floor 1', 'Floor 2', 'Floor 3', 'Floor 4', 'Floor 5']).optional(),
  zone: z.enum(['Zone-1', 'Zone-B', 'Zone-C']).optional(),
  departmentId: z.string().optional(),
  parentLocationId: z.string().optional(),
});

const updateLocationSchema = z.object({
  name: z.string().optional(),
  type: z.enum(['WARD', 'ROOM', 'OT', 'ICU', 'LAB', 'OPD', 'OTHER']).optional(),
  floor: z.enum(['Floor 1', 'Floor 2', 'Floor 3', 'Floor 4', 'Floor 5']).optional(),
  zone: z.enum(['Zone-1', 'Zone-B', 'Zone-C']).optional(),
  departmentId: z.string().optional().nullable(),
  parentLocationId: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

export const getLocations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const departmentId = req.query.departmentId as string;
    const floor = req.query.floor as string;
    const zone = req.query.zone as string;
    const query: any = {};
    if (departmentId) query.departmentId = departmentId;
    if (floor) query.floor = floor;
    if (zone) query.zone = zone;

    const locations = await Location.find(query)
      .populate('departmentId', 'name code')
      .populate('parentLocationId', 'name code')
      .sort({ floor: 1, zone: 1, name: 1 });

    sendSuccess(res, locations, 'Locations retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const createLocation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = createLocationSchema.parse(req.body);

    const existing = await Location.findOne({ code: data.code.toUpperCase() });
    if (existing) {
      throw AppError.conflict('Location code already exists');
    }

    const loc = await Location.create({
      code: data.code.toUpperCase(),
      name: data.name,
      type: data.type,
      floor: data.floor || null,
      zone: data.zone || null,
      departmentId: data.departmentId || null,
      parentLocationId: data.parentLocationId || null,
      active: true,
    });

    sendSuccess(res, loc, 'Location created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateLocation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = updateLocationSchema.parse(req.body);

    const loc = await Location.findById(req.params.id);
    if (!loc) {
      throw AppError.notFound('Location not found');
    }

    if (data.name) loc.name = data.name;
    if (data.type) loc.type = data.type;
    if (data.floor !== undefined) loc.floor = data.floor;
    if (data.zone !== undefined) loc.zone = data.zone;
    if (data.departmentId !== undefined) loc.departmentId = data.departmentId as any;
    if (data.parentLocationId !== undefined) loc.parentLocationId = data.parentLocationId as any;
    if (data.active !== undefined) loc.active = data.active;

    await loc.save();

    const updated = await Location.findById(loc._id)
      .populate('departmentId', 'name code')
      .populate('parentLocationId', 'name code');

    sendSuccess(res, updated, 'Location updated successfully');
  } catch (error) {
    next(error);
  }
};
