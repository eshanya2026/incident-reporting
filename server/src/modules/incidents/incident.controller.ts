import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Incident, IncidentStatus } from './incident.model.js';
import { Department } from '../departments/department.model.js';
import { Investigation } from '../investigations/investigation.model.js';
import { RootCauseAnalysis } from '../rca/rca.model.js';
import { Capa } from '../capa/capa.model.js';
import { IncidentWorkflowService } from './incidentWorkflow.service.js';
import { AppError } from '../../common/errors/appError.js';
import { sendSuccess } from '../../common/helpers/response.js';
import { getNextSequence } from '../../common/models/counter.model.js';

const severityLabels: Record<number, string> = {
  1: 'Near Miss',
  2: 'Minor Harm',
  3: 'Moderate Harm',
  4: 'Major Harm',
  5: 'Critical / Sentinel Event',
};

const createIncidentSchema = z.object({
  incidentDateTime: z.string().or(z.date()),
  departmentId: z.string().min(1, 'Department is required'),
  locationId: z.string().min(1, 'Location is required'),
  categoryId: z.string().min(1, 'Incident Category is required'),
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
  title: z.string().min(3, 'Incident title is required'),
  description: z.string().min(5, 'Incident description is required'),
  immediateAction: z.string().optional(),
  severity: z.number().min(1).max(5).default(1),
  attachments: z.array(z.string()).optional(),
});

const triageSchema = z.object({
  severity: z.number().min(1).max(5),
  remarks: z.string().optional(),
});

const assignInvestigatorSchema = z.object({
  investigatorId: z.string().min(1, 'Investigator user ID is required'),
});

const closeIncidentSchema = z.object({
  remarks: z.string().min(3, 'Closure remarks are required'),
});

