import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { RootCauseAnalysis } from './rca.model.js';
import { Investigation } from '../investigations/investigation.model.js';
import { AppError } from '../../common/errors/appError.js';
import { sendSuccess } from '../../common/helpers/response.js';
import { loadIncidentForView, loadIncidentForWork } from '../../common/helpers/incidentAccess.js';

// The HOD writes the RCA while working on the incident; Quality reviews it at the final review
const EDITABLE_STATUSES = ['UNDER_INVESTIGATION', 'CAPA_IN_PROGRESS'];

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
  // Save as a draft or mark the RCA completed (default)
  status: z.enum(['DRAFT', 'COMPLETED']).default('COMPLETED'),
});

export const createOrUpdateRca = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { incidentId } = req.params;
    const data = saveRcaSchema.parse(req.body);

    const incident = await loadIncidentForWork(req, incidentId as string);
    if (!EDITABLE_STATUSES.includes(incident.status)) {
      throw AppError.conflict(`The RCA cannot be changed while the incident is ${incident.status}`);
    }

    let rca = await RootCauseAnalysis.findOne({ incidentId });
    if (!rca) {
      const investigation = await Investigation.findOne({ incidentId }).select('_id');
      rca = await RootCauseAnalysis.create({
        incidentId,
        investigationId: investigation?._id,
        method: data.method,
        fiveWhy: data.fiveWhy || [],
        fishbone: data.fishbone || {},
        rootCauseSummary: data.rootCauseSummary,
        status: data.status,
      });
    } else {
      rca.method = data.method;
      if (data.fiveWhy) rca.fiveWhy = data.fiveWhy;
      if (data.fishbone) rca.fishbone = data.fishbone as any;
      rca.rootCauseSummary = data.rootCauseSummary;
      rca.status = data.status;
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
    await loadIncidentForView(req, incidentId as string);
    const rca = await RootCauseAnalysis.findOne({ incidentId });
    if (!rca) {
      throw AppError.notFound('No RCA record found for this incident');
    }
    sendSuccess(res, rca, 'RCA record retrieved');
  } catch (error) {
    next(error);
  }
};
