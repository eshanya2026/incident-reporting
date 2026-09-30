import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Incident, INCIDENT_STATUSES, AFFECTED_PERSON_TYPES } from '../incidents/incident.model.js';
import { Capa } from '../capa/capa.model.js';
import { IncidentCategory } from '../categories/category.model.js';
import { Department } from '../departments/department.model.js';
import { Location } from '../locations/location.model.js';
import { User } from '../users/user.model.js';
import { sendSuccess } from '../../common/helpers/response.js';
import { AppError } from '../../common/errors/appError.js';
import { hasPermission } from '../../common/helpers/incidentAccess.js';
import { PERMISSIONS } from '../../common/enums/permissions.js';

// Dashboard for the Staff → Quality → HOD → Quality workflow (docs/FLOW_REWORK_PLAN.md, Phase 6).
// Quality and Admin see the whole hospital; an HOD sees incidents assigned to their department.
// "Right now" figures (queues, open work, CAPA) ignore the period; everything else uses it.

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIODS: Record<string, number | null> = { '3m': 3, '6m': 6, '12m': 12, all: null };
const OPEN_STATUSES = ['SUBMITTED', 'INFO_REQUESTED', 'ASSIGNED', 'UNDER_INVESTIGATION', 'CAPA_IN_PROGRESS', 'PENDING_QUALITY_REVIEW'];

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const m = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(m * 10) / 10;
};
const daysBetween = (from?: Date, to?: Date): number | null =>
  from && to && to >= from ? (to.getTime() - from.getTime()) / DAY_MS : null;
// Month buckets use the server's time zone (same as monthKey below), not MongoDB's default UTC
const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/**
 * Turns a flat {location, series, count} list into one row per (top) location, with one column
 * per (top) series and everything else folded into "Other" — the shape a stacked bar chart wants.
 */
function pivotByLocation(
  rows: Array<{ locId: string; locName: string; seriesName: string; count: number }>,
  topLocations = 8,
  topSeries = 8
): { data: Array<Record<string, number | string>>; seriesKeys: string[] } {
  const locTotals = new Map<string, number>();
  const seriesTotals = new Map<string, number>();
  const locNameById = new Map<string, string>();
  for (const row of rows) {
    locTotals.set(row.locId, (locTotals.get(row.locId) ?? 0) + row.count);
    seriesTotals.set(row.seriesName, (seriesTotals.get(row.seriesName) ?? 0) + row.count);
    locNameById.set(row.locId, row.locName);
  }
  const topLocIds = [...locTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, topLocations).map(([id]) => id);
  const topSeriesNames = [...seriesTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, topSeries).map(([name]) => name);

  const data = topLocIds
    .map((locId) => {
      const point: Record<string, number | string> = { location: locNameById.get(locId) || 'Unknown' };
      for (const s of topSeriesNames) point[s] = 0;
      point.Other = 0;
      for (const row of rows) {
        if (row.locId !== locId) continue;
        const key = topSeriesNames.includes(row.seriesName) ? row.seriesName : 'Other';
        point[key] = (point[key] as number) + row.count;
      }
      return { locId, point };
    })
    .sort((a, b) => (locTotals.get(b.locId) ?? 0) - (locTotals.get(a.locId) ?? 0))
    .map((x) => x.point);

  const seriesKeys = [...topSeriesNames, ...(rows.some((r) => !topSeriesNames.includes(r.seriesName)) ? ['Other'] : [])];
  return { data, seriesKeys };
}

