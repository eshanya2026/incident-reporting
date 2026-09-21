import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Incident, IIncident, INCIDENT_STATUSES, severityRequirements } from './incident.model.js';
import { Department } from '../departments/department.model.js';
import { Location } from '../locations/location.model.js';
import { IncidentWorkflowService, WorkflowInput } from './incidentWorkflow.service.js';
import { WorkflowAction } from './incidentWorkflow.rules.js';
import { AppError } from '../../common/errors/appError.js';
import { sendSuccess } from '../../common/helpers/response.js';
import { getNextSequence } from '../../common/models/counter.model.js';
import {
  canViewIncident,
  hasPermission,
  incidentScopeFilter,
  loadIncidentForView,
} from '../../common/helpers/incidentAccess.js';
import { PERMISSIONS } from '../../common/enums/permissions.js';
import { JwtPayload } from '../auth/auth.utils.js';
import { assertAttachmentsUsable, linkAttachments } from '../attachments/attachmentAccess.js';

const objectId = (what: string) =>
  z.string().refine((v) => mongoose.Types.ObjectId.isValid(v), `${what} is not a valid ID`);
const requiredText = (what: string) => z.string().trim().min(1, `${what} is required`).max(5000);

const createIncidentSchema = z.object({
  incidentDateTime: z.string().or(z.date()),
  // Where the incident happened. The responsible department is chosen later by Quality.
  occurredInDepartmentId: objectId('Department where the incident occurred'),
  locationId: objectId('Location'),
  floor: z.string().optional(),
  zone: z.string().optional(),
  categoryId: objectId('Incident category'),
  subcategoryCode: z.string().optional(),
  patientInvolved: z.boolean().default(false),
  patient: z
    .object({
      uhid: z.string().optional(),
      ipNumber: z.string().optional(),
      name: z.string().optional(),
      age: z.number().optional(),
      gender: z.string().optional(),
      ward: z.string().optional(),
      bed: z.string().optional(),
      consultant: z.string().optional(),
      admissionDate: z.string().or(z.date()).optional(),
    })
    .optional(),
  title: z.string().trim().min(3, 'Incident title is required'),
  description: z.string().trim().min(5, 'Incident description is required'),
  immediateAction: z.string().optional(),
  severity: z.number().int().min(1).max(5).default(1),
  attachments: z.array(z.string()).optional(),
});

// ---------- Response shaping ----------

const populateDetail = (query: any) =>
  query
    .populate('reportedBy', 'name email designation employeeId phone')
    .populate('departmentId', 'name code hodUserId')
    .populate('reportingDepartmentId', 'name code')
    .populate('occurredInDepartmentId', 'name code')
    .populate('locationId', 'name code type floor zone')
    .populate('categoryId', 'name code subcategories')
    .populate('assignedHod', 'name email designation')
    .populate('assignedBy', 'name designation')
    .populate('assignments.departmentId', 'name code')
    .populate('assignments.hodUserId', 'name')
    .populate('assignments.by', 'name')
    .populate('infoRequests.askedBy', 'name')
    .populate('hodReturns.by', 'name')
    .populate('closureSubmission.by', 'name')
    .populate('qualityReviews.by', 'name')
    .populate('rejection.by', 'name')
    .populate('closedBy', 'name email designation')
    .populate('attachments', 'originalName mimeType size createdAt');

const populateList = (query: any) =>
  query
    .populate('reportedBy', 'name designation employeeId')
    .populate('departmentId', 'name code')
    .populate('occurredInDepartmentId', 'name code')
    .populate('locationId', 'name code floor zone')
    .populate('categoryId', 'name code')
    .populate('assignedHod', 'name email');

/** Staff only see the parts of an incident listed here (decision D6). */
const isStaffView = (user: JwtPayload | undefined) =>
  hasPermission(user, PERMISSIONS.INCIDENT_READ_OWN) && !hasPermission(user, PERMISSIONS.INCIDENT_READ_ALL);

