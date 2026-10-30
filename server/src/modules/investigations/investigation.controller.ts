import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Investigation } from './investigation.model.js';
import { RootCauseAnalysis } from '../rca/rca.model.js';
import { Department } from '../departments/department.model.js';
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
const INVESTIGATION_DUE_DAYS = 7;

const idOf = (v: any): string | undefined => (v ? (v._id ?? v).toString() : undefined);

const assertEditable = (incident: IIncident): void => {
  if (!EDITABLE_STATUSES.includes(incident.status)) {
    throw AppError.conflict(`The investigation cannot be changed while the incident is ${incident.status}`);
  }
};

/** Investigations are per department — a HOD may only read/write their own department's record. */
const assertOwnDepartment = (req: Request, investigation: any): void => {
  if (idOf(investigation.departmentId) !== req.user!.departmentId) {
    throw AppError.forbidden("You can only work on your own department's investigation");
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

/**
 * HOD starts the investigation. One record per department: the first department to start also
 * moves the incident ASSIGNED → UNDER_INVESTIGATION; a department starting after that (because
 * another department already moved it on) just gets its own record alongside the others.
 */
export const startInvestigation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { incidentId } = req.params;
    const incident = await loadIncidentForWork(req, incidentId as string);
    const myDepartmentId = req.user!.departmentId;

    let investigation = await Investigation.findOne({ incidentId, departmentId: myDepartmentId });
    if (!investigation) {
      if (incident.status === 'ASSIGNED') {
        await IncidentWorkflowService.perform({ incidentId: incidentId as string, action: 'START_INVESTIGATION', user: req.user!, req });
      } else if (incident.status === 'UNDER_INVESTIGATION') {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + INVESTIGATION_DUE_DAYS);
        await Investigation.create({
          incidentId,
          departmentId: myDepartmentId,
          investigatorId: req.user!.userId,
          startedAt: new Date(),
          dueDate,
          status: 'IN_PROGRESS',
        });
      } else {
        throw AppError.conflict(`An investigation cannot be started while the incident is ${incident.status}`);
      }
      investigation = await Investigation.findOne({ incidentId, departmentId: myDepartmentId });
    }

    if (!investigation) {
      throw AppError.conflict(`An investigation cannot be started while the incident is ${incident.status}`);
    }

    sendSuccess(res, investigation, 'Investigation started successfully', 201);
  } catch (error) {
    next(error);
  }
};

/** The caller's own department's investigation (for HODs to view/edit theirs). */
export const getInvestigationByIncident = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { incidentId } = req.params;
    await loadIncidentForView(req, incidentId as string);
    const investigation = await Investigation.findOne({ incidentId, departmentId: req.user!.departmentId })
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

/** Every department's investigation on this incident, for Quality to compare side by side. */
export const getInvestigationsByIncident = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { incidentId } = req.params;
    await loadIncidentForView(req, incidentId as string);
    const investigations = await Investigation.find({ incidentId })
      .populate('departmentId', 'name code')
      .populate('investigatorId', 'name email designation')
      .populate('evidence')
      .sort({ createdAt: 1 });

    sendSuccess(res, investigations, 'Department investigations retrieved');
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
    assertOwnDepartment(req, investigation);
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
    assertOwnDepartment(req, investigation);
    assertEditable(incident);
    const evidenceIds = await checkEvidence(req, investigation, data);

    applyInvestigationFields(investigation, data);
    if (!investigation.findings || investigation.findings.trim() === '') {
      throw AppError.badRequest('Investigation findings are required to complete investigation');
    }
    if (incident.requiresRca) {
      const rca = await RootCauseAnalysis.findOne({ incidentId: incident._id });
      if (rca?.status !== 'COMPLETED') {
        throw AppError.badRequest('Complete the RCA before completing the investigation (required for Permanent Harm and Sentinel Event incidents)');
      }
    }

    investigation.status = 'COMPLETED';
    investigation.completedAt = investigation.completedAt ?? new Date();
    await investigation.save();
    await linkAttachments(evidenceIds, 'INVESTIGATION', investigation._id);

    let message = 'Investigation completed successfully';

    // Every incident writes a CAPA before closure, regardless of severity. The incident only
    // moves on to CAPA_IN_PROGRESS once every involved department's investigation is complete
    // (see investigationComplete in incidentWorkflow.rules.ts) — so this may be a no-op here if
    // other departments haven't finished theirs yet; this department's work is still saved above.
    if (incident.status === 'UNDER_INVESTIGATION') {
      try {
        await IncidentWorkflowService.perform({
          incidentId: incident._id.toString(),
          action: 'COMPLETE_INVESTIGATION',
          user: req.user!,
          req,
        });
      } catch {
        const expectedDeptIds = [incident.departmentId, ...(incident.notifiedDepartmentIds || [])]
          .filter(Boolean)
          .map((d: any) => d.toString());
        const doneInvestigations = await Investigation.find({ incidentId: incident._id, status: 'COMPLETED' });
        const doneDeptIds = new Set(doneInvestigations.map((i) => i.departmentId.toString()));
        const pendingDeptIds = expectedDeptIds.filter((id) => !doneDeptIds.has(id));
        if (pendingDeptIds.length) {
          const pendingDepts = await Department.find({ _id: { $in: pendingDeptIds } }).select('name');
          message = `Your investigation is complete. Waiting on: ${pendingDepts.map((d) => d.name).join(', ')}.`;
        }
      }
    }

    sendSuccess(res, investigation, message);
  } catch (error) {
    next(error);
  }
};
