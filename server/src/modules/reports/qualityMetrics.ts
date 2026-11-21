import { CLOSURE_TARGET_DAYS } from '../incidents/incident.model.js';

// Quality committee indicators (monthly report) and trend/spike detection. Pure functions over
// plain records so the numbers can be unit-tested; the controller loads the records.
// Months are calendar months in IST (the hospital's time), whatever the server's time zone is.

const DAY = 24 * 60 * 60 * 1000;
const IST_OFFSET = 330 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, '0');

export const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

/** First instant of a month ("2026-11") in IST. */
export const monthStart = (key: string): Date => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1) - IST_OFFSET);
};
export const addMonths = (key: string, n: number): string => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};
export const monthKeyOf = (date: Date): string => {
  const d = new Date(date.getTime() + IST_OFFSET);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};
export const monthLabel = (key: string, short = false): string => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-GB', { month: short ? 'short' : 'long', year: 'numeric', timeZone: 'UTC' });
};
/** The last `count` month keys ending with `endKey`, oldest first. */
export const monthKeys = (endKey: string, count: number): string[] =>
  Array.from({ length: count }, (_, i) => addMonths(endKey, i - count + 1));

const daysBetween = (from?: Date, to?: Date): number | null =>
  from && to && to >= from ? (to.getTime() - from.getTime()) / DAY : null;
const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (part: number, whole: number): number | null => (whole ? Math.round((part / whole) * 100) : null);
export const median = (values: number[]): number | null => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return round1(s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2);
};
const targetDays = (severity: number) => CLOSURE_TARGET_DAYS[severity] ?? 30;

export interface MetricIncident {
  _id: string;
  incidentNumber: string;
  title: string;
  reportedAt: Date;
  severity: number;
  status: string;
  categoryId?: string;
  departmentId?: string;
  locationId?: string;
  patientInvolved?: boolean;
  firstAssignedAt?: Date;
  closedAt?: Date;
  rejectedAt?: Date;
}

export interface MetricCapa {
  status: string;
  assignedDate?: Date;
  targetDate: Date;
  completedAt?: Date;
  verifiedAt?: Date;
  effective?: boolean;
}

/** Closed (by Quality) before `at`. */
const closedBefore = (i: MetricIncident, at: Date) => i.status === 'CLOSED' && (!i.closedAt || i.closedAt < at);
/** Rejected (not an incident / duplicate) before `at`. */
const rejectedBefore = (i: MetricIncident, at: Date) => i.status === 'REJECTED' && (!i.rejectedAt || i.rejectedAt < at);
/** Still open at `at`: reported before it and neither closed nor rejected by then. */
export const openAt = (i: MetricIncident, at: Date) => i.reportedAt < at && !closedBefore(i, at) && !rejectedBefore(i, at);
/** Open at `at` and older than its severity's closure target. */
export const overdueAt = (i: MetricIncident, at: Date) => openAt(i, at) && (daysBetween(i.reportedAt, at) ?? 0) > targetDays(i.severity);
const capaDone = (c: MetricCapa, before: Date) =>
  c.completedAt ? c.completedAt < before : c.status !== 'OPEN';

export interface MonthIndicators {
  month: string;
  reported: number;
  rejected: number;
  bySeverity: number[]; // index 0 = severity 1 (near miss) ... 4 = severity 5 (sentinel)
  nearMiss: number;
  nearMissRatio: number | null;
  harm: number; // severity 3-5
  serious: number; // severity 4-5 (permanent harm, sentinel)
  sentinel: number;
  patientInvolved: number;
  reportingRate: number | null; // per 1,000 patient days, when patient days are given
  closed: number;
  closedOnTime: number;
  closedOnTimeRate: number | null;
  medianDaysToAssign: number | null;
  medianDaysToClose: number | null;
  openAtEnd: number;
  overdueAtEnd: number;
  capaRaised: number;
  capaDue: number;
  capaDueOnTime: number;
  capaOnTimeRate: number | null;
  capaOverdueAtEnd: number;
  capaVerified: number;
  capaEffective: number;
  capaEffectiveRate: number | null;
}

