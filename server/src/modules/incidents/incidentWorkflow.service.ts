import mongoose from 'mongoose';
import { Request } from 'express';
import {
  Incident,
  IIncident,
  IncidentPriority,
  PRIORITY_DEADLINE_HOURS,
  computeQualityScore,
  riskBandFor,
  severityRequirements,
} from './incident.model.js';
import { Investigation } from '../investigations/investigation.model.js';
import { RootCauseAnalysis } from '../rca/rca.model.js';
import { RcaMeeting } from '../rca/rcaMeeting.model.js';
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
  notifiedDepartmentIds?: string[];
  intimatedUserIds?: string[];
  severity?: number;
  priority?: IncidentPriority;
  /** REQUEST_RCA: optional assigned RCA Head */
  rcaHeadId?: string;
  /** REQUEST_RCA: Quality's suggested meeting date/time and location, offered to the RCA Head when scheduling. */
  rcaProposedMeetingAt?: Date;
  rcaProposedLocation?: string;
  /** REQUEST_RCA: extra HODs/Intimation Members Quality wants invited to the meeting. */
  rcaAdditionalAttendeeIds?: string[];
  /** REVIEW_RETURN: which department(s) need rework; omitted/empty returns every department. */
  departmentIds?: string[];
  /** REVIEW_ACCEPT: likelihood × severity risk assessment, required before closing. */
  riskLikelihood?: number;
  riskSeverity?: number;
  riskRationale?: string;
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
  const [investigations, rca, rcaMeeting, capas] = await Promise.all([
    Investigation.find({ incidentId: incident._id }),
    RootCauseAnalysis.findOne({ incidentId: incident._id }),
    RcaMeeting.findOne({ incidentId: incident._id }),
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
      notifiedDepartmentIds: (incident.notifiedDepartmentIds || []).map((d) => idOf(d)!),
      requiresRca: incident.requiresRca,
      requiresCapa: incident.requiresCapa,
    },
    actor: { userId: user.userId, roles: user.roles || [], departmentId: user.departmentId },
    investigations: investigations.map((i) => ({
      departmentId: idOf(i.departmentId)!,
      status: i.status,
      findings: i.findings,
    })),
    rca: rca ? { status: rca.status } : null,
    rcaMeeting: rcaMeeting ? { status: rcaMeeting.status } : null,
    capas: capas.map((c) => ({ id: c._id.toString(), status: c.status, ownerDepartmentId: idOf(c.ownerDepartmentId) })),
    input: {
      text: input.text,
      severity: input.severity,
      departmentHasActiveHod: Boolean(assignHodId),
      departmentIds: input.departmentIds,
      riskLikelihood: input.riskLikelihood,
      riskSeverity: input.riskSeverity,
      riskRationale: input.riskRationale,
    },
  };

  return { ctx, investigations, capas, assignHodId };
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

    const { ctx, investigations, capas, assignHodId } = await loadContext(incident, user, input);

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
        const notifiedDepartmentIds = (input.notifiedDepartmentIds || [])
          .filter((id) => id && id !== input.departmentId)
          .map((id) => new mongoose.Types.ObjectId(id));
        const intimatedUserIds = (input.intimatedUserIds || [])
          .filter(Boolean)
          .map((id) => new mongoose.Types.ObjectId(id));
        const actionDueAt = input.priority
          ? new Date(now.getTime() + PRIORITY_DEADLINE_HOURS[input.priority] * 60 * 60 * 1000)
          : undefined;
        Object.assign(incident, severityRequirements(severity), {
          severity,
          departmentId,
          assignedHod: assignHodId,
          assignedBy: actorId,
          assignedAt: now,
          priority: input.priority,
          actionDueAt,
          notifiedDepartmentIds,
          intimatedUserIds,
        });
        incident.assignments.push({
          departmentId,
          hodUserId: assignHodId!,
          severity,
          priority: input.priority,
          remarks: text,
          notifiedDepartmentIds,
          intimatedUserIds,
          ...note,
        });
        break;
      }

      case 'RETURN_TO_QUALITY':
        incident.hodReturns.push({ reason: text!, ...note });
        incident.departmentId = undefined;
        incident.assignedHod = undefined;
        incident.priority = undefined;
        incident.actionDueAt = undefined;
        incident.notifiedDepartmentIds = [];
        incident.intimatedUserIds = [];
        break;

      case 'START_INVESTIGATION': {
        // One investigation record per department (lead or involved) — each starts their own.
        const myDepartmentId = user.departmentId ? new mongoose.Types.ObjectId(user.departmentId) : incident.departmentId;
        const alreadyStarted = investigations.some((i) => idOf(i.departmentId) === idOf(myDepartmentId));
        if (!alreadyStarted) {
          const dueDate = new Date(now);
          dueDate.setDate(dueDate.getDate() + INVESTIGATION_DUE_DAYS);
          await Investigation.create({
            incidentId: incident._id,
            departmentId: myDepartmentId,
            investigatorId: actorId,
            startedAt: now,
            dueDate,
            status: 'IN_PROGRESS',
          });
        }
        break;
      }

      case 'SUBMIT_CLOSURE':
        incident.closureSubmission = { summary: text!, ...note };
        break;

      case 'REVIEW_RETURN':
      case 'REVIEW_ACCEPT': {
        // Accepting closes the incident, so every completed CAPA is taken as effective. Returning
        // means the opposite — but only for the department(s) Quality picked; an unselected
        // department's already-done CAPA is left alone, since it doesn't need rework.
        const accepted = action === 'REVIEW_ACCEPT';
        const returnDeptIds = !accepted && input.departmentIds?.length ? new Set(input.departmentIds) : null;
        const doneCapaIds = capas
          .filter((c) => c.status === 'DONE')
          .filter((c) => !returnDeptIds || returnDeptIds.has(idOf(c.ownerDepartmentId) || ''))
          .map((c) => c._id);
        if (doneCapaIds.length > 0) {
          await Capa.updateMany(
            { _id: { $in: doneCapaIds } },
            {
              $set: {
                status: accepted ? 'EFFECTIVE' : 'OPEN',
                verification: {
                  verifiedBy: actorId,
                  verifiedAt: now,
                  effective: accepted,
                  remarks: text,
                },
              },
            }
          );
        }
        incident.qualityReviews.push({
          decision: accepted ? 'ACCEPTED' : 'RETURNED',
          remarks: text!,
          departmentIds: returnDeptIds ? input.departmentIds!.map((id) => new mongoose.Types.ObjectId(id)) : undefined,
          ...note,
        });
        if (accepted) {
          incident.closedAt = now;
          incident.closedBy = actorId;
          incident.closureRemarks = text;
          const reworkCount =
            incident.hodReturns.length + incident.qualityReviews.filter((r) => r.decision === 'RETURNED').length;
          incident.qualityScore = computeQualityScore({
            reportedAt: incident.reportedAt,
            closedAt: now,
            severity: incident.severity,
            reworkCount,
            capaTypes: capas.map((c) => c.type),
          });
          const riskScore = input.riskLikelihood! * input.riskSeverity!;
          incident.riskAssessment = {
            likelihood: input.riskLikelihood!,
            severity: input.riskSeverity!,
            score: riskScore,
            band: riskBandFor(riskScore),
            rationale: input.riskRationale,
            assessedBy: actorId,
            assessedAt: now,
          };
        }
        break;
      }

      case 'COMPLETE_INVESTIGATION':
        break;

      case 'REQUEST_RCA':
        incident.rcaRequestedAt = now;
        incident.rcaRequestedBy = actorId;
        incident.rcaRequestRemarks = text;
        incident.requiresRca = true;
        incident.rcaProposedMeetingAt = input.rcaProposedMeetingAt;
        incident.rcaProposedLocation = input.rcaProposedLocation;
        incident.rcaAdditionalAttendeeIds = (input.rcaAdditionalAttendeeIds || []).map((id) => new mongoose.Types.ObjectId(id));
        if (input.rcaHeadId) {
          incident.rcaHeadId = new mongoose.Types.ObjectId(input.rcaHeadId);
        }
        break;

      case 'SUBMIT_RCA':
        incident.rcaSubmittedAt = now;
        incident.rcaSubmittedBy = actorId;
        incident.rcaSubmissionRemarks = text;
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
        ...(action === 'ASSIGN'
          ? {
              departmentId: input.departmentId,
              notifiedDepartmentIds: input.notifiedDepartmentIds,
              intimatedUserIds: input.intimatedUserIds,
              severity: input.severity,
              priority: input.priority,
            }
          : {}),
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
        notifiedDepartmentIds: (incident.notifiedDepartmentIds || []).map((d) => idOf(d)!),
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
