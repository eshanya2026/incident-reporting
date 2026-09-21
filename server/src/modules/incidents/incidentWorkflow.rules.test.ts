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
  if (action === 'REVIEW_RETURN') base.input.capaResults = [{ capaId: 'c1', effective: false }];
  if (action === 'REVIEW_ACCEPT') base.input.capaResults = [{ capaId: 'c1', effective: true }];
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
      if (action === 'SUBMIT_CLOSURE' && from === 'UNDER_INVESTIGATION') ctx.incident.requiresCapa = false;
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
  it.each(['REQUEST_INFO', 'RESPOND_INFO', 'REJECT', 'RETURN_TO_QUALITY', 'SUBMIT_CLOSURE', 'REVIEW_RETURN', 'REVIEW_ACCEPT'] as WorkflowAction[])(
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
    it('is not used when CAPA is not required', () => {
      expectFail('COMPLETE_INVESTIGATION', withIncident(validContext('COMPLETE_INVESTIGATION'), { requiresCapa: false }), 'GATE_FAILED', /not required/);
    });

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
    it('from UNDER_INVESTIGATION only when CAPA is not required', () => {
      const ctx = withIncident(validContext('SUBMIT_CLOSURE'), { status: 'UNDER_INVESTIGATION' });
      expectFail('SUBMIT_CLOSURE', ctx, 'GATE_FAILED', /CAPA before submitting/);
      ctx.incident.requiresCapa = false;
      ctx.incident.requiresRca = false;
      ctx.rca = null;
      ctx.capas = [];
      expect(checkTransition('SUBMIT_CLOSURE', ctx).ok).toBe(true);
    });

    it('needs at least one CAPA when CAPA is required', () => {
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
    it('needs a verdict for every CAPA marked done', () => {
      for (const action of ['REVIEW_ACCEPT', 'REVIEW_RETURN'] as WorkflowAction[]) {
        const ctx = validContext(action);
        ctx.capas = [
          { id: 'c1', status: 'DONE' },
          { id: 'c2', status: 'DONE' },
        ];
        expectFail(action, ctx, 'GATE_FAILED', /verdict is required for every completed CAPA \(1 missing\)/);
      }
    });

    it('cannot accept while any CAPA is not effective', () => {
      const ctx = validContext('REVIEW_ACCEPT');
      ctx.input.capaResults = [{ capaId: 'c1', effective: false }];
      expectFail('REVIEW_ACCEPT', ctx, 'GATE_FAILED', /send the incident back/);
    });

    it('counts CAPA accepted in an earlier review as effective', () => {
      const ctx = validContext('REVIEW_ACCEPT');
      ctx.capas = [
        { id: 'c0', status: 'EFFECTIVE' },
        { id: 'c1', status: 'DONE' },
      ];
      expect(checkTransition('REVIEW_ACCEPT', ctx).ok).toBe(true);
    });

    it('accepts a low-severity incident with no CAPA', () => {
      const ctx = validContext('REVIEW_ACCEPT');
      ctx.capas = [];
      ctx.input.capaResults = [];
      expect(checkTransition('REVIEW_ACCEPT', ctx).ok).toBe(true);
    });

    it('can send back even when every CAPA was effective, with remarks', () => {
      const ctx = validContext('REVIEW_RETURN');
      ctx.input.capaResults = [{ capaId: 'c1', effective: true }];
      expect(checkTransition('REVIEW_RETURN', ctx).ok).toBe(true);
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
    ['UNDER_INVESTIGATION', 'hod', ['COMPLETE_INVESTIGATION', 'SUBMIT_CLOSURE']],
    ['CAPA_IN_PROGRESS', 'hod', ['SUBMIT_CLOSURE']],
    ['PENDING_QUALITY_REVIEW', 'quality', ['REVIEW_RETURN', 'REVIEW_ACCEPT']],
    ['PENDING_QUALITY_REVIEW', 'hod', []],
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
