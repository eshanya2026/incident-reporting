import mongoose from 'mongoose';
import { CLOSURE_TARGET_DAYS, Incident } from '../incidents/incident.model.js';
import { Capa } from '../capa/capa.model.js';

// The numbers behind the AI Insights page. Everything here is computed from the database — the AI
// only ever writes commentary on these figures, it never produces them — so the page is exact and
// still fully useful when no AI is configured. `buildFacts` is pure (no database) so it can be unit
// tested; `loadFacts` gathers its input.

export const INSIGHT_PERIODS = { '3m': 3, '6m': 6, '12m': 12 } as const;
export type InsightPeriod = keyof typeof INSIGHT_PERIODS;
export const DEFAULT_INSIGHT_PERIOD: InsightPeriod = '6m';

export interface InsightScope {
  kind: 'HOSPITAL' | 'DEPARTMENT';
  departmentId?: string;
  departmentName?: string;
}
export const scopeKeyOf = (scope: InsightScope): string => (scope.kind === 'HOSPITAL' ? 'HOSPITAL' : `DEPT:${scope.departmentId}`);
export const scopeLabelOf = (scope: InsightScope): string =>
  scope.kind === 'HOSPITAL' ? 'Whole hospital' : `Department: ${scope.departmentName || 'Unknown'}`;

const OPEN_STATUSES = ['SUBMITTED', 'INFO_REQUESTED', 'ASSIGNED', 'UNDER_INVESTIGATION', 'CAPA_IN_PROGRESS', 'PENDING_QUALITY_REVIEW', 'RCA_REQUESTED'];
// The HOD's action deadline (actionDueAt) only applies while the department is working the incident
const HOD_WORK_STATUSES = ['ASSIGNED', 'UNDER_INVESTIGATION', 'CAPA_IN_PROGRESS'];
// Harm counts for far more than volume when ranking where to act
const SEVERITY_WEIGHT: Record<number, number> = { 1: 1, 2: 2, 3: 5, 4: 10, 5: 20 };
const DAY_MS = 24 * 60 * 60 * 1000;

export interface FactIncident {
  id: string;
  incidentNumber: string;
  title: string;
  status: string;
  severity: number;
  reportedAt: Date;
  closedAt?: Date;
  actionDueAt?: Date;
  categoryId?: string;
  categoryName?: string;
  subcategoryCode?: string;
  subcategoryName?: string;
  locationId?: string;
  locationName?: string;
  departmentId?: string;
  departmentName?: string;
  riskBand?: string;
  /** Sent back at least once (by the HOD to Quality, or by Quality to the HOD at review). */
  reworked: boolean;
}

export interface FactCapa {
  status: string;
  targetDate?: Date;
}

export interface FactsInput {
  scope: InsightScope;
  period: InsightPeriod;
  now: Date;
  since: Date;
  /** Reported in the period, rejected ones excluded. */
  current: FactIncident[];
  /** Reported in the same-length window just before the period. */
  previousCount: number;
  /** Closed incidents in scope from any time, for spotting a problem that came back after closure. */
  closedHistory: FactIncident[];
  /** CAPA actions of the incidents in `current`. */
  capas: FactCapa[];
  /** Open right now in scope, whenever reported. */
  openNow: FactIncident[];
  overdueCapasNow: number;
}

interface IncidentRef {
  id: string;
  incidentNumber: string;
  title: string;
  severity: number;
}

