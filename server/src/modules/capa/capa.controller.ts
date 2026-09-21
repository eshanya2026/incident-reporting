import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Capa, CapaStatus } from './capa.model.js';
import { RootCauseAnalysis } from '../rca/rca.model.js';
import { AppError } from '../../common/errors/appError.js';
import { sendSuccess } from '../../common/helpers/response.js';
import { getNextSequence } from '../../common/models/counter.model.js';
import { hasPermission, loadIncidentForView, loadIncidentForWork } from '../../common/helpers/incidentAccess.js';
import { PERMISSIONS } from '../../common/enums/permissions.js';
import { assertAttachmentsUsable, linkAttachments } from '../attachments/attachmentAccess.js';

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const targetDate = z.coerce
  .date({ errorMap: () => ({ message: 'Target date must be a valid date' }) })
  .refine((d) => d >= startOfToday(), 'Target date cannot be in the past');

const capaFields = {
  type: z.enum(['CORRECTIVE', 'PREVENTIVE']),
  action: z.string().trim().min(3, 'CAPA action description is required'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  targetDate,
};

const createCapaSchema = z.object({ ...capaFields, priority: capaFields.priority.default('MEDIUM') });

const updateCapaSchema = z
  .object(capaFields)
  .partial()
  .refine((d) => Object.keys(d).length > 0, 'Nothing to update');

const capaDoneSchema = z.object({
  completionRemarks: z.string().trim().min(3, 'Completion remarks are required'),
  evidence: z.array(z.string()).optional(),
});

/** Loads a CAPA the current HOD may change: their department's incident, in CAPA_IN_PROGRESS, CAPA still OPEN. */
const loadOpenCapaForWork = async (req: Request, verb: string) => {
  const capa = await Capa.findById(req.params.id);
  if (!capa) {
    throw AppError.notFound('CAPA record not found');
  }
  const incident = await loadIncidentForWork(req, capa.incidentId.toString());
  if (incident.status !== 'CAPA_IN_PROGRESS') {
    throw AppError.conflict(`CAPA actions cannot be ${verb} while the incident is ${incident.status}`);
  }
  if (capa.status !== 'OPEN') {
    throw AppError.conflict(`A CAPA in status ${capa.status} cannot be ${verb}`);
  }
  return capa;
};


/** HOD of the responsible department writes a CAPA action while the incident is in CAPA_IN_PROGRESS. */
export const createCapa = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { incidentId } = req.params;
    const data = createCapaSchema.parse(req.body);

    const incident = await loadIncidentForWork(req, incidentId as string);
    if (incident.status !== 'CAPA_IN_PROGRESS') {
      throw AppError.conflict(
        `CAPA actions can be added once the investigation is complete; the incident is ${incident.status}`
      );
    }

    const rca = await RootCauseAnalysis.findOne({ incidentId });

    const year = new Date().getFullYear();
    const seq = await getNextSequence(`capa_${year}`);
    const capaNumber = `CAPA-${year}-${seq.toString().padStart(6, '0')}`;

    const capa = await Capa.create({
      capaNumber,
      incidentId,
      rcaId: rca?._id || undefined,
      type: data.type,
      action: data.action,
      ownerUserId: req.user!.userId,
      ownerDepartmentId: incident.departmentId,
      priority: data.priority,
      assignedDate: new Date(),
      targetDate: data.targetDate,
      status: 'OPEN',
    });

    sendSuccess(res, capa, 'CAPA action created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const getCapasByIncident = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { incidentId } = req.params;
    await loadIncidentForView(req, incidentId as string);
    const capas = await Capa.find({ incidentId })
      .populate('ownerUserId', 'name email designation')
      .populate('ownerDepartmentId', 'name code')
      .populate('evidence')
      .populate('verification.verifiedBy', 'name designation');

    sendSuccess(res, capas, 'CAPAs retrieved for incident');
  } catch (error) {
    next(error);
  }
};

export const getAllCapas = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const status = req.query.status as CapaStatus;
    const ownerUserId = req.query.ownerUserId as string;
    const ownerDepartmentId = req.query.ownerDepartmentId as string;

    const query: any = {};

    if (status) query.status = status;
    if (ownerUserId) query.ownerUserId = ownerUserId;
    if (ownerDepartmentId) query.ownerDepartmentId = ownerDepartmentId;

    // HODs only see CAPAs owned by their department (applied last so filters cannot widen it)
    if (!hasPermission(req.user, PERMISSIONS.REPORT_VIEW_ALL)) {
      if (req.user?.departmentId) {
        query.ownerDepartmentId = req.user.departmentId;
      } else {
        query.ownerUserId = req.user?.userId;
      }
    }

    const total = await Capa.countDocuments(query);
    const capas = await Capa.find(query)
      .populate('incidentId', 'incidentNumber title severity status')
      .populate('ownerUserId', 'name email designation')
      .populate('ownerDepartmentId', 'name code')
      .sort({ targetDate: 1 })
      .skip((page - 1) * limit)
      .limit(limit);

    sendSuccess(res, capas, 'CAPA list retrieved successfully', 200, {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
};

/** HOD edits a CAPA action that is still open. */
export const updateCapa = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = updateCapaSchema.parse(req.body);
    const capa = await loadOpenCapaForWork(req, 'edited');
    if (data.targetDate && data.targetDate.getTime() !== capa.targetDate.getTime()) {
      // New deadline: remind again if this one is missed too
      capa.overdueNotifiedAt = undefined;
    }
    Object.assign(capa, data);
    await capa.save();
    sendSuccess(res, capa, 'CAPA action updated');
  } catch (error) {
    next(error);
  }
};

/** HOD marks a CAPA action as carried out: OPEN → DONE. Quality judges its effectiveness at review. */
export const markCapaDone = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = capaDoneSchema.parse(req.body);
    const capa = await loadOpenCapaForWork(req, 'marked done');
    const evidenceIds = await assertAttachmentsUsable(data.evidence, req.user!.userId, 'CAPA', capa._id);

    capa.status = 'DONE';
    capa.completionRemarks = data.completionRemarks;
    capa.completedAt = new Date();
    if (data.evidence) {
      capa.evidence = evidenceIds as any;
    }
    await capa.save();
    await linkAttachments(evidenceIds, 'CAPA', capa._id);

    sendSuccess(res, capa, 'CAPA marked done');
  } catch (error) {
    next(error);
  }
};
