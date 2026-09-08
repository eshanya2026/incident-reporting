import { Incident, IncidentStatus, IIncident } from './incident.model.js';
import { AppError } from '../../common/errors/appError.js';
import { recordAuditLog } from '../audit/audit.service.js';
import { Request } from 'express';

const allowedTransitions: Record<IncidentStatus, IncidentStatus[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['TRIAGED', 'HOD_REVIEW', 'UNDER_INVESTIGATION', 'RETURNED_FOR_INFORMATION', 'CANCELLED'],
  TRIAGED: ['HOD_REVIEW', 'UNDER_INVESTIGATION', 'RETURNED_FOR_INFORMATION', 'CANCELLED'],
  HOD_REVIEW: ['UNDER_INVESTIGATION', 'RETURNED_FOR_INFORMATION', 'CANCELLED'],
  UNDER_INVESTIGATION: ['RCA_REQUIRED', 'CAPA_IN_PROGRESS', 'READY_FOR_CLOSURE', 'RETURNED_FOR_INFORMATION'],
  RCA_REQUIRED: ['CAPA_IN_PROGRESS', 'UNDER_INVESTIGATION'],
  CAPA_IN_PROGRESS: ['EFFECTIVENESS_REVIEW', 'READY_FOR_CLOSURE'],
  EFFECTIVENESS_REVIEW: ['READY_FOR_CLOSURE', 'CAPA_IN_PROGRESS'],
  READY_FOR_CLOSURE: ['CLOSED', 'UNDER_INVESTIGATION'],
  CLOSED: ['REOPENED'],
  REOPENED: ['UNDER_INVESTIGATION'],
  RETURNED_FOR_INFORMATION: ['SUBMITTED', 'CANCELLED'],
  CANCELLED: [],
};

export interface TransitionParams {
  incidentId: string;
  targetStatus: IncidentStatus;
  actorUserId: string;
  remarks?: string;
  additionalUpdates?: Partial<IIncident>;
  req?: Request;
}

export class IncidentWorkflowService {
  static async transition(params: TransitionParams): Promise<IIncident> {
    const incident = await Incident.findById(params.incidentId);

    if (!incident) {
      throw AppError.notFound('Incident record not found');
    }

    const currentStatus = incident.status;
    const allowed = allowedTransitions[currentStatus] || [];

    if (!allowed.includes(params.targetStatus)) {
      throw AppError.badRequest(
        `Invalid status transition from '${currentStatus}' to '${params.targetStatus}'.`
      );
    }

    const previousStatus = incident.status;
    incident.status = params.targetStatus;

    if (params.additionalUpdates) {
      Object.assign(incident, params.additionalUpdates);
    }

    if (params.targetStatus === 'CLOSED') {
      incident.closedAt = new Date();
      incident.closedBy = params.actorUserId as any;
      if (params.remarks) {
        incident.closureRemarks = params.remarks;
      }
    }

    await incident.save();

    // Record audit log
    await recordAuditLog({
      userId: params.actorUserId,
      action: `INCIDENT_STATUS_TRANSITION_${params.targetStatus}`,
      entityType: 'INCIDENT',
      entityId: incident._id.toString(),
      previousValue: { status: previousStatus },
      newValue: { status: params.targetStatus, remarks: params.remarks },
      req: params.req,
    });

    return incident;
  }
}