const pick = (obj: any, keys: string[]) => Object.fromEntries(keys.filter((k) => obj?.[k] !== undefined).map((k) => [k, obj[k]]));

const toStaffView = (incident: any) => ({
  ...pick(incident, [
    '_id',
    'incidentNumber',
    'reportedAt',
    'incidentDateTime',
    'reportedBy',
    'reportingDepartmentId',
    'occurredInDepartmentId',
    'locationId',
    'floor',
    'zone',
    'categoryId',
    'subcategoryCode',
    'patientInvolved',
    'patient',
    'title',
    'description',
    'immediateAction',
    'initialSeverity',
    'status',
    'attachments',
    'availableActions',
    'createdAt',
    'updatedAt',
  ]),
  // Current owner: the responsible department's name only
  departmentId: incident.departmentId ? pick(incident.departmentId, ['_id', 'name', 'code']) : undefined,
  infoRequests: (incident.infoRequests || []).map((r: any) => pick(r, ['_id', 'question', 'askedAt', 'response', 'respondedAt'])),
  rejection: incident.rejection ? pick(incident.rejection, ['reason', 'at']) : undefined,
  // Final closure summary (Quality's closing remarks)
  ...(incident.status === 'CLOSED' ? pick(incident, ['closureRemarks', 'closedAt']) : {}),
});

/** Full incident as returned by the API, with the actions this user can take now. */
const incidentDetail = async (id: string, user: JwtPayload): Promise<any> => {
  const incident: IIncident | null = await populateDetail(Incident.findById(id));
  if (!incident) {
    throw AppError.notFound('Incident record not found');
  }
  if (!canViewIncident(user, incident)) {
    throw AppError.forbidden('You do not have access to this incident');
  }
  const detail = { ...incident.toObject(), availableActions: IncidentWorkflowService.availableActions(incident, user) };
  return isStaffView(user) ? toStaffView(detail) : detail;
};

const shapeList = (incidents: any[], user: JwtPayload | undefined) =>
  isStaffView(user) ? incidents.map((i) => toStaffView(i.toObject())) : incidents;

// ---------- Reporting and reading ----------

/** Staff reports an incident. It goes to Quality's triage inbox (SUBMITTED). */
export const createIncident = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user!;
    const data = createIncidentSchema.parse(req.body);

    if (!(await Department.exists({ _id: data.occurredInDepartmentId }))) {
      throw AppError.badRequest('Department where the incident occurred was not found');
    }
    const loc = await Location.findById(data.locationId);
    if (!loc) {
      throw AppError.badRequest('Location not found');
    }
    const attachmentIds = await assertAttachmentsUsable(data.attachments, user.userId, 'INCIDENT');

    const year = new Date().getFullYear();
    const seq = await getNextSequence(`incident_${year}`);
    const incidentNumber = `INC-${year}-${seq.toString().padStart(6, '0')}`;

    // The reporter's severity is provisional until Quality confirms it at assignment
    const severity = data.severity;
    const floor = data.floor || loc.floor;
    const zone = data.zone || loc.zone;

    const incident = await Incident.create({
      incidentNumber,
      reportedBy: user.userId,
      reportedAt: new Date(),
      incidentDateTime: new Date(data.incidentDateTime),
      reportingDepartmentId: user.departmentId,
      occurredInDepartmentId: data.occurredInDepartmentId,
      locationId: data.locationId,
      floor,
      zone,
      categoryId: data.categoryId,
      subcategoryCode: data.subcategoryCode,
      patientInvolved: data.patientInvolved,
      patient: data.patientInvolved ? data.patient : undefined,
      title: data.title,
      description: data.description,
      immediateAction: data.immediateAction,
      initialSeverity: severity,
      severity,
      ...severityRequirements(severity),
      status: 'SUBMITTED',
      attachments: attachmentIds,
    });

    await linkAttachments(attachmentIds, 'INCIDENT', incident._id);
    await IncidentWorkflowService.recordSubmission(incident, user, req);

    sendSuccess(res, await incidentDetail(incident._id.toString(), user), 'Incident reported successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const getIncidents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 25, 200);
    const { status, departmentId, categoryId, search, mine } = req.query as Record<string, string>;
    const severity = req.query.severity ? parseInt(req.query.severity as string) : undefined;

    const query: any = { $and: [incidentScopeFilter(req.user)] };

    if (status) query.status = status;
    if (departmentId) query.departmentId = departmentId; // responsible department
    if (categoryId) query.categoryId = categoryId;
    if (severity) query.severity = severity;
    if (mine === 'true') query.reportedBy = req.user?.userId;

    if (search) {
      query.$and.push({
        $or: [
          { incidentNumber: { $regex: search, $options: 'i' } },
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { 'patient.uhid': { $regex: search, $options: 'i' } },
          { 'patient.ipNumber': { $regex: search, $options: 'i' } },
          { 'patient.name': { $regex: search, $options: 'i' } },
        ],
      });
    }

    const total = await Incident.countDocuments(query);
    const incidents = await populateList(Incident.find(query))
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    sendSuccess(res, shapeList(incidents, req.user), 'Incidents retrieved successfully', 200, {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
};

export const getIncidentById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    sendSuccess(res, await incidentDetail(req.params.id as string, req.user!), 'Incident details retrieved');
  } catch (error) {
    next(error);
  }
};

