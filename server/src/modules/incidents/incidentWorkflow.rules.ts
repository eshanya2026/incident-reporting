import { ROLE_CODES } from '../../common/enums/permissions.js';
import type { IncidentStatus } from './incident.model.js';
import type { CapaStatus } from '../capa/capa.model.js';

// Pure workflow rules: which action may move an incident from which status to which,
// who may perform it, and which conditions (gates) must hold. No database access here —
// IncidentWorkflowService loads the context and applies the result.

export const WORKFLOW_ACTIONS = [
  'REQUEST_INFO',
  'RESPOND_INFO',
  'REJECT',
  'ASSIGN',
  'RETURN_TO_QUALITY',
  'START_INVESTIGATION',
  'COMPLETE_INVESTIGATION',
  'SUBMIT_CLOSURE',
  'REVIEW_RETURN',
  'REVIEW_ACCEPT',
  'REQUEST_RCA',
  'SUBMIT_RCA',
] as const;

export type WorkflowAction = (typeof WORKFLOW_ACTIONS)[number];

/** Who may perform an action. */
export type WorkflowActor =
  | 'QUALITY' // any Quality user
  | 'REPORTER' // the Staff member who reported the incident
  | 'RESPONSIBLE_HOD' // HOD of the department the incident is currently assigned to
  | 'QUALITY_MEMBER'; // Quality Committee Member (or Quality user)

export interface WorkflowContext {
  incident: {
    status: IncidentStatus;
    reportedBy: string;
    departmentId?: string;
    requiresRca: boolean;
    requiresCapa: boolean;
  };
  actor: {
    userId: string;
    roles: string[];
    departmentId?: string;
  };
  investigation?: { status: string; findings?: string } | null;
  rca?: { status: string } | null;
  capas: Array<{ id: string; status: CapaStatus }>;
  input: {
    /** Question, response, reason, summary or remarks, depending on the action. */
    text?: string;
    /** ASSIGN: severity Quality confirms (1–4). */
    severity?: number;
    /** ASSIGN: whether the chosen department has an active HOD. */
    departmentHasActiveHod?: boolean;
  };
}

export interface TransitionRule {
  from: IncidentStatus[];
  to: IncidentStatus;
  actor: WorkflowActor;
  /** Human-readable description, used in docs and errors. */
  label: string;
  /** Returns an error message when a condition fails, or null when the action may proceed. */
  gate?: (ctx: WorkflowContext) => string | null;
}

const requireText = (what: string) => (ctx: WorkflowContext) => (ctx.input.text?.trim() ? null : `${what} is required`);

const investigationComplete = (ctx: WorkflowContext): string | null => {
  if (ctx.investigation?.status !== 'COMPLETED' || !ctx.investigation.findings?.trim()) {
    return 'The investigation must be completed with findings first';
  }
  return null;
};

const rcaIfRequired = (ctx: WorkflowContext): string | null =>
  ctx.incident.requiresRca && ctx.rca?.status !== 'COMPLETED'
    ? 'A completed RCA is required for Sentinel Event incidents'
    : null;

const firstError = (...checks: Array<string | null>): string | null => checks.find((c) => c) ?? null;