export const monthIndicators = (incidents: MetricIncident[], capas: MetricCapa[], month: string, patientDays?: number): MonthIndicators => {
  const start = monthStart(month);
  const end = monthStart(addMonths(month, 1));
  const inMonth = (d?: Date) => Boolean(d && d >= start && d < end);

  const reportedAll = incidents.filter((i) => inMonth(i.reportedAt));
  const reported = reportedAll.filter((i) => i.status !== 'REJECTED');
  const bySeverity = [1, 2, 3, 4, 5].map((s) => reported.filter((i) => i.severity === s).length);
  const closed = incidents.filter((i) => i.status === 'CLOSED' && inMonth(i.closedAt));
  const closedOnTime = closed.filter((i) => (daysBetween(i.reportedAt, i.closedAt) ?? Infinity) <= targetDays(i.severity)).length;

  const capaDue = capas.filter((c) => inMonth(c.targetDate));
  // On time = done by the end of the target day
  const capaDueOnTime = capaDue.filter((c) => capaDone(c, new Date(c.targetDate.getTime() + DAY))).length;
  const capaVerified = capas.filter((c) => inMonth(c.verifiedAt));
  const capaEffective = capaVerified.filter((c) => c.effective !== false).length;

  return {
    month,
    reported: reported.length,
    rejected: reportedAll.length - reported.length,
    bySeverity,
    nearMiss: bySeverity[0],
    nearMissRatio: pct(bySeverity[0], reported.length),
    harm: bySeverity[2] + bySeverity[3] + bySeverity[4],
    serious: bySeverity[3] + bySeverity[4],
    sentinel: bySeverity[4],
    patientInvolved: reported.filter((i) => i.patientInvolved).length,
    reportingRate: patientDays ? round1((reported.length / patientDays) * 1000) : null,
    closed: closed.length,
    closedOnTime,
    closedOnTimeRate: pct(closedOnTime, closed.length),
    medianDaysToAssign: median(reported.map((i) => daysBetween(i.reportedAt, i.firstAssignedAt)).filter((d): d is number => d !== null)),
    medianDaysToClose: median(closed.map((i) => daysBetween(i.reportedAt, i.closedAt)).filter((d): d is number => d !== null)),
    openAtEnd: incidents.filter((i) => openAt(i, end)).length,
    overdueAtEnd: incidents.filter((i) => overdueAt(i, end)).length,
    capaRaised: capas.filter((c) => inMonth(c.assignedDate)).length,
    capaDue: capaDue.length,
    capaDueOnTime,
    capaOnTimeRate: pct(capaDueOnTime, capaDue.length),
    capaOverdueAtEnd: capas.filter((c) => c.targetDate < end && (!c.assignedDate || c.assignedDate < end) && !capaDone(c, end)).length,
    capaVerified: capaVerified.length,
    capaEffective,
    capaEffectiveRate: pct(capaEffective, capaVerified.length),
  };
};

/** Average of each numeric indicator over several months (blank where no month has a value). */
export const averageIndicators = (months: MonthIndicators[]): Record<string, number | null> => {
  const out: Record<string, number | null> = {};
  if (!months.length) return out;
  for (const key of Object.keys(months[0]) as Array<keyof MonthIndicators>) {
    if (key === 'month' || key === 'bySeverity') continue;
    const vals = months.map((m) => m[key]).filter((v): v is number => typeof v === 'number');
    out[key] = vals.length ? round1(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  }
  return out;
};

// ---------- Trends ----------

export type TrendFlag = 'SPIKE' | 'RISING' | null;

/**
 * Flags the latest month of a series:
 * - SPIKE: at least 3 and well above its usual level (above both mean + 2 SD and 1.5x the mean
 *   of up to 6 months before it).
 * - RISING: three months in a row going up, ending at 3 or more.
 */
export const trendFlag = (counts: number[]): TrendFlag => {
  if (counts.length < 2) return null;
  const last = counts[counts.length - 1];
  const before = counts.slice(Math.max(0, counts.length - 7), -1);
  const mean = before.reduce((a, b) => a + b, 0) / before.length;
  const sd = Math.sqrt(before.reduce((a, b) => a + (b - mean) ** 2, 0) / before.length);
  if (last >= 3 && last > mean + 2 * sd && last >= 1.5 * mean) return 'SPIKE';
  const [a, b, c] = counts.slice(-3);
  if (counts.length >= 3 && last >= 3 && a < b && b < c) return 'RISING';
  return null;
};

export interface TrendSeries {
  id: string;
  counts: number[];
  total: number;
  last: number;
  average: number; // monthly average before the last month
  flag: TrendFlag; // the latest (possibly still running) month
  previousFlag: TrendFlag; // the last complete month
}

/** Monthly counts per group (category, department, severity...) of non-rejected reports. */
export const buildTrendSeries = (incidents: MetricIncident[], months: string[], groupOf: (i: MetricIncident) => string): TrendSeries[] => {
  const index = new Map(months.map((m, i) => [m, i]));
  const byGroup = new Map<string, number[]>();
  for (const i of incidents) {
    if (i.status === 'REJECTED') continue;
    const at = index.get(monthKeyOf(i.reportedAt));
    if (at === undefined) continue;
    const g = groupOf(i);
    const counts = byGroup.get(g) ?? byGroup.set(g, new Array(months.length).fill(0)).get(g)!;
    counts[at] += 1;
  }
  return [...byGroup.entries()]
    .map(([id, counts]) => {
      const before = counts.slice(0, -1);
      return {
        id,
        counts,
        total: counts.reduce((a, b) => a + b, 0),
        last: counts[counts.length - 1],
        average: before.length ? round1(before.reduce((a, b) => a + b, 0) / before.length) : 0,
        flag: trendFlag(counts),
        previousFlag: trendFlag(before),
      };
    })
    .sort((a, b) => Number(Boolean(b.flag || b.previousFlag)) - Number(Boolean(a.flag || a.previousFlag)) || b.total - a.total);
};
