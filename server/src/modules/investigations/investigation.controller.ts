import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Investigation } from './investigation.model.js';
import { Incident } from '../incidents/incident.model.js';
import { IncidentWorkflowService } from '../incidents/incidentWorkflow.service.js';
import { AppError } from '../../common/errors/appError.js';
import { sendSuccess } from '../../common/helpers/response.js';

const saveInvestigationSchema = z.object({
  facts: z.string().optional(),
  chronology: z.string().optional(),
  peopleInterviewed: z
    .array(
      z.object({
        name: z.string().min(1),
        designation: z.string().min(1),
        statement: z.string().optional(),
      })
    )
    .optional(),
  contributingFactors: z.array(z.string()).optional(),
  immediateCorrections: z.string().optional(),
  evidence: z.array(z.string()).optional(),
  findings: z.string().optional(),
  recommendation: z.string().optional(),
});

export const startInvestigation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw AppError.unauthorized('User not authenticated');
    }

    const { incidentId } = req.params;

    const incident = await Incident.findById(incidentId);
    if (!incident) {
      throw AppError.notFound('Incident record not found');
    }

    let investigation = await Investigation.findOne({ incidentId });
    if (!investigation) {
      // Due date 7 days from now by default
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);

      investigation = await Investigation.create({
        incidentId,
        investigatorId: req.user.userId,
        startedAt: new Date(),
        dueDate,
        status: 'IN_PROGRESS',
      });
    }

    // Transition incident status to UNDER_INVESTIGATION using workflow engine
    if (incident.status !== 'UNDER_INVESTIGATION') {
      await IncidentWorkflowService.transition({
        incidentId: incidentId as string,
        targetStatus: 'UNDER_INVESTIGATION',
        actorUserId: req.user.userId,
        additionalUpdates: { investigatorId: req.user.userId as any },
        req,
      });
    }

    sendSuccess(res, investigation, 'Investigation started successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const getInvestigationByIncident = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { incidentId } = req.params;
    const investigation = await Investigation.findOne({ incidentId })
      .populate('investigatorId', 'name email designation')
      .populate('evidence');

    if (!investigation) {
      throw AppError.notFound('No investigation record found for this incident');
    }

    sendSuccess(res, investigation, 'Investigation record retrieved');
  } catch (error) {
    next(error);
  }
};

export const updateInvestigation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = saveInvestigationSchema.parse(req.body);

    const investigation = await Investigation.findById(req.params.id);
    if (!investigation) {
      throw AppError.notFound('Investigation record not found');
    }

    if (data.facts !== undefined) investigation.facts = data.facts;
    if (data.chronology !== undefined) investigation.chronology = data.chronology;
    if (data.peopleInterviewed !== undefined) investigation.peopleInterviewed = data.peopleInterviewed;
    if (data.contributingFactors !== undefined) investigation.contributingFactors = data.contributingFactors;
    if (data.immediateCorrections !== undefined) investigation.immediateCorrections = data.immediateCorrections;
    if (data.evidence !== undefined) investigation.evidence = data.evidence as any;
    if (data.findings !== undefined) investigation.findings = data.findings;
    if (data.recommendation !== undefined) investigation.recommendation = data.recommendation;

    await investigation.save();

    sendSuccess(res, investigation, 'Investigation draft saved successfully');
  } catch (error) {
    next(error);
  }
};

export const completeInvestigation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw AppError.unauthorized('User not authenticated');
    }

    const investigation = await Investigation.findById(req.params.id);
    if (!investigation) {
      throw AppError.notFound('Investigation record not found');
    }

    if (req.body) {
      if (req.body.findings) investigation.findings = req.body.findings;
      if (req.body.recommendation) investigation.recommendation = req.body.recommendation;
      if (req.body.contributingFactors) investigation.contributingFactors = req.body.contributingFactors;
      if (req.body.immediateCorrections) investigation.immediateCorrections = req.body.immediateCorrections;
    }

    if (!investigation.findings || investigation.findings.trim() === '') {
      throw AppError.badRequest('Investigation findings are required to complete investigation');
    }

    investigation.status = 'COMPLETED';
    investigation.completedAt = new Date();
    await investigation.save();

    const incident = await Incident.findById(investigation.incidentId);

    if (incident) {
      let targetStatus: any = 'CAPA_IN_PROGRESS';
      if (incident.requiresRca) {
        targetStatus = 'RCA_REQUIRED';
      } else if (!incident.requiresCapa) {
        targetStatus = 'READY_FOR_CLOSURE';
      }

      await IncidentWorkflowService.transition({
        incidentId: incident._id.toString(),
        targetStatus,
        actorUserId: req.user.userId,
        remarks: 'Investigation completed',
        req,
      });
    }

    sendSuccess(res, investigation, 'Investigation completed successfully');
  } catch (error) {
    next(error);
  }
};
