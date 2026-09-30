import { describe, expect, it } from 'vitest';
import {
  TRANSITIONS,
  WORKFLOW_ACTIONS,
  WorkflowAction,
  WorkflowContext,
  availableActions,
  checkTransition,
} from './incidentWorkflow.rules.js';
import { INCIDENT_STATUSES, IncidentStatus } from './incident.model.js';

// People used across the tests. The incident was reported by `reporter` and is assigned to department d1.
const PEOPLE = {
  quality: { userId: 'q1', roles: ['QUALITY'], departmentId: 'dq' },
  qualityMember: { userId: 'qm1', roles: ['QUALITY_MEMBER'], departmentId: 'dq' },
  reporter: { userId: 's1', roles: ['STAFF'], departmentId: 'd9' },
  otherStaff: { userId: 's2', roles: ['STAFF'], departmentId: 'd1' },
  hod: { userId: 'h1', roles: ['HOD'], departmentId: 'd1' },
  otherHod: { userId: 'h2', roles: ['HOD'], departmentId: 'd2' },
  admin: { userId: 'a1', roles: ['ADMIN'] },
};
type Person = keyof typeof PEOPLE;

const ACTOR_FOR: Record<WorkflowAction, Person> = {
  REQUEST_INFO: 'quality',
  RESPOND_INFO: 'reporter',
  REJECT: 'quality',
  ASSIGN: 'quality',
  RETURN_TO_QUALITY: 'hod',
  START_INVESTIGATION: 'hod',
  COMPLETE_INVESTIGATION: 'hod',
  SUBMIT_CLOSURE: 'hod',
  REVIEW_RETURN: 'quality',
  REVIEW_ACCEPT: 'quality',
  REQUEST_RCA: 'quality',
  SUBMIT_RCA: 'qualityMember',
};

/** A context in which `action` succeeds; tests then change one thing at a time. */
const validContext = (action: WorkflowAction): WorkflowContext => {
  const base: WorkflowContext = {
    incident: {
      // A CAPA-required incident is submitted for closure from CAPA_IN_PROGRESS
      status: action === 'SUBMIT_CLOSURE' ? 'CAPA_IN_PROGRESS' : TRANSITIONS[action].from[0],
      reportedBy: 's1',
      departmentId: 'd1',
      requiresRca: true,
      requiresCapa: true,
    },
    actor: PEOPLE[ACTOR_FOR[action]],
    investigation: { status: 'COMPLETED', findings: 'Label missing on IV bag' },
    rca: { status: 'COMPLETED' },
    capas: [{ id: 'c1', status: 'DONE' }],
    input: { text: 'Some text' },
  };
  if (action === 'ASSIGN') base.input = { severity: 3, departmentHasActiveHod: true };
  return base;
};

const withIncident = (ctx: WorkflowContext, patch: Partial<WorkflowContext['incident']>): WorkflowContext => ({
  ...ctx,
  incident: { ...ctx.incident, ...patch },
});

const expectFail = (action: WorkflowAction, ctx: WorkflowContext, code: string, message?: RegExp) => {
  const result = checkTransition(action, ctx);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe(code);
    if (message) expect(result.message).toMatch(message);
  }
};

describe('state machine shape', () => {
  it('only REJECTED and CLOSED are final', () => {
    const withExit = new Set(WORKFLOW_ACTIONS.flatMap((a) => TRANSITIONS[a].from));
    const deadEnds = INCIDENT_STATUSES.filter((s) => !withExit.has(s));
    expect(deadEnds).toEqual(['REJECTED', 'CLOSED']);
  });

  it('every status except SUBMITTED is reachable by some action', () => {
    const reachable = new Set(WORKFLOW_ACTIONS.map((a) => TRANSITIONS[a].to));
    const unreachable = INCIDENT_STATUSES.filter((s) => !reachable.has(s));
    expect(unreachable).toEqual([]);
  });
});

describe.each(WORKFLOW_ACTIONS)('%s', (action) => {
  const rule = TRANSITIONS[action];

  it(`moves to ${rule.to} when status, actor and gate are valid`, () => {
    for (const from of rule.from) {
      const ctx = withIncident(validContext(action), { status: from });
      expect(checkTransition(action, ctx)).toEqual({ ok: true, to: rule.to });
    }
  });

  const otherStatuses = INCIDENT_STATUSES.filter((s) => !rule.from.includes(s));
  it.each(otherStatuses)('is refused while the incident is %s', (status: IncidentStatus) => {
    expectFail(action, withIncident(validContext(action), { status }), 'INVALID_STATE');
  });

  const wrongPeople = (Object.keys(PEOPLE) as Person[]).filter((p) => p !== ACTOR_FOR[action]);
  it.each(wrongPeople)('is refused for %s', (person) => {
    expectFail(action, { ...validContext(action), actor: PEOPLE[person] }, 'NOT_ALLOWED');
  });
});