/** Status history (from the audit log). Staff see status changes and their own Q&A only. */
export const getIncidentTimeline = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const incident = await loadIncidentForView(req, req.params.id as string);
    let timeline: Array<Record<string, any>> = await IncidentWorkflowService.timeline(incident._id.toString());

    if (isStaffView(req.user)) {
      // Staff see milestones only (D6): no investigation, CAPA or review steps, no names,
      // and text only for their own Q&A, a rejection reason and the final closure remarks
      const milestonesForStaff = ['SUBMITTED', 'REQUEST_INFO', 'RESPOND_INFO', 'REJECT', 'ASSIGN', 'REVIEW_ACCEPT'];
      const textVisibleToStaff = ['REQUEST_INFO', 'RESPOND_INFO', 'REJECT', 'REVIEW_ACCEPT'];
      timeline = timeline
        .filter((t) => milestonesForStaff.includes(t.action))
        .map((t) => ({
          ...t,
          by: undefined,
          text: textVisibleToStaff.includes(t.action) ? t.text : undefined,
        }));
    }

    sendSuccess(res, timeline, 'Incident timeline retrieved');
  } catch (error) {
    next(error);
  }
};

// ---------- Work queues ----------

const QUEUE_LIMIT = 200;

/** Quality's triage inbox: new reports (default) or those waiting for the reporter (status=INFO_REQUESTED). */
export const getTriageQueue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const status = req.query.status === 'INFO_REQUESTED' ? 'INFO_REQUESTED' : 'SUBMITTED';
    const incidents = await populateList(Incident.find({ status })).sort({ reportedAt: 1 }).limit(QUEUE_LIMIT);
    sendSuccess(res, incidents, 'Triage queue retrieved', 200, { total: incidents.length });
  } catch (error) {
    next(error);
  }
};

/** Quality's review queue: incidents the HOD submitted for closure, oldest first. */
export const getReviewQueue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const incidents = await populateList(Incident.find({ status: 'PENDING_QUALITY_REVIEW' }))
      .sort({ 'closureSubmission.at': 1 })
      .limit(QUEUE_LIMIT);
    sendSuccess(res, incidents, 'Review queue retrieved', 200, { total: incidents.length });
  } catch (error) {
    next(error);
  }
};

/** HOD's queue: incidents currently assigned to their department (optionally one status). */
export const getMyDepartmentIncidents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user?.departmentId) {
      throw AppError.badRequest('Your account has no department');
    }
    const query: any = { departmentId: req.user.departmentId };
    const status = req.query.status as string;
    if (status) {
      if (!(INCIDENT_STATUSES as readonly string[]).includes(status)) {
        throw AppError.badRequest('Unknown status');
      }
      query.status = status;
    }
    const incidents = await populateList(Incident.find(query)).sort({ assignedAt: 1 }).limit(QUEUE_LIMIT);
    sendSuccess(res, incidents, 'Department incidents retrieved', 200, { total: incidents.length });
  } catch (error) {
    next(error);
  }
};