export const getDashboardOverview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user!;
    const hospitalWide = hasPermission(user, PERMISSIONS.INCIDENT_READ_ALL);
    if (!hospitalWide && !user.departmentId) {
      throw AppError.badRequest('Your account has no department');
    }

    const period = String(req.query.period ?? '12m');
    if (!(period in PERIODS)) {
      throw AppError.badRequest('period must be one of 3m, 6m, 12m, all');
    }
    const months = PERIODS[period];
    const now = new Date();
    const since = months ? new Date(now.getFullYear(), now.getMonth() - months + 1, 1) : null;

    const deptId = hospitalWide ? null : new mongoose.Types.ObjectId(user.departmentId);
    const scope: Record<string, any> = deptId ? { departmentId: deptId } : {};
    const capaScope: Record<string, any> = deptId ? { ownerDepartmentId: deptId } : {};
    const inPeriod = (field: string) => (since ? { [field]: { $gte: since } } : {});

    // ---------- Right now ----------
    const [statusCounts, oldestSubmitted, oldestReview, activeRework, currentDept] = await Promise.all([
      Incident.aggregate([{ $match: { ...scope, status: { $in: OPEN_STATUSES } } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      hospitalWide ? Incident.findOne({ status: 'SUBMITTED' }).sort({ reportedAt: 1 }).select('reportedAt') : null,
      Incident.findOne({ ...scope, status: 'PENDING_QUALITY_REVIEW' }).sort({ 'closureSubmission.at': 1 }).select('closureSubmission.at'),
      Incident.countDocuments({ ...scope, status: 'CAPA_IN_PROGRESS', 'qualityReviews.decision': 'RETURNED' }),
      deptId ? Department.findById(deptId).select('name code').lean() : null,
    ]);
    const byStatus: Record<string, number> = Object.fromEntries(OPEN_STATUSES.map((s) => [s, 0]));
    statusCounts.forEach((s) => (byStatus[s._id] = s.count));

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const [capaCounts, overdueCapas, hodsPendingCapaAgg, topReportersAgg] = await Promise.all([
      Capa.aggregate([{ $match: capaScope }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Capa.countDocuments({ ...capaScope, status: 'OPEN', targetDate: { $lt: startOfToday } }),
      // Every department's HODs own their own CAPAs, so this is meaningful hospital-wide or scoped
      Capa.aggregate([
        { $match: { ...capaScope, status: 'OPEN' } },
        { $group: { _id: '$ownerUserId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      Incident.aggregate([
        { $match: { ...scope, status: { $ne: 'REJECTED' } } },
        { $group: { _id: '$reportedBy', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
    ]);
    const capa = { OPEN: 0, DONE: 0, EFFECTIVE: 0, overdue: overdueCapas };
    capaCounts.forEach((c) => ((capa as any)[c._id] = c.count));

    const [hodUsers, reporterUsers] = await Promise.all([
      User.find({ _id: { $in: hodsPendingCapaAgg.map((h) => h._id) } }).select('name employeeId'),
      User.find({ _id: { $in: topReportersAgg.map((r) => r._id) } })
        .select('name employeeId designation departmentId')
        .populate('departmentId', 'name'),
    ]);
    const hodsPendingCapa = hodsPendingCapaAgg.map((h) => {
      const u = hodUsers.find((x) => x._id.toString() === String(h._id));
      return { name: u?.name ?? 'Unknown', employeeId: u?.employeeId ?? '—', count: h.count };
    });
    const topReporters = topReportersAgg.map((r) => {
      const u: any = reporterUsers.find((x) => x._id.toString() === String(r._id));
      return {
        name: u?.name ?? 'Unknown',
        employeeId: u?.employeeId ?? '—',
        department: u?.departmentId?.name ?? u?.designation ?? '—',
        count: r.count,
      };
    });

    // ---------- In the period ----------
    const reportedFilter = { ...scope, ...inPeriod('reportedAt') };
    const closedFilter = { ...scope, status: 'CLOSED', ...inPeriod('closedAt') };

    const [
      reported,
      rejected,
      closedIncidents,
      severityAgg,
      categoryAgg,
      departmentAgg,
      monthlyReported,
      monthlyClosed,
      statusAgg,
      locationAgg,
      affectedPersonAgg,
      overdueOpenIncidents,
      locationCategoryAgg,
      locationSubcategoryAgg,
    ] = await Promise.all([
      Incident.countDocuments(reportedFilter),
      Incident.countDocuments({ ...reportedFilter, status: 'REJECTED' }),
      Incident.find(closedFilter).select('reportedAt closedAt assignments assignedAt closureSubmission qualityReviews hodReturns').lean(),
      Incident.aggregate([{ $match: { ...reportedFilter, status: { $ne: 'REJECTED' } } }, { $group: { _id: '$severity', count: { $sum: 1 } } }]),
      Incident.aggregate([{ $match: reportedFilter }, { $group: { _id: '$categoryId', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      hospitalWide
        ? Incident.aggregate([
            { $match: { ...reportedFilter, status: { $ne: 'REJECTED' } } },
            { $group: { _id: '$departmentId', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ])
        : Promise.resolve([]),
      Incident.aggregate([
        { $match: reportedFilter },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$reportedAt', timezone: TIME_ZONE } }, count: { $sum: 1 } } },
      ]),
      Incident.aggregate([
        { $match: closedFilter },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$closedAt', timezone: TIME_ZONE } }, count: { $sum: 1 } } },
      ]),
      // Every status this period's reports are currently in, including terminal ones (closed/rejected)
      Incident.aggregate([{ $match: reportedFilter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      // Excludes rejected (duplicate / not an incident) reports, same as severity and department above
      Incident.aggregate([
        { $match: { ...reportedFilter, status: { $ne: 'REJECTED' } } },
        { $group: { _id: '$locationId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      Incident.aggregate([
        { $match: { ...reportedFilter, status: { $ne: 'REJECTED' } } },
        { $group: { _id: '$affectedPersonType', count: { $sum: 1 } } },
      ]),
      // Reports still open (not closed or rejected) — reportedAt only, to bucket by age in JS below
      Incident.find({ ...reportedFilter, status: { $nin: ['CLOSED', 'REJECTED'] } }).select('reportedAt').lean(),
      Incident.aggregate([
        { $match: { ...reportedFilter, status: { $ne: 'REJECTED' } } },
        { $group: { _id: { locationId: '$locationId', categoryId: '$categoryId' }, count: { $sum: 1 } } },
      ]),
      Incident.aggregate([
        { $match: { ...reportedFilter, status: { $ne: 'REJECTED' } } },
        {
          $group: {
            _id: { locationId: '$locationId', categoryId: '$categoryId', subcategoryCode: '$subcategoryCode' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Overdue buckets are cumulative: an incident open 40 days counts in all three
    const overdueBuckets = [7, 15, 30].map((days) => ({
      days,
      count: (overdueOpenIncidents as any[]).filter((i) => (daysBetween(i.reportedAt, now) ?? 0) > days).length,
    }));

    // Turnaround medians over incidents closed in the period
    const toAssign: number[] = [];
    const hodWork: number[] = [];
    const qualityReview: number[] = [];
    const total: number[] = [];
    let sentBack = 0;
    for (const i of closedIncidents as any[]) {
      const firstAssign = i.assignments?.[0]?.at ?? i.assignedAt;
      const lastSubmit = i.closureSubmission?.at;
      const a = daysBetween(i.reportedAt, firstAssign);
      const b = daysBetween(firstAssign, lastSubmit);
      const c = daysBetween(lastSubmit, i.closedAt);
      const t = daysBetween(i.reportedAt, i.closedAt);
      if (a !== null) toAssign.push(a);
      if (b !== null) hodWork.push(b);
      if (c !== null) qualityReview.push(c);
      if (t !== null) total.push(t);
      if ((i.qualityReviews || []).some((r: any) => r.decision === 'RETURNED')) sentBack += 1;
    }

    // Names for categories, departments and locations — gathered from every aggregation that
    // groups by one of these ids, since the cross-tabs below may reference ids outside the
    // "top 10" lists (locationAgg, categoryAgg) computed above
    const categoryIds = new Set([
      ...categoryAgg.map((c) => String(c._id)),
      ...locationCategoryAgg.map((r: any) => String(r._id.categoryId)),
      ...locationSubcategoryAgg.map((r: any) => String(r._id.categoryId)),
    ]);
    const locationIds = new Set([
      ...locationAgg.map((l: any) => String(l._id)),
      ...locationCategoryAgg.map((r: any) => String(r._id.locationId)),
      ...locationSubcategoryAgg.map((r: any) => String(r._id.locationId)),
    ]);
    const [categories, departments, locations] = await Promise.all([
      IncidentCategory.find({ _id: { $in: [...categoryIds] } }).select('name domain subcategories'),
      Department.find({ _id: { $in: departmentAgg.map((d: any) => d._id).filter(Boolean) } }).select('name'),
      Location.find({ _id: { $in: [...locationIds] } }).select('name'),
    ]);
    const nameOf = (list: any[], id: any) => list.find((x) => x._id.toString() === String(id))?.name ?? 'Unknown';
    const subcategoryNameOf = (categoryId: any, code?: string) => {
      if (!code) return 'Unspecified';
      const cat = categories.find((c) => c._id.toString() === String(categoryId));
      return cat?.subcategories?.find((sc: any) => sc.code === code)?.name ?? code;
    };

    // Categories don't carry their domain group on the incident itself, so roll the per-category
    // counts above up to their domain (e.g. "Clinical Care", "Patient Safety") here
    const domainTotals = new Map<string, number>();
    for (const c of categoryAgg) {
      const domain = categories.find((cat) => cat._id.toString() === String(c._id))?.domain?.trim() || 'Other';
      domainTotals.set(domain, (domainTotals.get(domain) ?? 0) + c.count);
    }
    const domains = [...domainTotals.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

    const affectedPersons = AFFECTED_PERSON_TYPES.map((type) => ({
      type,
      count: (affectedPersonAgg as any[]).find((a) => a._id === type)?.count ?? 0,
    }));

    const locationByType = pivotByLocation(
      (locationCategoryAgg as any[]).map((r) => ({
        locId: r._id.locationId ? String(r._id.locationId) : 'none',
        locName: r._id.locationId ? nameOf(locations, r._id.locationId) : 'Not recorded',
        seriesName: nameOf(categories, r._id.categoryId),
        count: r.count,
      }))
    );
    const locationBySubtype = pivotByLocation(
      (locationSubcategoryAgg as any[]).map((r) => ({
        locId: r._id.locationId ? String(r._id.locationId) : 'none',
        locName: r._id.locationId ? nameOf(locations, r._id.locationId) : 'Not recorded',
        seriesName: subcategoryNameOf(r._id.categoryId, r._id.subcategoryCode),
        count: r.count,
      }))
    );

    // Month buckets: every month in the period (or since the first report for "all")
    const reportedByMonth = new Map(monthlyReported.map((m) => [m._id, m.count]));
    const closedByMonth = new Map(monthlyClosed.map((m) => [m._id, m.count]));
    const allKeys = [...reportedByMonth.keys(), ...closedByMonth.keys()].sort();
    const firstMonth = since ?? (allKeys[0] ? new Date(`${allKeys[0]}-01T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), 1));
    const monthly: Array<{ month: string; reported: number; closed: number }> = [];
    for (let d = new Date(firstMonth.getFullYear(), firstMonth.getMonth(), 1); d <= now; d.setMonth(d.getMonth() + 1)) {
      const key = monthKey(d);
      monthly.push({ month: key, reported: reportedByMonth.get(key) ?? 0, closed: closedByMonth.get(key) ?? 0 });
    }

    sendSuccess(
      res,
      {
        scope: hospitalWide ? 'HOSPITAL' : 'DEPARTMENT',
        department: currentDept ? { _id: currentDept._id, name: currentDept.name, code: (currentDept as any).code } : null,
        period,
        since,
        now: {
          byStatus,
          open: OPEN_STATUSES.reduce((sum, s) => sum + byStatus[s], 0),
          oldestAwaitingTriage: oldestSubmitted?.reportedAt ?? null,
          oldestAwaitingReview: (oldestReview as any)?.closureSubmission?.at ?? null,
          activeRework,
          capa,
          hodsPendingCapa,
          topReporters,
        },
        inPeriod: {
          reported,
          rejected,
          closed: closedIncidents.length,
          turnaroundDays: {
            reportToAssign: median(toAssign),
            assignToSubmit: median(hodWork),
            submitToClose: median(qualityReview),
            reportToClose: median(total),
          },
          rework: {
            closed: closedIncidents.length,
            sentBack,
            rate: closedIncidents.length ? Math.round((sentBack / closedIncidents.length) * 100) : null,
            activeRework,
          },
          severity: [1, 2, 3, 4].map((s) => ({ severity: s, count: severityAgg.find((x) => x._id === s)?.count ?? 0 })),
          categories: categoryAgg.map((c) => ({ name: nameOf(categories, c._id), count: c.count })),
          domains,
          departments: (departmentAgg as any[]).map((d) => ({
            name: d._id ? nameOf(departments, d._id) : 'Not assigned yet',
            count: d.count,
          })),
          locations: (locationAgg as any[]).map((l) => ({
            name: l._id ? nameOf(locations, l._id) : 'Not recorded',
            count: l.count,
          })),
          statuses: INCIDENT_STATUSES.map((s) => ({ status: s, count: statusAgg.find((x) => x._id === s)?.count ?? 0 })),
          affectedPersons,
          overdueBuckets,
          locationByType,
          locationBySubtype,
          monthly,
        },
      },
      'Dashboard overview retrieved'
    );
  } catch (error) {
    next(error);
  }
};