export const createIncident = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw AppError.unauthorized('User not authenticated');
    }

    const data = createIncidentSchema.parse(req.body);

    const year = new Date().getFullYear();
    const seq = await getNextSequence(`incident_${year}`);
    const incidentNumber = `INC-${year}-${seq.toString().padStart(6, '0')}`;

    const dept = await Department.findById(data.departmentId);
    const assignedHod = dept?.hodUserId || undefined;

    const severity = data.severity || 1;
    const severityLabel = severityLabels[severity] || 'Near Miss';

    const requiresRca = severity >= 4;
    const requiresCapa = severity >= 3;

    const incident = await Incident.create({
      incidentNumber,
      reportedBy: req.user.userId,
      reportedAt: new Date(),
      incidentDateTime: new Date(data.incidentDateTime),
      departmentId: data.departmentId,
      locationId: data.locationId,
      categoryId: data.categoryId,
      subcategoryCode: data.subcategoryCode,
      patientInvolved: data.patientInvolved,
      patient: data.patientInvolved ? data.patient : undefined,
      title: data.title,
      description: data.description,
      immediateAction: data.immediateAction,
      severity,
      severityLabel,
      status: 'SUBMITTED',
      assignedHod,
      requiresRca,
      requiresCapa,
      attachments: data.attachments || [],
    });

    const populated = await Incident.findById(incident._id)
      .populate('reportedBy', 'name email designation employeeId')
      .populate('departmentId', 'name code')
      .populate('locationId', 'name code type')
      .populate('categoryId', 'name code')
      .populate('attachments');

    sendSuccess(res, populated, 'Incident reported successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const getIncidents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const status = req.query.status as IncidentStatus;
    const departmentId = req.query.departmentId as string;
    const categoryId = req.query.categoryId as string;
    const severity = req.query.severity ? parseInt(req.query.severity as string) : undefined;
    const search = req.query.search as string;

    const query: any = {};

    const userPermissions = req.user?.permissions || [];
    if (!userPermissions.includes('incident.read_all')) {
      if (userPermissions.includes('incident.read_department') && req.user?.departmentId) {
        query.departmentId = req.user.departmentId;
      } else if (userPermissions.includes('incident.read_own')) {
        query.reportedBy = req.user?.userId;
      }
    }

    if (status) query.status = status;
    if (departmentId) query.departmentId = departmentId;
    if (categoryId) query.categoryId = categoryId;
    if (severity) query.severity = severity;

    if (search) {
      query.$or = [
        { incidentNumber: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'patient.uhid': { $regex: search, $options: 'i' } },
        { 'patient.ipNumber': { $regex: search, $options: 'i' } },
        { 'patient.name': { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Incident.countDocuments(query);
    const incidents = await Incident.find(query)
      .populate('reportedBy', 'name designation employeeId')
      .populate('departmentId', 'name code')
      .populate('locationId', 'name code')
      .populate('categoryId', 'name code')
      .populate('assignedHod', 'name email')
      .populate('investigatorId', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    sendSuccess(res, incidents, 'Incidents retrieved successfully', 200, {
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
    const incident = await Incident.findById(req.params.id)
      .populate('reportedBy', 'name email designation employeeId phone')
      .populate('departmentId', 'name code hodUserId')
      .populate('locationId', 'name code type')
      .populate('categoryId', 'name code subcategories')
      .populate('assignedHod', 'name email designation')
      .populate('investigatorId', 'name email designation')
      .populate('closedBy', 'name email designation')
      .populate('attachments');

    if (!incident) {
      throw AppError.notFound('Incident record not found');
    }

    sendSuccess(res, incident, 'Incident details retrieved');
  } catch (error) {
    next(error);
  }
};

export const triageIncident = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw AppError.unauthorized('User not authenticated');
    }

    const { id } = req.params;
    const { severity, remarks } = triageSchema.parse(req.body);

    const incident = await Incident.findById(id);
    if (!incident) {
      throw AppError.notFound('Incident record not found');
    }

    const requiresRca = severity >= 4;
    const requiresCapa = severity >= 3;
    const severityLabel = severityLabels[severity] || 'Near Miss';

    const updated = await IncidentWorkflowService.transition({
      incidentId: id as string,
      targetStatus: 'TRIAGED',
      actorUserId: req.user.userId,
      remarks,
      additionalUpdates: {
        severity,
        severityLabel,
        requiresRca,
        requiresCapa,
      },
      req,
    });

    sendSuccess(res, updated, 'Incident triaged successfully');
  } catch (error) {
    next(error);
  }
};

export const assignInvestigator = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw AppError.unauthorized('User not authenticated');
    }

    const { id } = req.params;
    const { investigatorId } = assignInvestigatorSchema.parse(req.body);

    const incident = await Incident.findById(id);
    if (!incident) {
      throw AppError.notFound('Incident record not found');
    }

    const updated = await IncidentWorkflowService.transition({
      incidentId: id as string,
      targetStatus: 'UNDER_INVESTIGATION',
      actorUserId: req.user.userId,
      additionalUpdates: { investigatorId: investigatorId as any },
      req,
    });

    sendSuccess(res, updated, 'Investigator assigned successfully');
  } catch (error) {
    next(error);
  }
};

export const closeIncident = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw AppError.unauthorized('User not authenticated');
    }

    const { id } = req.params;
    const { remarks } = closeIncidentSchema.parse(req.body);

    const incident = await Incident.findById(id);
    if (!incident) {
      throw AppError.notFound('Incident record not found');
    }

    // Check 1: Investigation must be completed
    const inv = await Investigation.findOne({ incidentId: id });
    if (!inv || inv.status !== 'COMPLETED') {
      throw AppError.badRequest('Cannot close incident before investigation is completed');
    }

    // Check 2: If RCA required, RCA must be approved
    if (incident.requiresRca) {
      const rca = await RootCauseAnalysis.findOne({ incidentId: id });
      if (!rca || rca.status !== 'APPROVED') {
        throw AppError.badRequest('Cannot close incident before RCA is approved by Quality Admin');
      }
    }

    // Check 3: If CAPA required, all CAPAs must be VERIFIED
    if (incident.requiresCapa) {
      const capas = await Capa.find({ incidentId: id });
      if (capas.length === 0) {
        throw AppError.badRequest('Cannot close incident: at least one CAPA is required for this severity level');
      }
      const unverified = capas.filter((c) => c.status !== 'VERIFIED');
      if (unverified.length > 0) {
        throw AppError.badRequest(`Cannot close incident: ${unverified.length} CAPA action(s) are not yet verified`);
      }
    }

    const updated = await IncidentWorkflowService.transition({
      incidentId: id as string,
      targetStatus: 'CLOSED',
      actorUserId: req.user.userId,
      remarks,
      req,
    });

    sendSuccess(res, updated, 'Incident closed successfully');
  } catch (error) {
    next(error);
  }
};