describe('gates', () => {
  it.each(['REQUEST_INFO', 'RESPOND_INFO', 'REJECT', 'RETURN_TO_QUALITY', 'SUBMIT_CLOSURE', 'REVIEW_RETURN', 'REVIEW_ACCEPT', 'REQUEST_RCA'] as WorkflowAction[])(
    '%s requires text',
    (action) => {
      const ctx = validContext(action);
      ctx.input.text = '   ';
      expectFail(action, ctx, 'GATE_FAILED', /required/);
    }
  );

  describe('ASSIGN', () => {
    it.each([0, 6, 2.5, undefined])('refuses severity %s', (severity) => {
      const ctx = validContext('ASSIGN');
      ctx.input.severity = severity;
      expectFail('ASSIGN', ctx, 'GATE_FAILED', /Severity/);
    });

    it('refuses a department without an active HOD', () => {
      const ctx = validContext('ASSIGN');
      ctx.input.departmentHasActiveHod = false;
      expectFail('ASSIGN', ctx, 'GATE_FAILED', /no active HOD/);
    });
  });

  describe('COMPLETE_INVESTIGATION', () => {
    it('needs a completed investigation with findings', () => {
      const ctx = validContext('COMPLETE_INVESTIGATION');
      ctx.investigation = { status: 'IN_PROGRESS', findings: 'x' };
      expectFail('COMPLETE_INVESTIGATION', ctx, 'GATE_FAILED', /investigation/);
      ctx.investigation = { status: 'COMPLETED', findings: ' ' };
      expectFail('COMPLETE_INVESTIGATION', ctx, 'GATE_FAILED', /investigation/);
      ctx.investigation = null;
      expectFail('COMPLETE_INVESTIGATION', ctx, 'GATE_FAILED', /investigation/);
    });

    it('needs a completed RCA only when RCA is required', () => {
      const ctx = validContext('COMPLETE_INVESTIGATION');
      ctx.rca = { status: 'DRAFT' };
      expectFail('COMPLETE_INVESTIGATION', ctx, 'GATE_FAILED', /RCA/);
      ctx.incident.requiresRca = false;
      expect(checkTransition('COMPLETE_INVESTIGATION', ctx).ok).toBe(true);
    });
  });

  describe('SUBMIT_CLOSURE', () => {
    it('is refused directly from UNDER_INVESTIGATION — CAPA is always required first', () => {
      const ctx = withIncident(validContext('SUBMIT_CLOSURE'), { status: 'UNDER_INVESTIGATION' });
      expectFail('SUBMIT_CLOSURE', ctx, 'INVALID_STATE');
    });

    it('needs at least one CAPA', () => {
      const ctx = validContext('SUBMIT_CLOSURE');
      ctx.capas = [];
      expectFail('SUBMIT_CLOSURE', ctx, 'GATE_FAILED', /At least one CAPA/);
    });

    it('needs every CAPA done', () => {
      const ctx = validContext('SUBMIT_CLOSURE');
      ctx.capas = [
        { id: 'c1', status: 'DONE' },
        { id: 'c2', status: 'OPEN' },
        { id: 'c3', status: 'OPEN' },
      ];
      expectFail('SUBMIT_CLOSURE', ctx, 'GATE_FAILED', /2 CAPA action\(s\) are not marked done/);
    });

    it('accepts CAPA already found effective in an earlier review', () => {
      const ctx = validContext('SUBMIT_CLOSURE');
      ctx.capas = [
        { id: 'c1', status: 'EFFECTIVE' },
        { id: 'c2', status: 'DONE' },
      ];
      expect(checkTransition('SUBMIT_CLOSURE', ctx).ok).toBe(true);
    });

    it('needs the RCA when required and the investigation completed', () => {
      const ctx = validContext('SUBMIT_CLOSURE');
      ctx.rca = null;
      expectFail('SUBMIT_CLOSURE', ctx, 'GATE_FAILED', /RCA/);
      const ctx2 = validContext('SUBMIT_CLOSURE');
      ctx2.investigation = { status: 'IN_PROGRESS' };
      expectFail('SUBMIT_CLOSURE', ctx2, 'GATE_FAILED', /investigation/);
    });
  });

  describe('Quality review', () => {
    // Every completed CAPA is auto-marked EFFECTIVE (accept) or OPEN (return) by the service —
    // see incidentWorkflow.service.ts — so the gate itself only needs remarks, regardless of CAPAs.
    it('needs closure remarks to accept', () => {
      const ctx = validContext('REVIEW_ACCEPT');
      ctx.input.text = '';
      expectFail('REVIEW_ACCEPT', ctx, 'GATE_FAILED', /Closure remarks/);
    });

    it('needs review remarks to send back', () => {
      const ctx = validContext('REVIEW_RETURN');
      ctx.input.text = '';
      expectFail('REVIEW_RETURN', ctx, 'GATE_FAILED', /Review remarks/);
    });

    it('accepts or sends back regardless of how many CAPAs are done', () => {
      for (const action of ['REVIEW_ACCEPT', 'REVIEW_RETURN'] as WorkflowAction[]) {
        const ctx = validContext(action);
        ctx.capas = [
          { id: 'c1', status: 'DONE' },
          { id: 'c2', status: 'DONE' },
        ];
        expect(checkTransition(action, ctx).ok).toBe(true);
      }
    });

    it("doesn't choke if there happen to be no CAPAs (SUBMIT_CLOSURE prevents this in practice)", () => {
      const ctx = validContext('REVIEW_ACCEPT');
      ctx.capas = [];
      expect(checkTransition('REVIEW_ACCEPT', ctx).ok).toBe(true);
    });
  });
});

