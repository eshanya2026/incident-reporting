import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { RootCauseAnalysis } from './rca.model.js';
import { Incident } from '../incidents/incident.model.js';
import { IncidentWorkflowService } from '../incidents/incidentWorkflow.service.js';
import { AppError } from '../../common/errors/appError.js';
import { sendSuccess } from '../../common/helpers/response.js';

const saveRcaSchema = z.object({
  method: z.enum(['FIVE_WHY', 'FISHBONE', 'BOTH']).default('FIVE_WHY'),
  fiveWhy: z
    .array(
      z.object({
        sequence: z.number(),
        question: z.string().min(1),
        answer: z.string().min(1),
      })
    )
    .optional(),
  fishbone: z
    .object({
      people: z.array(z.string()).optional(),
      process: z.array(z.string()).optional(),
      equipment: z.array(z.string()).optional(),
      environment: z.array(z.string()).optional(),
      communication: z.array(z.string()).optional(),
      policy: z.array(z.string()).optional(),
      training: z.array(z.string()).optional(),
      technology: z.array(z.string()).optional(),
    })
    .optional(),
  rootCauseSummary: z.string().min(3, 'Root Cause Summary is required'),
});

export const createOrUpdateRca = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { incidentId } = req.params;
    const data = saveRcaSchema.parse(req.body);

    const incident = await Incident.findById(incidentId);
    if (!incident) {
      throw AppError.notFound('Incident record not found');
    }

    let rca = await RootCauseAnalysis.findOne({ incidentId });
    if (!rca) {
      rca = await RootCauseAnalysis.create({
        incidentId,
        method: data.method,
        fiveWhy: data.fiveWhy || [],
        fishbone: data.fishbone || {},
        rootCauseSummary: data.rootCauseSummary,
        status: 'DRAFT',
      });
    } else {
      rca.method = data.method;
      if (data.fiveWhy) rca.fiveWhy = data.fiveWhy;
      if (data.fishbone) rca.fishbone = data.fishbone as any;
      rca.rootCauseSummary = data.rootCauseSummary;
      await rca.save();
    }

    sendSuccess(res, rca, 'Root Cause Analysis saved successfully');
  } catch (error) {
    next(error);
  }
};

export const getRcaByIncident = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { incidentId } = req.params;
    const rca = await RootCauseAnalysis.findOne({ incidentId }).populate('approvedBy', 'name designation');
    if (!rca) {
      throw AppError.notFound('No RCA record found for this incident');
    }
    sendSuccess(res, rca, 'RCA record retrieved');
  } catch (error) {
    next(error);
  }
};

export const approveRca = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw AppError.unauthorized('User not authenticated');
    }

    const { id } = req.params;
    const rca = await RootCauseAnalysis.findById(id);
    if (!rca) {
      throw AppError.notFound('RCA record not found');
    }

    rca.status = 'APPROVED';
    rca.approvedBy = req.user.userId as any;
    rca.approvedAt = new Date();
    await rca.save();

    const incident = await Incident.findById(rca.incidentId);
    if (incident && incident.status === 'RCA_REQUIRED') {
      await IncidentWorkflowService.transition({
        incidentId: incident._id.toString(),
        targetStatus: 'CAPA_IN_PROGRESS',
        actorUserId: req.user.userId,
        remarks: 'RCA Approved by Quality Admin',
        req,
      });
    }

    sendSuccess(res, rca, 'RCA approved successfully');
  } catch (error) {
    next(error);
  }
};
