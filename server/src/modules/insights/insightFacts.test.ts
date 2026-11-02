import { describe, expect, it } from 'vitest';
import { buildFacts, deidentify, FactIncident, FactsInput } from './insightFacts.js';
import { buildAiPayload } from './insightNarrative.js';

const now = new Date(2026, 10, 15, 12, 0, 0); // 15 Nov 2026
const since = new Date(2026, 5, 1); // 6-month window starting 1 Jun 2026
const day = (d: number, m = 10) => new Date(2026, m, d, 9, 0, 0);

let seq = 0;
const inc = (over: Partial<FactIncident> = {}): FactIncident => {
  seq += 1;
  return {
    id: `id${seq}`,
    incidentNumber: `INC-2026-${String(seq).padStart(6, '0')}`,
    title: `Incident ${seq}`,
    status: 'CLOSED',
    severity: 2,
    reportedAt: day(1),
    closedAt: day(5),
    categoryId: 'cat-med',
    categoryName: 'Medication Error',
    subcategoryCode: 'WRONG_DOSE',
    subcategoryName: 'Wrong dose',
    locationId: 'loc-icu',
    locationName: 'ICU',
    departmentId: 'dept-icu',
    departmentName: 'Intensive Care Unit',
    reworked: false,
    ...over,
  };
};

const input = (over: Partial<FactsInput> = {}): FactsInput => ({
  scope: { kind: 'HOSPITAL' },
  period: '6m',
  now,
  since,
  current: [],
  previousCount: 0,
  closedHistory: [],
  capas: [],
  openNow: [],
  overdueCapasNow: 0,
  ...over,
});

