import { describe, expect, it } from 'vitest';
import {
  MetricCapa,
  MetricIncident,
  addMonths,
  buildTrendSeries,
  monthIndicators,
  monthKeyOf,
  monthKeys,
  monthStart,
  trendFlag,
} from './qualityMetrics.js';

const ist = (s: string) => new Date(`${s}+05:30`);
let n = 0;
const inc = (over: Partial<MetricIncident>): MetricIncident => ({
  _id: String(++n),
  incidentNumber: `INC-${n}`,
  title: 't',
  reportedAt: ist('2026-10-10T10:00:00'),
  severity: 1,
  status: 'ASSIGNED',
  ...over,
});

describe('month helpers (IST)', () => {
  it('starts a month at IST midnight', () => {
    expect(monthStart('2026-11').toISOString()).toBe('2026-10-31T18:30:00.000Z');
  });
  it('puts an early-morning IST report in the right month', () => {
    expect(monthKeyOf(ist('2026-11-01T02:00:00'))).toBe('2026-11');
    expect(monthKeyOf(ist('2026-10-31T23:59:00'))).toBe('2026-10');
  });
  it('steps across years', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(monthKeys('2026-02', 3)).toEqual(['2025-12', '2026-01', '2026-02']);
  });
});

describe('monthIndicators', () => {
  it('counts reports, severity and near-miss ratio, leaving rejected ones out', () => {
    const list = [
      inc({ severity: 1 }),
      inc({ severity: 1 }),
      inc({ severity: 3 }),
      inc({ severity: 5, patientInvolved: true }),
      inc({ severity: 2, status: 'REJECTED', rejectedAt: ist('2026-10-11T10:00:00') }),
      inc({ severity: 1, reportedAt: ist('2026-09-30T10:00:00') }),
    ];
    const m = monthIndicators(list, [], '2026-10', 2000);
    expect(m.reported).toBe(4);
    expect(m.rejected).toBe(1);
    expect(m.bySeverity).toEqual([2, 0, 1, 0, 1]);
    expect(m.nearMissRatio).toBe(50);
    expect(m.harm).toBe(2);
    expect(m.serious).toBe(1);
    expect(m.sentinel).toBe(1);
    expect(m.patientInvolved).toBe(1);
    expect(m.reportingRate).toBe(2); // 4 / 2000 * 1000
  });

  it('measures closure against the severity target', () => {
    const list = [
      // severity 5 target 7 days: closed in 5 -> on time
      inc({ severity: 5, status: 'CLOSED', reportedAt: ist('2026-10-01T10:00:00'), closedAt: ist('2026-10-06T10:00:00') }),
      // severity 1 target 30 days: closed in 40 -> late
      inc({ severity: 1, status: 'CLOSED', reportedAt: ist('2026-09-01T10:00:00'), closedAt: ist('2026-10-11T10:00:00') }),
    ];
    const m = monthIndicators(list, [], '2026-10');
    expect(m.closed).toBe(2);
    expect(m.closedOnTime).toBe(1);
    expect(m.closedOnTimeRate).toBe(50);
    expect(m.medianDaysToClose).toBe(22.5);
  });

  it('counts what was open and overdue at month end, as it was then', () => {
    const list = [
      // closed after the month ended: still open at the end of October
      inc({ severity: 1, status: 'CLOSED', reportedAt: ist('2026-10-20T10:00:00'), closedAt: ist('2026-11-05T10:00:00') }),
      // open, reported in August, severity 3 (14 days): overdue
      inc({ severity: 3, reportedAt: ist('2026-08-01T10:00:00') }),
      // reported after the month: not counted
      inc({ reportedAt: ist('2026-11-02T10:00:00') }),
      // rejected in October: not open
      inc({ status: 'REJECTED', reportedAt: ist('2026-10-01T10:00:00'), rejectedAt: ist('2026-10-02T10:00:00') }),
    ];
    const m = monthIndicators(list, [], '2026-10');
    expect(m.openAtEnd).toBe(2);
    expect(m.overdueAtEnd).toBe(1);
  });

  it('measures CAPA completion against the target date', () => {
    const capas: MetricCapa[] = [
      { status: 'DONE', assignedDate: ist('2026-10-01T10:00:00'), targetDate: ist('2026-10-10T00:00:00'), completedAt: ist('2026-10-10T18:00:00') }, // same day: on time
      { status: 'DONE', assignedDate: ist('2026-10-01T10:00:00'), targetDate: ist('2026-10-10T00:00:00'), completedAt: ist('2026-10-15T10:00:00') }, // late
      { status: 'OPEN', assignedDate: ist('2026-09-01T10:00:00'), targetDate: ist('2026-10-20T00:00:00') }, // not done: overdue at month end
      { status: 'EFFECTIVE', targetDate: ist('2026-09-20T00:00:00'), completedAt: ist('2026-09-19T00:00:00'), verifiedAt: ist('2026-10-05T00:00:00'), effective: true },
      { status: 'OPEN', targetDate: ist('2026-09-20T00:00:00'), completedAt: undefined, verifiedAt: ist('2026-10-06T00:00:00'), effective: false },
    ];
    const m = monthIndicators([], capas, '2026-10');
    expect(m.capaRaised).toBe(2);
    expect(m.capaDue).toBe(3);
    expect(m.capaDueOnTime).toBe(1);
    expect(m.capaOverdueAtEnd).toBe(2);
    expect(m.capaVerified).toBe(2);
    expect(m.capaEffectiveRate).toBe(50);
  });
});

describe('trends', () => {
  it('flags a spike well above the usual level', () => {
    expect(trendFlag([1, 1, 2, 5, 1, 2, 7])).toBe('SPIKE');
    expect(trendFlag([3, 4, 3, 4, 3, 4, 4])).toBeNull();
    expect(trendFlag([0, 0, 0, 0, 0, 0, 2])).toBeNull(); // too few to matter
  });
  it('flags three months rising', () => {
    expect(trendFlag([3, 4, 3, 4, 3, 4, 5])).toBe('RISING');
  });
  it('builds monthly series per group and skips rejected reports', () => {
    const months = ['2026-09', '2026-10'];
    const list = [
      inc({ categoryId: 'a', reportedAt: ist('2026-09-05T10:00:00') }),
      inc({ categoryId: 'a' }),
      inc({ categoryId: 'a', status: 'REJECTED' }),
      inc({ categoryId: 'b' }),
      inc({ categoryId: 'b', reportedAt: ist('2026-07-05T10:00:00') }), // outside the range
    ];
    const series = buildTrendSeries(list, months, (i) => i.categoryId!);
    expect(series.find((s) => s.id === 'a')!.counts).toEqual([1, 1]);
    expect(series.find((s) => s.id === 'b')!.counts).toEqual([0, 1]);
  });
});