describe('responsible HOD', () => {
  it('is the HOD of the department the incident is currently assigned to', () => {
    const ctx = validContext('START_INVESTIGATION');
    expect(checkTransition('START_INVESTIGATION', ctx).ok).toBe(true);
    expectFail('START_INVESTIGATION', withIncident(ctx, { departmentId: 'd2' }), 'NOT_ALLOWED');
    expectFail('START_INVESTIGATION', withIncident(ctx, { departmentId: undefined }), 'NOT_ALLOWED');
  });

  it('staff of the responsible department cannot act as its HOD', () => {
    expectFail('START_INVESTIGATION', { ...validContext('START_INVESTIGATION'), actor: PEOPLE.otherStaff }, 'NOT_ALLOWED');
  });
});

describe('availableActions', () => {
  const ctxFor = (status: IncidentStatus, person: Person) => ({
    incident: { status, reportedBy: 's1', departmentId: status === 'SUBMITTED' ? undefined : 'd1', requiresRca: false, requiresCapa: true },
    actor: PEOPLE[person],
    capas: [],
  });

  it.each([
    ['SUBMITTED', 'quality', ['REQUEST_INFO', 'REJECT', 'ASSIGN']],
    ['SUBMITTED', 'reporter', []],
    ['INFO_REQUESTED', 'reporter', ['RESPOND_INFO']],
    ['INFO_REQUESTED', 'otherStaff', []],
    ['ASSIGNED', 'hod', ['RETURN_TO_QUALITY', 'START_INVESTIGATION']],
    ['ASSIGNED', 'otherHod', []],
    ['UNDER_INVESTIGATION', 'hod', ['COMPLETE_INVESTIGATION']],
    ['CAPA_IN_PROGRESS', 'hod', ['SUBMIT_CLOSURE']],
    ['PENDING_QUALITY_REVIEW', 'quality', ['REVIEW_RETURN', 'REVIEW_ACCEPT', 'REQUEST_RCA']],
    ['PENDING_QUALITY_REVIEW', 'hod', []],
    ['RCA_REQUESTED', 'qualityMember', ['SUBMIT_RCA']],
    ['RCA_REQUESTED', 'quality', []],
    ['CLOSED', 'quality', []],
    ['CLOSED', 'hod', []],
    ['REJECTED', 'quality', []],
  ] as Array<[IncidentStatus, Person, WorkflowAction[]]>)('%s for %s → %j', (status, person, expected) => {
    expect(availableActions(ctxFor(status, person))).toEqual(expected);
  });

  it('Admin never has workflow actions', () => {
    for (const status of INCIDENT_STATUSES) {
      expect(availableActions(ctxFor(status, 'admin'))).toEqual([]);
    }
  });
});