describe('buildFacts', () => {
  it('computes trend, severity mix, near-miss share and harm counts', () => {
    const current = [inc({ severity: 1 }), inc({ severity: 1 }), inc({ severity: 3 }), inc({ severity: 5 })];
    const f = buildFacts(input({ current, previousCount: 2 }));
    expect(f.totals.reported).toBe(4);
    expect(f.totals.trendPct).toBe(100);
    expect(f.severity.nearMissSharePct).toBe(50);
    expect(f.severity.harmEvents).toBe(2);
    expect(f.severity.sentinelEvents).toBe(1);
  });

  it('reports no trend when there was nothing in the previous period', () => {
    expect(buildFacts(input({ current: [inc()], previousCount: 0 })).totals.trendPct).toBeNull();
  });

  it('measures closure against the per-severity target', () => {
    const current = [
      inc({ severity: 5, reportedAt: day(1), closedAt: day(5) }), // 4 days, target 7: within
      inc({ severity: 5, reportedAt: day(1), closedAt: day(20) }), // 19 days, target 7: late
    ];
    const f = buildFacts(input({ current }));
    expect(f.closure.withinTargetPct).toBe(50);
    expect(f.closure.medianDaysToClose).toBe(11.5);
  });

  it('groups repeated category/subcategory incidents and ignores one-offs', () => {
    const current = [
      inc({ severity: 2 }),
      inc({ severity: 4 }),
      inc({ severity: 2 }),
      inc({ categoryId: 'cat-fall', categoryName: 'Patient Fall', subcategoryCode: 'BED' }),
    ];
    const f = buildFacts(input({ current }));
    expect(f.recurring).toHaveLength(1);
    expect(f.recurring[0]).toMatchObject({ category: 'Medication Error', subcategory: 'Wrong dose', count: 3, maxSeverity: 4 });
  });

  it('flags an incident that came back after an earlier one of the same kind was closed', () => {
    const prior = inc({ reportedAt: day(1, 6), closedAt: day(10, 6) });
    const repeat = inc({ status: 'ASSIGNED', closedAt: undefined, reportedAt: day(1, 7) });
    const otherDept = inc({ status: 'ASSIGNED', closedAt: undefined, reportedAt: day(2, 7), departmentId: 'dept-ward', departmentName: 'Ward' });
    const f = buildFacts(input({ current: [repeat, otherDept], closedHistory: [prior] }));
    expect(f.recurrenceAfterClosure).toHaveLength(1);
    expect(f.recurrenceAfterClosure[0]).toMatchObject({
      incident: { incidentNumber: repeat.incidentNumber },
      prior: { incidentNumber: prior.incidentNumber },
      daysAfterClosure: 22, // closed 10 Jul, came back 1 Aug
    });
  });

  it('does not count an incident reported before the earlier one was closed', () => {
    const prior = inc({ reportedAt: day(1, 6), closedAt: day(20, 6) });
    const before = inc({ status: 'ASSIGNED', closedAt: undefined, reportedAt: day(5, 6) });
    expect(buildFacts(input({ current: [before], closedHistory: [prior] })).recurrenceAfterClosure).toHaveLength(0);
  });

  it('ranks department hotspots by severity weight, and only hospital-wide', () => {
    const current = [
      inc({ severity: 1 }),
      inc({ severity: 1 }),
      inc({ severity: 1 }),
      inc({ severity: 4, departmentId: 'dept-ot', departmentName: 'Operation Theatre' }),
    ];
    expect(buildFacts(input({ current })).hotspots.departments[0].name).toBe('Operation Theatre');
    expect(buildFacts(input({ current, scope: { kind: 'DEPARTMENT', departmentId: 'dept-icu', departmentName: 'ICU' } })).hotspots.departments).toEqual([]);
  });

  it('lists open incidents past the HOD deadline, most overdue first', () => {
    const openNow = [
      inc({ status: 'ASSIGNED', closedAt: undefined, actionDueAt: day(10) }),
      inc({ status: 'UNDER_INVESTIGATION', closedAt: undefined, actionDueAt: day(1) }),
      inc({ status: 'ASSIGNED', closedAt: undefined, actionDueAt: day(30) }), // not yet due
      inc({ status: 'PENDING_QUALITY_REVIEW', closedAt: undefined, actionDueAt: day(1) }), // with Quality, not the HOD
    ];
    const f = buildFacts(input({ openNow }));
    expect(f.totals.overdueOpenNow).toBe(2);
    expect(f.overdueIncidents.map((o) => o.daysOverdue)).toEqual([14, 5]);
  });

  it('has a month entry for every month of the period', () => {
    expect(buildFacts(input()).monthly.map((m) => m.month)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
  });
});

describe('deidentify', () => {
  it('removes the recorded patient name, in full and by part', () => {
    expect(deidentify('Ramesh Kumar fell near bed 4', ['Ramesh Kumar'])).toBe('[name] fell near bed 4');
    expect(deidentify('Kumar given wrong dose', ['Ramesh Kumar'])).toBe('[name] given wrong dose');
  });

  it('removes ID tokens and long numbers but keeps ordinary words', () => {
    expect(deidentify('UHID 3074021 wrong label')).toBe('[id] wrong label');
    expect(deidentify('IP07033094 transfused')).toBe('[id] transfused');
    expect(deidentify('Called 9962460782 twice')).toBe('Called [number] twice');
    expect(deidentify('OP theatre light failed')).toBe('OP theatre light failed');
  });

  it('removes honorific + name', () => {
    expect(deidentify('Mrs. Lakshmi slipped in corridor')).toBe('[name] slipped in corridor');
  });
});

describe('buildAiPayload', () => {
  it('never sends patient names or raw IDs from titles', () => {
    const repeatA = inc({ id: 'a', title: 'Ramesh given wrong dose, UHID 3074021' });
    const repeatB = inc({ id: 'b', title: 'Wrong dose to Mrs. Devi' });
    const facts = buildFacts(input({ current: [repeatA, repeatB] }));
    const payload = JSON.stringify(buildAiPayload(facts, new Map([['a', ['Ramesh']]])));
    expect(payload).not.toMatch(/Ramesh|3074021|Devi/);
  });
});