export interface InsightFacts {
  scope: InsightScope;
  period: InsightPeriod;
  since: string;
  asOf: string;
  totals: {
    reported: number;
    previousReported: number;
    trendPct: number | null;
    closed: number;
    openNow: number;
    overdueOpenNow: number;
    overdueCapasNow: number;
  };
  severity: {
    counts: Record<string, number>;
    nearMissSharePct: number | null;
    harmEvents: number;
    sentinelEvents: number;
  };
  closure: {
    medianDaysToClose: number | null;
    withinTargetPct: number | null;
  };
  reworkRatePct: number | null;
  capa: { total: number; open: number; done: number; effective: number; overdueOpen: number };
  risk: { assessed: number; bands: Record<string, number> };
  monthly: Array<{ month: string; count: number }>;
  recurring: Array<{
    category: string;
    subcategory?: string;
    count: number;
    maxSeverity: number;
    lastReportedAt: string;
    locations: Array<{ name: string; count: number }>;
    departments: Array<{ name: string; count: number }>;
    incidents: IncidentRef[];
  }>;
  hotspots: {
    departments: Array<{ name: string; count: number; weightedScore: number; highRisk: number; open: number }>;
    locations: Array<{ name: string; count: number; weightedScore: number }>;
  };
  recurrenceAfterClosure: Array<{
    incident: IncidentRef;
    prior: { id: string; incidentNumber: string };
    category: string;
    subcategory?: string;
    department: string;
    daysAfterClosure: number;
  }>;
  overdueIncidents: Array<IncidentRef & { department: string; daysOverdue: number }>;
}

// ---------- Pure computation ----------

const pct = (part: number, whole: number): number | null => (whole > 0 ? Math.round((part / whole) * 100) : null);

const median = (values: number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const m = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(m * 10) / 10;
};

const topCounts = (names: string[], limit: number): Array<{ name: string; count: number }> => {
  const counts = new Map<string, number>();
  names.forEach((n) => counts.set(n, (counts.get(n) ?? 0) + 1));
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
};