// ---------- Workflow actions ----------

/**
 * Builds an endpoint for one workflow action: validates the body, checks the user may see the
 * incident (so its status is not revealed to others), performs the action through the workflow
 * service (which checks role, status and conditions) and returns the updated incident.
 */
const workflowEndpoint =
  <S extends z.ZodTypeAny>(
    schema: S,
    toAction: (body: z.infer<S>) => { action: WorkflowAction; input: WorkflowInput },
    message: string
  ) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = schema.parse(req.body ?? {});
      const incidentId = req.params.id as string;
      await loadIncidentForView(req, incidentId);
      const { action, input } = toAction(body);
      await IncidentWorkflowService.perform({ incidentId, action, user: req.user!, input, req });
      sendSuccess(res, await incidentDetail(incidentId, req.user!), message);
    } catch (error) {
      next(error);
    }
  };

/** Quality asks the reporter for more information: SUBMITTED → INFO_REQUESTED. */
export const requestInfo = workflowEndpoint(
  z.object({ question: requiredText('A question for the reporter') }),
  (b) => ({ action: 'REQUEST_INFO', input: { text: b.question } }),
  'Information requested from the reporter'
);

/** Reporter answers: INFO_REQUESTED → SUBMITTED. */
export const respondToInfoRequest = workflowEndpoint(
  z.object({ response: requiredText('A response') }),
  (b) => ({ action: 'RESPOND_INFO', input: { text: b.response } }),
  'Response sent to Quality'
);

/** Quality rejects the report: SUBMITTED → REJECTED. */
export const rejectIncident = workflowEndpoint(
  z.object({ reason: requiredText('A rejection reason') }),
  (b) => ({ action: 'REJECT', input: { text: b.reason } }),
  'Incident rejected'
);

/** Quality confirms severity and assigns the responsible department's HOD: SUBMITTED → ASSIGNED. */
export const assignIncident = workflowEndpoint(
  z.object({
    departmentId: objectId('Responsible department'),
    severity: z.number().int().min(1).max(5),
    remarks: z.string().trim().max(5000).optional(),
  }),
  (b) => ({ action: 'ASSIGN', input: { departmentId: b.departmentId, severity: b.severity, text: b.remarks } }),
  'Incident assigned to the department HOD'
);

/** HOD returns a wrongly assigned incident: ASSIGNED → SUBMITTED. */
export const returnToQuality = workflowEndpoint(
  z.object({ reason: requiredText('A reason') }),
  (b) => ({ action: 'RETURN_TO_QUALITY', input: { text: b.reason } }),
  'Incident returned to Quality'
);

/** HOD submits for Quality review: UNDER_INVESTIGATION / CAPA_IN_PROGRESS → PENDING_QUALITY_REVIEW. */
export const submitForClosure = workflowEndpoint(
  z.object({ summary: requiredText('A closure summary') }),
  (b) => ({ action: 'SUBMIT_CLOSURE', input: { text: b.summary } }),
  'Incident submitted for Quality review'
);

/** Quality reviews: ACCEPT → CLOSED, RETURN → CAPA_IN_PROGRESS. A verdict is required per completed CAPA. */
export const reviewIncident = workflowEndpoint(
  z.object({
    decision: z.enum(['ACCEPT', 'RETURN']),
    remarks: requiredText('Review remarks'),
    capaResults: z
      .array(
        z.object({
          capaId: objectId('CAPA'),
          effective: z.boolean(),
          remarks: z.string().trim().max(5000).optional(),
        })
      )
      .default([]),
  }),
  (b) => ({
    action: b.decision === 'ACCEPT' ? 'REVIEW_ACCEPT' : 'REVIEW_RETURN',
    input: { text: b.remarks, capaResults: b.capaResults },
  }),
  'Review recorded'
);
