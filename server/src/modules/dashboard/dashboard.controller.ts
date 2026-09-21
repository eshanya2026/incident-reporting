import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Incident } from '../incidents/incident.model.js';
import { Capa } from '../capa/capa.model.js';
import { IncidentCategory } from '../categories/category.model.js';
import { Department } from '../departments/department.model.js';
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
    const [capaCounts, overdueCapas] = await Promise.all([
      Capa.aggregate([{ $match: capaScope }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Capa.countDocuments({ ...capaScope, status: 'OPEN', targetDate: { $lt: startOfToday } }),
    ]);
    const capa = { OPEN: 0, DONE: 0, EFFECTIVE: 0, overdue: overdueCapas };
    capaCounts.forEach((c) => ((capa as any)[c._id] = c.count));

    // ---------- In the period ----------
    const reportedFilter = { ...scope, ...inPeriod('reportedAt') };
    const closedFilter = { ...scope, status: 'CLOSED', ...inPeriod('closedAt') };

    const [reported, rejected, closedIncidents, severityAgg, categoryAgg, departmentAgg, monthlyReported, monthlyClosed] =
      await Promise.all([
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
      ]);

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

    // Names for categories and departments
    const [categories, departments] = await Promise.all([
      IncidentCategory.find({ _id: { $in: categoryAgg.map((c) => c._id) } }).select('name'),
      Department.find({ _id: { $in: departmentAgg.map((d: any) => d._id).filter(Boolean) } }).select('name'),
    ]);
    const nameOf = (list: any[], id: any) => list.find((x) => x._id.toString() === String(id))?.name ?? 'Unknown';

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
          severity: [1, 2, 3, 4, 5].map((s) => ({ severity: s, count: severityAgg.find((x) => x._id === s)?.count ?? 0 })),
          categories: categoryAgg.map((c) => ({ name: nameOf(categories, c._id), count: c.count })),
          departments: (departmentAgg as any[]).map((d) => ({
            name: d._id ? nameOf(departments, d._id) : 'Not assigned yet',
            count: d.count,
          })),
          monthly,
        },
      },
      'Dashboard overview retrieved'
    );
  } catch (error) {
    next(error);
  }
};
