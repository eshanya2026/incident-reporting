import mongoose from 'mongoose';
import { Request } from 'express';
import { Incident, IIncident, severityRequirements } from './incident.model.js';
import { Investigation } from '../investigations/investigation.model.js';
import { RootCauseAnalysis } from '../rca/rca.model.js';
import { Capa } from '../capa/capa.model.js';
import { Department } from '../departments/department.model.js';
import { User } from '../users/user.model.js';
import { AuditLog } from '../audit/audit.model.js';
import { recordAuditLog } from '../audit/audit.service.js';
import { notifyWorkflowEvent } from '../notifications/workflowNotifications.js';
import { AppError } from '../../common/errors/appError.js';
import { JwtPayload } from '../auth/auth.utils.js';
import {
  TRANSITIONS,
  WorkflowAction,
  WorkflowContext,
  availableActions,
  checkTransition,
} from './incidentWorkflow.rules.js';

export interface WorkflowInput {
  /** Question, response, reason, summary or remarks, depending on the action. */
  text?: string;
  /** ASSIGN */
  departmentId?: string;
  severity?: number;
  /** REVIEW_RETURN / REVIEW_ACCEPT */
  capaResults?: Array<{ capaId: string; effective: boolean; remarks?: string }>;
}

export interface PerformParams {
  incidentId: string;
  action: WorkflowAction;
  user: JwtPayload;
  input?: WorkflowInput;
  req?: Request;
}

const INVESTIGATION_DUE_DAYS = 7;
const idOf = (v: any): string | undefined => (v ? (v._id ?? v).toString() : undefined);

const loadContext = async (incident: IIncident, user: JwtPayload, input: WorkflowInput) => {
  const [investigation, rca, capas] = await Promise.all([
    Investigation.findOne({ incidentId: incident._id }),
    RootCauseAnalysis.findOne({ incidentId: incident._id }),
    Capa.find({ incidentId: incident._id }),
  ]);

  let assignHodId: mongoose.Types.ObjectId | undefined;
  if (input.departmentId) {
    const dept = await Department.findById(input.departmentId);
    if (!dept) throw AppError.badRequest('Selected department does not exist');
    const hod = dept.hodUserId ? await User.findOne({ _id: dept.hodUserId, status: 'ACTIVE' }) : null;
    assignHodId = hod?._id as mongoose.Types.ObjectId | undefined;
  }

  const ctx: WorkflowContext = {
    incident: {
      status: incident.status,
      reportedBy: idOf(incident.reportedBy)!,
      departmentId: idOf(incident.departmentId),
      requiresRca: incident.requiresRca,
      requiresCapa: incident.requiresCapa,
    },
    actor: { userId: user.userId, roles: user.roles || [], departmentId: user.departmentId },
    investigation: investigation ? { status: investigation.status, findings: investigation.findings } : null,
    rca: rca ? { status: rca.status } : null,
    capas: capas.map((c) => ({ id: c._id.toString(), status: c.status })),
    input: {
      text: input.text,
      severity: input.severity,
      departmentHasActiveHod: Boolean(assignHodId),
      capaResults: input.capaResults?.map(({ capaId, effective }) => ({ capaId, effective })),
    },
  };

  return { ctx, investigation, capas, assignHodId };
};