export const TRANSITIONS: Record<WorkflowAction, TransitionRule> = {
  REQUEST_INFO: {
    from: ['SUBMITTED'],
    to: 'INFO_REQUESTED',
    actor: 'QUALITY',
    label: 'Quality asks the reporter for more information',
    gate: requireText('A question for the reporter'),
  },
  RESPOND_INFO: {
    from: ['INFO_REQUESTED'],
    to: 'SUBMITTED',
    actor: 'REPORTER',
    label: 'Reporter answers and resubmits',
    gate: requireText('A response'),
  },
  REJECT: {
    from: ['SUBMITTED'],
    to: 'REJECTED',
    actor: 'QUALITY',
    label: 'Quality rejects the report',
    gate: requireText('A rejection reason'),
  },
  ASSIGN: {
    from: ['SUBMITTED'],
    to: 'ASSIGNED',
    actor: 'QUALITY',
    label: "Quality assigns the responsible department's HOD",
    gate: (ctx) => {
      const s = ctx.input.severity;
      if (!s || !Number.isInteger(s) || s < 1 || s > 4) return 'Severity must be between 1 and 4';
      if (!ctx.input.departmentHasActiveHod) return 'The selected department has no active HOD';
      return null;
    },
  },
  RETURN_TO_QUALITY: {
    from: ['ASSIGNED'],
    to: 'SUBMITTED',
    actor: 'RESPONSIBLE_HOD',
    label: 'HOD returns the incident to Quality (wrong department)',
    gate: requireText('A reason'),
  },
  START_INVESTIGATION: {
    from: ['ASSIGNED'],
    to: 'UNDER_INVESTIGATION',
    actor: 'RESPONSIBLE_HOD',
    label: 'HOD starts the investigation',
  },
  COMPLETE_INVESTIGATION: {
    from: ['UNDER_INVESTIGATION'],
    to: 'CAPA_IN_PROGRESS',
    actor: 'RESPONSIBLE_HOD',
    label: 'HOD completes the investigation and moves on to CAPA',
    gate: (ctx) => firstError(investigationComplete(ctx), rcaIfRequired(ctx)),
  },
  SUBMIT_CLOSURE: {
    // Every incident writes a CAPA before closure, regardless of severity — so this is reached
    // only via CAPA_IN_PROGRESS (COMPLETE_INVESTIGATION), never directly from UNDER_INVESTIGATION.
    from: ['CAPA_IN_PROGRESS'],
    to: 'PENDING_QUALITY_REVIEW',
    actor: 'RESPONSIBLE_HOD',
    label: 'HOD submits the incident for Quality review',
    gate: (ctx) => {
      const open = ctx.capas.filter((c) => c.status === 'OPEN').length;
      return firstError(
        investigationComplete(ctx),
        rcaIfRequired(ctx),
        ctx.capas.length === 0 ? 'At least one CAPA is required' : null,
        open ? `${open} CAPA action(s) are not marked done` : null,
        requireText('A closure summary')(ctx)
      );
    },
  },
  REVIEW_RETURN: {
    from: ['PENDING_QUALITY_REVIEW'],
    to: 'CAPA_IN_PROGRESS',
    actor: 'QUALITY',
    label: 'Quality sends the incident back to the HOD',
    // Every completed CAPA goes back to OPEN for the HOD to redo (see incidentWorkflow.service.ts)
    gate: requireText('Review remarks'),
  },
  REVIEW_ACCEPT: {
    from: ['PENDING_QUALITY_REVIEW'],
    to: 'CLOSED',
    actor: 'QUALITY',
    label: 'Quality accepts the CAPA and completes the incident',
    // Every completed CAPA is auto-marked EFFECTIVE on close (see incidentWorkflow.service.ts)
    gate: requireText('Closure remarks'),
  },
  REQUEST_RCA: {
    from: ['PENDING_QUALITY_REVIEW'],
    to: 'RCA_REQUESTED',
    actor: 'QUALITY',
    label: 'Quality requests RCA from Quality members',
    gate: requireText('Reason for requesting RCA'),
  },
  SUBMIT_RCA: {
    from: ['RCA_REQUESTED'],
    to: 'PENDING_QUALITY_REVIEW',
    actor: 'QUALITY_MEMBER',
    label: 'Quality member reports RCA findings to Quality',
    gate: (ctx) => {
      if (ctx.rca?.status !== 'COMPLETED') {
        return 'Root Cause Analysis must be completed before reporting to Quality';
      }
      return null;
    },
  },
};

export type TransitionCheck =
  | { ok: true; to: IncidentStatus }
  | { ok: false; code: 'INVALID_STATE' | 'NOT_ALLOWED' | 'GATE_FAILED'; message: string };

export const isActor = (actor: WorkflowActor, ctx: WorkflowContext): boolean => {
  const { roles = [], userId, departmentId } = ctx.actor || {};
  switch (actor) {
    case 'QUALITY':
      return roles.includes(ROLE_CODES.QUALITY);
    case 'REPORTER':
      return roles.includes(ROLE_CODES.STAFF) && userId === ctx.incident.reportedBy;
    case 'RESPONSIBLE_HOD':
      return (
        roles.includes(ROLE_CODES.HOD) && Boolean(departmentId) && departmentId === ctx.incident.departmentId
      );
    case 'QUALITY_MEMBER':
      return roles.includes(ROLE_CODES.QUALITY_MEMBER);
  }
};

const ACTOR_NAMES: Record<WorkflowActor, string> = {
  QUALITY: 'Quality',
  REPORTER: 'the staff member who reported the incident',
  RESPONSIBLE_HOD: 'the HOD of the responsible department',
  QUALITY_MEMBER: 'a Quality Member',
};

/** Checks, in order, the current status, the actor and the gate. */
export const checkTransition = (action: WorkflowAction, ctx: WorkflowContext): TransitionCheck => {
  const rule = TRANSITIONS[action];
  if (!rule.from.includes(ctx.incident.status)) {
    return {
      ok: false,
      code: 'INVALID_STATE',
      message: `Cannot ${rule.label.toLowerCase()} while the incident is ${ctx.incident.status}`,
    };
  }
  if (!isActor(rule.actor, ctx)) {
    return { ok: false, code: 'NOT_ALLOWED', message: `Only ${ACTOR_NAMES[rule.actor]} can do this` };
  }
  const gateError = rule.gate?.(ctx) ?? null;
  if (gateError) {
    return { ok: false, code: 'GATE_FAILED', message: gateError };
  }
  return { ok: true, to: rule.to };
};

/** Actions the actor could attempt from the incident's current status (ignoring gates). Used by the UI. */
export const availableActions = (ctx: Omit<WorkflowContext, 'input'>): WorkflowAction[] =>
  WORKFLOW_ACTIONS.filter((action) => {
    const rule = TRANSITIONS[action];
    return rule.from.includes(ctx.incident.status) && isActor(rule.actor, { ...ctx, input: {} });
  });
