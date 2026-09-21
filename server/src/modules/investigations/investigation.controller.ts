import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Investigation } from './investigation.model.js';
import { RootCauseAnalysis } from '../rca/rca.model.js';
import { IncidentWorkflowService } from '../incidents/incidentWorkflow.service.js';
import { AppError } from '../../common/errors/appError.js';
import { sendSuccess } from '../../common/helpers/response.js';
import { loadIncidentForView, loadIncidentForWork } from '../../common/helpers/incidentAccess.js';
import { IIncident } from '../incidents/incident.model.js';
import { assertAttachmentsUsable, linkAttachments } from '../attachments/attachmentAccess.js';

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

// The HOD can edit the investigation while working on the incident, not once it is with Quality
const EDITABLE_STATUSES = ['UNDER_INVESTIGATION', 'CAPA_IN_PROGRESS'];

const assertEditable = (incident: IIncident): void => {
  if (!EDITABLE_STATUSES.includes(incident.status)) {
    throw AppError.conflict(`The investigation cannot be changed while the incident is ${incident.status}`);
  }
};

/** Validates evidence files (uploaded by this user, not linked elsewhere) before saving. */
const checkEvidence = (req: Request, investigation: any, data: z.infer<typeof saveInvestigationSchema>) =>
  assertAttachmentsUsable(data.evidence, req.user!.userId, 'INVESTIGATION', investigation._id);

const applyInvestigationFields = (investigation: any, data: z.infer<typeof saveInvestigationSchema>): void => {
  if (data.facts !== undefined) investigation.facts = data.facts;
  if (data.chronology !== undefined) investigation.chronology = data.chronology;
  if (data.peopleInterviewed !== undefined) investigation.peopleInterviewed = data.peopleInterviewed;
  if (data.contributingFactors !== undefined) investigation.contributingFactors = data.contributingFactors;
  if (data.immediateCorrections !== undefined) investigation.immediateCorrections = data.immediateCorrections;
  if (data.evidence !== undefined) investigation.evidence = data.evidence;
  if (data.findings !== undefined) investigation.findings = data.findings;
  if (data.recommendation !== undefined) investigation.recommendation = data.recommendation;
};

/** HOD starts the investigation: ASSIGNED → UNDER_INVESTIGATION (creates the investigation record). */
export const startInvestigation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { incidentId } = req.params;
    const incident = await loadIncidentForWork(req, incidentId as string);

    if (incident.status === 'ASSIGNED') {
      await IncidentWorkflowService.perform({ incidentId: incidentId as string, action: 'START_INVESTIGATION', user: req.user!, req });
    }

    const investigation = await Investigation.findOne({ incidentId });
    if (!investigation) {
      throw AppError.conflict(`An investigation cannot be started while the incident is ${incident.status}`);
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
    await loadIncidentForView(req, incidentId as string);
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
    const incident = await loadIncidentForWork(req, investigation.incidentId.toString());
    assertEditable(incident);
    const evidenceIds = await checkEvidence(req, investigation, data);

    applyInvestigationFields(investigation, data);
    await investigation.save();
    await linkAttachments(evidenceIds, 'INVESTIGATION', investigation._id);

    sendSuccess(res, investigation, 'Investigation draft saved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * HOD completes the investigation. For severity 4–5 the RCA must be completed first.
 * When CAPA is required (severity ≥ 3) the incident moves on to CAPA_IN_PROGRESS;
 * otherwise the HOD can submit it for Quality review next.
 */
export const completeInvestigation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = saveInvestigationSchema.parse(req.body ?? {});

    const investigation = await Investigation.findById(req.params.id);
    if (!investigation) {
      throw AppError.notFound('Investigation record not found');
    }
    const incident = await loadIncidentForWork(req, investigation.incidentId.toString());
    assertEditable(incident);
    const evidenceIds = await checkEvidence(req, investigation, data);

    applyInvestigationFields(investigation, data);
    if (!investigation.findings || investigation.findings.trim() === '') {
      throw AppError.badRequest('Investigation findings are required to complete investigation');
    }
    if (incident.requiresRca) {
      const rca = await RootCauseAnalysis.findOne({ incidentId: incident._id });
      if (rca?.status !== 'COMPLETED') {
        throw AppError.badRequest('Complete the RCA before completing the investigation (required for severity 4 and 5)');
      }
    }

    investigation.status = 'COMPLETED';
    investigation.completedAt = investigation.completedAt ?? new Date();
    await investigation.save();
    await linkAttachments(evidenceIds, 'INVESTIGATION', investigation._id);

    if (incident.status === 'UNDER_INVESTIGATION' && incident.requiresCapa) {
      await IncidentWorkflowService.perform({
        incidentId: incident._id.toString(),
        action: 'COMPLETE_INVESTIGATION',
        user: req.user!,
        req,
      });
    }

    sendSuccess(res, investigation, 'Investigation completed successfully');
  } catch (error) {
    next(error);
  }
};