export class IncidentWorkflowService {
  /**
   * Performs a workflow action: checks status, actor and gate (incidentWorkflow.rules.ts),
   * applies the changes, and records the transition in the audit log.
   */
  static async perform(params: PerformParams): Promise<IIncident> {
    const { action, user, req } = params;
    const input = params.input ?? {};
    const text = input.text?.trim();

    const incident = await Incident.findById(params.incidentId);
    if (!incident) {
      throw AppError.notFound('Incident record not found');
    }

    const { ctx, investigation, capas, assignHodId } = await loadContext(incident, user, input);

    const unknownCapa = input.capaResults?.find((r) => !capas.some((c) => c._id.toString() === r.capaId));
    if (unknownCapa) {
      throw AppError.badRequest('A CAPA verdict refers to an action that does not belong to this incident');
    }

    const check = checkTransition(action, ctx);
    if (!check.ok) {
      if (check.code === 'NOT_ALLOWED') throw AppError.forbidden(check.message);
      if (check.code === 'INVALID_STATE') throw AppError.conflict(check.message);
      throw AppError.badRequest(check.message);
    }

    const previousStatus = incident.status;
    const now = new Date();
    const actorId = new mongoose.Types.ObjectId(user.userId);
    const note = { by: actorId, at: now };

    switch (action) {
      case 'REQUEST_INFO':
        incident.infoRequests.push({ question: text!, askedBy: actorId, askedAt: now });
        break;

      case 'RESPOND_INFO': {
        const open = [...incident.infoRequests].reverse().find((r) => !r.response);
        if (open) {
          open.response = text;
          open.respondedBy = actorId;
          open.respondedAt = now;
        }
        break;
      }

      case 'REJECT':
        incident.rejection = { reason: text!, ...note };
        break;

      case 'ASSIGN': {
        const severity = input.severity!;
        const departmentId = new mongoose.Types.ObjectId(input.departmentId);
        Object.assign(incident, severityRequirements(severity), {
          severity,
          departmentId,
          assignedHod: assignHodId,
          assignedBy: actorId,
          assignedAt: now,
        });
        incident.assignments.push({ departmentId, hodUserId: assignHodId!, severity, remarks: text, ...note });
        break;
      }

      case 'RETURN_TO_QUALITY':
        incident.hodReturns.push({ reason: text!, ...note });
        incident.departmentId = undefined;
        incident.assignedHod = undefined;
        break;

      case 'START_INVESTIGATION':
        if (!investigation) {
          const dueDate = new Date(now);
          dueDate.setDate(dueDate.getDate() + INVESTIGATION_DUE_DAYS);
          await Investigation.create({
            incidentId: incident._id,
            investigatorId: actorId,
            startedAt: now,
            dueDate,
            status: 'IN_PROGRESS',
          });
        }
        break;

      case 'SUBMIT_CLOSURE':
        incident.closureSubmission = { summary: text!, ...note };
        break;

      case 'REVIEW_RETURN':
      case 'REVIEW_ACCEPT': {
        for (const result of input.capaResults ?? []) {
          await Capa.updateOne(
            { _id: result.capaId },
            {
              $set: {
                status: result.effective ? 'EFFECTIVE' : 'OPEN',
                verification: {
                  verifiedBy: actorId,
                  verifiedAt: now,
                  effective: result.effective,
                  remarks: result.remarks?.trim() || text,
                },
              },
            }
          );
        }
        incident.qualityReviews.push({ decision: action === 'REVIEW_ACCEPT' ? 'ACCEPTED' : 'RETURNED', remarks: text!, ...note });
        if (action === 'REVIEW_ACCEPT') {
          incident.closedAt = now;
          incident.closedBy = actorId;
          incident.closureRemarks = text;
        }
        break;
      }

      case 'COMPLETE_INVESTIGATION':
        break;
    }

    incident.status = check.to;

    try {
      await incident.save();
    } catch (error) {
      if (error instanceof mongoose.Error.VersionError) {
        throw AppError.conflict('This incident was changed by someone else. Reload it and try again.');
      }
      throw error;
    }

    await recordAuditLog({
      userId: user.userId,
      action: `INCIDENT_${action}`,
      entityType: 'INCIDENT',
      entityId: incident._id.toString(),
      previousValue: { status: previousStatus },
      newValue: {
        status: incident.status,
        text,
        ...(action === 'ASSIGN' ? { departmentId: input.departmentId, severity: input.severity } : {}),
        ...(input.capaResults ? { capaResults: input.capaResults } : {}),
      },
      req,
    });

    // Tell the next person there is work (never blocks or undoes the action)
    await notifyWorkflowEvent(action, incident, user, text);

    return incident;
  }

  /** Records the initial submission by staff in the audit log (start of the timeline). */
  static async recordSubmission(incident: IIncident, user: JwtPayload, req?: Request): Promise<void> {
    await recordAuditLog({
      userId: user.userId,
      action: 'INCIDENT_SUBMITTED',
      entityType: 'INCIDENT',
      entityId: incident._id.toString(),
      newValue: { status: incident.status, severity: incident.initialSeverity },
      req,
    });
    await notifyWorkflowEvent('SUBMITTED', incident, user);
  }

  /** Workflow actions this user can attempt on the incident right now (gates are checked on submit). */
  static availableActions(incident: IIncident, user: JwtPayload): WorkflowAction[] {
    return availableActions({
      incident: {
        status: incident.status,
        reportedBy: idOf(incident.reportedBy)!,
        departmentId: idOf(incident.departmentId),
        requiresRca: incident.requiresRca,
        requiresCapa: incident.requiresCapa,
      },
      actor: { userId: user.userId, roles: user.roles || [], departmentId: user.departmentId },
      capas: [],
    });
  }

  /** Status history built from the audit log, oldest first. */
  static async timeline(incidentId: string) {
    const logs = await AuditLog.find({
      entityType: 'INCIDENT',
      entityId: incidentId,
      action: /^INCIDENT_/,
    })
      .sort({ timestamp: 1 })
      .populate('userId', 'name designation');

    return logs.map((log) => {
      const action = log.action.replace(/^INCIDENT_/, '');
      const rule = TRANSITIONS[action as WorkflowAction];
      return {
        action,
        label: rule?.label ?? (action === 'SUBMITTED' ? 'Staff reports the incident' : action),
        fromStatus: (log.previousValue as any)?.status,
        toStatus: (log.newValue as any)?.status,
        text: (log.newValue as any)?.text,
        by: log.userId,
        at: log.timestamp,
      };
    });
  }
}