const refOf = (i: FactIncident): IncidentRef => ({ id: i.id, incidentNumber: i.incidentNumber, title: i.title, severity: i.severity });
const issueKey = (i: FactIncident): string => `${i.categoryId}|${i.subcategoryCode || ''}`;
const monthKey = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export const buildFacts = (input: FactsInput): InsightFacts => {
  const { scope, current, now } = input;
  const reported = current.length;
  const closedInPeriod = current.filter((i) => i.status === 'CLOSED' && i.closedAt);

  // Severity
  const counts: Record<string, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  current.forEach((i) => (counts[i.severity] = (counts[i.severity] ?? 0) + 1));

  // Closure time
  const closeDays = closedInPeriod.map((i) => (i.closedAt!.getTime() - i.reportedAt.getTime()) / DAY_MS);
  const withinTarget = closedInPeriod.filter(
    (i) => (i.closedAt!.getTime() - i.reportedAt.getTime()) / DAY_MS <= (CLOSURE_TARGET_DAYS[i.severity] ?? CLOSURE_TARGET_DAYS[1])
  ).length;

  // Risk bands (recorded at closure)
  const bands: Record<string, number> = { LOW: 0, MODERATE: 0, HIGH: 0, EXTREME: 0 };
  closedInPeriod.forEach((i) => {
    if (i.riskBand) bands[i.riskBand] = (bands[i.riskBand] ?? 0) + 1;
  });

  // Monthly volume, one entry per month of the period even when it had none
  const monthly: Array<{ month: string; count: number }> = [];
  for (let d = new Date(input.since.getFullYear(), input.since.getMonth(), 1); d <= now; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    monthly.push({ month: monthKey(d), count: 0 });
  }
  current.forEach((i) => {
    const m = monthly.find((x) => x.month === monthKey(i.reportedAt));
    if (m) m.count += 1;
  });

  // Repeated incidents: the same category + subcategory more than once in the period
  const groups = new Map<string, FactIncident[]>();
  current
    .filter((i) => i.categoryId)
    .forEach((i) => groups.set(issueKey(i), [...(groups.get(issueKey(i)) ?? []), i]));
  const recurring = [...groups.values()]
    .filter((g) => g.length >= 2)
    .map((g) => {
      const sorted = [...g].sort((a, b) => b.reportedAt.getTime() - a.reportedAt.getTime());
      return {
        category: g[0].categoryName || 'Uncategorised',
        subcategory: g[0].subcategoryName,
        count: g.length,
        maxSeverity: Math.max(...g.map((i) => i.severity)),
        lastReportedAt: sorted[0].reportedAt.toISOString(),
        locations: topCounts(g.map((i) => i.locationName || 'Not recorded'), 3),
        departments: topCounts(g.map((i) => i.departmentName || 'Not yet assigned'), 3),
        incidents: sorted.slice(0, 6).map(refOf),
      };
    })
    .sort((a, b) => b.count - a.count || b.maxSeverity - a.maxSeverity)
    .slice(0, 8);

  // Hotspots
  const byDept = new Map<string, FactIncident[]>();
  current.forEach((i) => {
    const name = i.departmentName || 'Not yet assigned';
    byDept.set(name, [...(byDept.get(name) ?? []), i]);
  });
  const departments =
    scope.kind === 'HOSPITAL'
      ? [...byDept.entries()]
          .map(([name, list]) => ({
            name,
            count: list.length,
            weightedScore: list.reduce((s, i) => s + (SEVERITY_WEIGHT[i.severity] ?? 1), 0),
            highRisk: list.filter((i) => i.riskBand === 'HIGH' || i.riskBand === 'EXTREME').length,
            open: list.filter((i) => OPEN_STATUSES.includes(i.status)).length,
          }))
          .sort((a, b) => b.weightedScore - a.weightedScore || b.count - a.count)
          .slice(0, 8)
      : [];
  const byLoc = new Map<string, FactIncident[]>();
  current.forEach((i) => {
    const name = i.locationName || 'Not recorded';
    byLoc.set(name, [...(byLoc.get(name) ?? []), i]);
  });
  const locations = [...byLoc.entries()]
    .map(([name, list]) => ({ name, count: list.length, weightedScore: list.reduce((s, i) => s + (SEVERITY_WEIGHT[i.severity] ?? 1), 0) }))
    .sort((a, b) => b.weightedScore - a.weightedScore || b.count - a.count)
    .slice(0, 8);

  // Came back after closure: same category/subcategory in the same responsible department,
  // reported after an earlier one was closed (closing it marked its CAPA effective)
  const closedByKey = new Map<string, FactIncident[]>();
  input.closedHistory
    .filter((p) => p.categoryId && p.departmentId && p.closedAt)
    .forEach((p) => {
      const key = `${issueKey(p)}|${p.departmentId}`;
      closedByKey.set(key, [...(closedByKey.get(key) ?? []), p]);
    });
  const recurrenceAfterClosure = current
    .filter((c) => c.categoryId && c.departmentId)
    .flatMap((c) => {
      const prior = (closedByKey.get(`${issueKey(c)}|${c.departmentId}`) ?? [])
        .filter((p) => p.id !== c.id && p.closedAt! < c.reportedAt)
        .sort((a, b) => b.closedAt!.getTime() - a.closedAt!.getTime())[0];
      if (!prior) return [];
      return [
        {
          incident: refOf(c),
          prior: { id: prior.id, incidentNumber: prior.incidentNumber },
          category: c.categoryName || 'Uncategorised',
          subcategory: c.subcategoryName,
          department: c.departmentName || 'Unknown',
          daysAfterClosure: Math.max(0, Math.round((c.reportedAt.getTime() - prior.closedAt!.getTime()) / DAY_MS)),
        },
      ];
    })
    .sort((a, b) => a.daysAfterClosure - b.daysAfterClosure)
    .slice(0, 10);

  // Open work past the HOD's deadline right now
  const overdueIncidents = input.openNow
    .filter((i) => HOD_WORK_STATUSES.includes(i.status) && i.actionDueAt && i.actionDueAt < now)
    .map((i) => ({
      ...refOf(i),
      department: i.departmentName || 'Unknown',
      daysOverdue: Math.max(1, Math.round((now.getTime() - i.actionDueAt!.getTime()) / DAY_MS)),
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  return {
    scope,
    period: input.period,
    since: input.since.toISOString(),
    asOf: now.toISOString(),
    totals: {
      reported,
      previousReported: input.previousCount,
      trendPct: input.previousCount > 0 ? Math.round(((reported - input.previousCount) / input.previousCount) * 100) : null,
      closed: closedInPeriod.length,
      openNow: input.openNow.length,
      overdueOpenNow: overdueIncidents.length,
      overdueCapasNow: input.overdueCapasNow,
    },
    severity: {
      counts,
      nearMissSharePct: pct(counts[1], reported),
      harmEvents: counts[3] + counts[4] + counts[5],
      sentinelEvents: counts[5],
    },
    closure: { medianDaysToClose: median(closeDays), withinTargetPct: pct(withinTarget, closedInPeriod.length) },
    reworkRatePct: pct(current.filter((i) => i.reworked).length, reported),
    capa: {
      total: input.capas.length,
      open: input.capas.filter((c) => c.status === 'OPEN').length,
      done: input.capas.filter((c) => c.status === 'DONE').length,
      effective: input.capas.filter((c) => c.status === 'EFFECTIVE').length,
      overdueOpen: input.capas.filter((c) => c.status === 'OPEN' && c.targetDate && c.targetDate < today).length,
    },
    risk: { assessed: closedInPeriod.filter((i) => i.riskBand).length, bands },
    monthly,
    recurring,
    hotspots: { departments, locations: locations },
    recurrenceAfterClosure,
    overdueIncidents: overdueIncidents.slice(0, 10),
  };
};

// ---------- De-identification for anything sent to the AI ----------

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Strips patient/person identifiers from free text before it leaves the server: the incident's
 * own recorded patient / affected-person names, ID-like tokens (UHID, IP/OP numbers, MRN), long
 * digit runs (phone numbers, record numbers) and honorific + name patterns. Names written
 * without an honorific that aren't the recorded patient can't be caught reliably, which is why
 * only titles (never descriptions) are ever sent.
 */
export const deidentify = (text: string, privateNames: string[] = []): string => {
  let out = text || '';
  for (const raw of privateNames) {
    const name = (raw || '').trim();
    if (name.length < 2) continue;
    const parts = [name, ...name.split(/\s+/).filter((p) => p.length >= 3)];
    for (const part of parts) out = out.replace(new RegExp(`\\b${escapeRegExp(part)}\\b`, 'gi'), '[name]');
  }
  out = out.replace(/\b(?:UHID|MRN|IP|OP)\s*(?:No\.?|Number)?\s*[:#-]?\s*[A-Z0-9-]*\d[A-Z0-9-]*/gi, '[id]');
  out = out.replace(/\b(?:Mr|Mrs|Ms|Miss|Master|Baby|Smt|Shri|Sri|Thiru|Tmt|Selvi|Dr)\.?\s+[A-Z][\w.]*(?:\s+[A-Z][\w.]*)?/g, '[name]');
  out = out.replace(/\d{5,}/g, '[number]');
  return out.replace(/(\[name\]\s*){2,}/g, '[name] ');
};

// ---------- Database ----------

const idOf = (v: any): string | undefined => (v ? String(v._id ?? v) : undefined);

const toFact = (doc: any): FactIncident => {
  const category = doc.categoryId && typeof doc.categoryId === 'object' && 'name' in doc.categoryId ? doc.categoryId : null;
  return {
    id: String(doc._id),
    incidentNumber: doc.incidentNumber,
    title: doc.title,
    status: doc.status,
    severity: doc.severity,
    reportedAt: new Date(doc.reportedAt),
    closedAt: doc.closedAt ? new Date(doc.closedAt) : undefined,
    actionDueAt: doc.actionDueAt ? new Date(doc.actionDueAt) : undefined,
    categoryId: idOf(doc.categoryId),
    categoryName: category?.name,
    subcategoryCode: doc.subcategoryCode || undefined,
    subcategoryName: category?.subcategories?.find((s: any) => s.code === doc.subcategoryCode)?.name,
    locationId: idOf(doc.locationId),
    locationName: doc.locationId?.name,
    departmentId: idOf(doc.departmentId),
    departmentName: doc.departmentId?.name,
    riskBand: doc.riskAssessment?.band,
    reworked: (doc.hodReturns?.length ?? 0) > 0 || (doc.qualityReviews || []).some((r: any) => r.decision === 'RETURNED'),
  };
};

const privateNamesOf = (doc: any): string[] => [doc.patient?.name, doc.affectedPersonDetail?.name].filter(Boolean);

export const periodWindow = (period: InsightPeriod, now = new Date()) => {
  const months = INSIGHT_PERIODS[period];
  const since = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  const prevSince = new Date(since.getFullYear(), since.getMonth() - months, 1);
  return { since, prevSince };
};

export const loadFacts = async (
  scope: InsightScope,
  period: InsightPeriod
): Promise<{
  facts: InsightFacts;
  privateNamesById: Map<string, string[]>;
  /** Every incident in the period plus anything older still open, newest first. */
  incidents: FactIncident[];
}> => {
  const now = new Date();
  const { since, prevSince } = periodWindow(period, now);
  const deptOid = scope.departmentId ? new mongoose.Types.ObjectId(scope.departmentId) : null;
  // A department's view covers incidents it is responsible for and ones it was marked as involved in
  const scopeFilter: Record<string, any> = deptOid ? { $or: [{ departmentId: deptOid }, { notifiedDepartmentIds: deptOid }] } : {};
  const fields =
    'incidentNumber title status severity reportedAt closedAt actionDueAt categoryId subcategoryCode locationId departmentId riskAssessment.band hodReturns qualityReviews.decision patient.name affectedPersonDetail.name';
  const populated = (q: any) => q.populate('categoryId', 'name subcategories').populate('locationId', 'name').populate('departmentId', 'name');

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const [currentDocs, previousCount, openDocs, overdueCapasNow] = await Promise.all([
    populated(Incident.find({ ...scopeFilter, status: { $ne: 'REJECTED' }, reportedAt: { $gte: since } }).select(fields)).lean(),
    Incident.countDocuments({ ...scopeFilter, status: { $ne: 'REJECTED' }, reportedAt: { $gte: prevSince, $lt: since } }),
    populated(Incident.find({ ...scopeFilter, status: { $in: OPEN_STATUSES } }).select(fields)).lean(),
    Capa.countDocuments({ ...(deptOid ? { ownerDepartmentId: deptOid } : {}), status: 'OPEN', targetDate: { $lt: today } }),
  ]);

  const current = (currentDocs as any[]).map(toFact);
  const categoryIds = [...new Set(current.map((i) => i.categoryId).filter(Boolean))].map((id) => new mongoose.Types.ObjectId(id));
  const [historyDocs, capaDocs] = await Promise.all([
    categoryIds.length
      ? Incident.find({ ...scopeFilter, status: 'CLOSED', categoryId: { $in: categoryIds } })
          .select('incidentNumber title status severity reportedAt closedAt categoryId subcategoryCode departmentId')
          .lean()
      : [],
    Capa.find({ incidentId: { $in: current.map((i) => new mongoose.Types.ObjectId(i.id)) } })
      .select('status targetDate')
      .lean(),
  ]);

  const privateNamesById = new Map<string, string[]>();
  [...(currentDocs as any[]), ...(openDocs as any[])].forEach((d) => privateNamesById.set(String(d._id), privateNamesOf(d)));

  const openNow = (openDocs as any[]).map(toFact);
  const facts = buildFacts({
    scope,
    period,
    now,
    since,
    current,
    previousCount,
    closedHistory: (historyDocs as any[]).map(toFact),
    capas: (capaDocs as any[]).map((c) => ({ status: c.status, targetDate: c.targetDate ? new Date(c.targetDate) : undefined })),
    openNow,
    overdueCapasNow,
  });

  const byId = new Map<string, FactIncident>();
  [...current, ...openNow].forEach((i) => byId.set(i.id, i));
  const incidents = [...byId.values()].sort((a, b) => b.reportedAt.getTime() - a.reportedAt.getTime());
  return { facts, privateNamesById, incidents };
};
