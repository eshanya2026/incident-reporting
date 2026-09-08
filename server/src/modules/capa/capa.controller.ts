import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Capa, CapaStatus } from './capa.model.js';
import { Incident } from '../incidents/incident.model.js';
import { RootCauseAnalysis } from '../rca/rca.model.js';
import { IncidentWorkflowService } from '../incidents/incidentWorkflow.service.js';
import { AppError } from '../../common/errors/appError.js';
import { sendSuccess } from '../../common/helpers/response.js';
import { getNextSequence } from '../../common/models/counter.model.js';

const createCapaSchema = z.object({
  type: z.enum(['CORRECTIVE', 'PREVENTIVE']),
  action: z.string().min(3, 'CAPA Action description is required'),
  ownerUserId: z.string().min(1, 'CAPA owner user is required'),
  ownerDepartmentId: z.string().min(1, 'CAPA owner department is required'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  targetDate: z.string().or(z.date()),
});

const completeCapaSchema = z.object({
  completionRemarks: z.string().min(3, 'Completion remarks are required'),
  evidence: z.array(z.string()).optional(),
});

const verifyCapaSchema = z.object({
  effective: z.boolean().default(true),
  remarks: z.string().min(1, 'Verification remarks are required'),
});

export const createCapa = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { incidentId } = req.params;
    const data = createCapaSchema.parse(req.body);

    const incident = await Incident.findById(incidentId);
    if (!incident) {
      throw AppError.notFound('Incident record not found');
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
      ownerUserId: data.ownerUserId,
      ownerDepartmentId: data.ownerDepartmentId,
      priority: data.priority,
      assignedDate: new Date(),
      targetDate: new Date(data.targetDate),
      status: 'OPEN',
    });

    if (incident.status === 'UNDER_INVESTIGATION' || incident.status === 'RCA_REQUIRED') {
      await IncidentWorkflowService.transition({
        incidentId: incident._id.toString(),
        targetStatus: 'CAPA_IN_PROGRESS',
        actorUserId: req.user?.userId || '',
        remarks: 'CAPA Action created',
        req,
      });
    }

    sendSuccess(res, capa, 'CAPA action created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const getCapasByIncident = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { incidentId } = req.params;
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

    // Scope filtering if staff user
    const permissions = req.user?.permissions || [];
    if (!permissions.includes('report.view_all')) {
      if (permissions.includes('report.view_department') && req.user?.departmentId) {
        query.ownerDepartmentId = req.user.departmentId;
      } else {
        query.ownerUserId = req.user?.userId;
      }
    }

    if (status) query.status = status;
    if (ownerUserId) query.ownerUserId = ownerUserId;
    if (ownerDepartmentId) query.ownerDepartmentId = ownerDepartmentId;

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

export const completeCapa = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = completeCapaSchema.parse(req.body);

    const capa = await Capa.findById(req.params.id);
    if (!capa) {
      throw AppError.notFound('CAPA record not found');
    }

    capa.status = 'PENDING_VERIFICATION';
    capa.completionRemarks = data.completionRemarks;
    capa.completedAt = new Date();
    if (data.evidence) {
      capa.evidence = data.evidence as any;
    }
    await capa.save();

    sendSuccess(res, capa, 'CAPA completed and submitted for verification');
  } catch (error) {
    next(error);
  }
};

export const verifyCapa = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw AppError.unauthorized('User not authenticated');
    }

    const data = verifyCapaSchema.parse(req.body);

    const capa = await Capa.findById(req.params.id);
    if (!capa) {
      throw AppError.notFound('CAPA record not found');
    }

    if (data.effective) {
      capa.status = 'VERIFIED';
    } else {
      // Return to in-progress if ineffective
      capa.status = 'IN_PROGRESS';
    }

    capa.verification = {
      verifiedBy: req.user.userId as any,
      verifiedAt: new Date(),
      effective: data.effective,
      remarks: data.remarks,
    };
    await capa.save();

    // Check if ALL CAPAs for this incident are verified
    const allCapas = await Capa.find({ incidentId: capa.incidentId });
    const allVerified = allCapas.every((c) => c.status === 'VERIFIED');

    if (allVerified) {
      const incident = await Incident.findById(capa.incidentId);
      if (incident && incident.status === 'CAPA_IN_PROGRESS') {
        await IncidentWorkflowService.transition({
          incidentId: incident._id.toString(),
          targetStatus: 'EFFECTIVENESS_REVIEW',
          actorUserId: req.user.userId,
          remarks: 'All CAPAs verified effective',
          req,
        });

        await IncidentWorkflowService.transition({
          incidentId: incident._id.toString(),
          targetStatus: 'READY_FOR_CLOSURE',
          actorUserId: req.user.userId,
          remarks: 'Ready for closure',
          req,
        });
      }
    }

    sendSuccess(res, capa, 'CAPA verification recorded successfully');
  } catch (error) {
    next(error);
  }
};
