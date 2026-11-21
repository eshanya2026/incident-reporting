import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Incident, SEVERITY_LABELS, CLOSURE_TARGET_DAYS } from '../incidents/incident.model.js';
import { Capa } from '../capa/capa.model.js';
import { IncidentCategory } from '../categories/category.model.js';
import { Department } from '../departments/department.model.js';
import { Location } from '../locations/location.model.js';
import { sendSuccess } from '../../common/helpers/response.js';
import { hasPermission } from '../../common/helpers/incidentAccess.js';
import { PERMISSIONS } from '../../common/enums/permissions.js';
import { AppError } from '../../common/errors/appError.js';
import { logActivity } from '../audit/audit.service.js';
import { CONTENT_W, MUTED, drawLetterhead, DocWriter } from '../../common/pdf/docWriter.js';
import {
  MONTH_KEY,
  MetricCapa,
  MetricIncident,
  MonthIndicators,
  addMonths,
  averageIndicators,
  buildTrendSeries,
  monthIndicators,
  monthKeyOf,
  monthKeys,
  monthLabel,
  monthStart,
  openAt,
  overdueAt,
} from './qualityMetrics.js';

// Quality > Reports > Monthly report (the Quality committee's monthly pack, on screen and as PDF)
// and Trends (monthly counts by category / department / severity, with spikes flagged).
// Hospital-wide for Quality and Admin; an HOD sees only their own department. No reporter names.

const DAY = 24 * 60 * 60 * 1000;
const NOT_ASSIGNED = 'none';

const objectId = z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid id');

/** Department the report covers: the HOD's own; Quality/Admin may pick one or see the whole hospital. */
const scopeDepartment = (req: Request, requested?: string): string | null => {
  const user = req.user!;
  if (hasPermission(user, PERMISSIONS.REPORT_VIEW_ALL)) return requested || null;
  if (!user.departmentId) throw AppError.badRequest('Your account has no department');
  return String(user.departmentId);
};

const loadRecords = async (departmentId: string | null, reportedBefore: Date, reportedFrom?: Date) => {
  const incidentMatch: Record<string, any> = { reportedAt: { $lt: reportedBefore, ...(reportedFrom ? { $gte: reportedFrom } : {}) } };
  if (departmentId) incidentMatch.departmentId = new mongoose.Types.ObjectId(departmentId);
  const [incidents, capas] = await Promise.all([
    Incident.find(incidentMatch)
      .select('incidentNumber title reportedAt severity status categoryId departmentId locationId patientInvolved assignedAt assignments.at closedAt rejection.at')
      .lean(),
    reportedFrom
      ? Promise.resolve([])
      : Capa.find(departmentId ? { ownerDepartmentId: new mongoose.Types.ObjectId(departmentId) } : {})
          .select('status assignedDate targetDate completedAt verification.verifiedAt verification.effective')
          .lean(),
  ]);
  const metricIncidents: MetricIncident[] = (incidents as any[]).map((i) => ({
    _id: String(i._id),
    incidentNumber: i.incidentNumber,
    title: i.title,
    reportedAt: new Date(i.reportedAt),
    severity: i.severity ?? 1,
    status: i.status,
    categoryId: i.categoryId ? String(i.categoryId) : undefined,
    departmentId: i.departmentId ? String(i.departmentId) : undefined,
    locationId: i.locationId ? String(i.locationId) : undefined,
    patientInvolved: Boolean(i.patientInvolved),
    firstAssignedAt: i.assignments?.[0]?.at ?? i.assignedAt ?? undefined,
    closedAt: i.closedAt ?? undefined,
    rejectedAt: i.rejection?.at ?? undefined,
  }));
  const metricCapas: MetricCapa[] = (capas as any[]).map((c) => ({
    status: c.status,
    assignedDate: c.assignedDate ?? undefined,
    targetDate: new Date(c.targetDate),
    completedAt: c.completedAt ?? undefined,
    verifiedAt: c.verification?.verifiedAt ?? undefined,
    effective: c.verification?.effective,
  }));
  return { incidents: metricIncidents, capas: metricCapas };
};

const nameMaps = async (incidents: MetricIncident[]) => {
  const ids = (key: 'categoryId' | 'departmentId' | 'locationId') => [...new Set(incidents.map((i) => i[key]).filter(Boolean))] as string[];
  const [categories, departments, locations] = await Promise.all([
    IncidentCategory.find({ _id: { $in: ids('categoryId') } }).select('name').lean(),
    Department.find({ _id: { $in: ids('departmentId') } }).select('name').lean(),
    Location.find({ _id: { $in: ids('locationId') } }).select('name').lean(),
  ]);
  const toMap = (list: any[]) => new Map(list.map((x) => [String(x._id), x.name as string]));
  const cat = toMap(categories);
  const dept = toMap(departments);
  const loc = toMap(locations);
  return {
    category: (id?: string) => (id && cat.get(id)) || 'Uncategorised',
    department: (id?: string) => (id ? dept.get(id) ?? 'Unknown department' : 'Not assigned yet'),
    location: (id?: string) => (id && loc.get(id)) || 'Not recorded',
  };
};

// ---------- Monthly report ----------

const monthlySchema = z.object({
  month: z.string().regex(MONTH_KEY, 'month must look like 2026-11').optional(),
  departmentId: objectId.optional(),
  patientDays: z.coerce.number().int().positive().max(10_000_000).optional(),
});

const buildMonthlyReport = async (req: Request) => {
  const q = monthlySchema.parse(req.query);
  // Default: last month (the committee reviews the month just finished)
  const month = q.month ?? addMonths(monthKeyOf(new Date()), -1);
  if (monthStart(month) > new Date()) throw AppError.badRequest('That month has not started yet');
  const departmentId = scopeDepartment(req, q.departmentId);
  const end = monthStart(addMonths(month, 1));
  const start = monthStart(month);

  const { incidents, capas } = await loadRecords(departmentId, end);
  const names = await nameMaps(incidents);
  const departmentName = departmentId ? (await Department.findById(departmentId).select('name').lean())?.name ?? 'Unknown department' : null;

  const current = monthIndicators(incidents, capas, month, q.patientDays);
  const previousMonths = [1, 2, 3].map((n) => monthIndicators(incidents, capas, addMonths(month, -n)));
  const previous = previousMonths[0];
  const average3 = averageIndicators(previousMonths);

  const inRange = (from: string, to: string) => (i: MetricIncident) =>
    i.status !== 'REJECTED' && i.reportedAt >= monthStart(from) && i.reportedAt < monthStart(addMonths(to, 1));
  const thisMonth = incidents.filter(inRange(month, month));
  const lastMonth = incidents.filter(inRange(addMonths(month, -1), addMonths(month, -1)));
  const prior3 = incidents.filter(inRange(addMonths(month, -3), addMonths(month, -1)));

  const countBy = (list: MetricIncident[], key: (i: MetricIncident) => string) =>
    list.reduce((m, i) => m.set(key(i), (m.get(key(i)) ?? 0) + 1), new Map<string, number>());

  // Categories: this month vs last month and the 3 months before
  const catNow = countBy(thisMonth, (i) => i.categoryId ?? '');
  const catPrev = countBy(lastMonth, (i) => i.categoryId ?? '');
  const catPrior = countBy(prior3, (i) => i.categoryId ?? '');
  const categories = [...new Set([...catNow.keys(), ...catPrev.keys()])]
    .map((id) => ({
      name: names.category(id || undefined),
      count: catNow.get(id) ?? 0,
      previous: catPrev.get(id) ?? 0,
      average3: Math.round(((catPrior.get(id) ?? 0) / 3) * 10) / 10,
    }))
    .sort((a, b) => b.count - a.count || b.previous - a.previous);

  // Departments (responsible department): reported this month, closed this month, open / overdue at month end
  const deptIds = new Set<string>();
  const deptRow = (id: string) => ({ reported: 0, closed: 0, openAtEnd: 0, overdueAtEnd: 0, serious: 0, id });
  const deptRows = new Map<string, ReturnType<typeof deptRow>>();
  const row = (id?: string) => {
    const key = id ?? NOT_ASSIGNED;
    deptIds.add(key);
    return deptRows.get(key) ?? deptRows.set(key, deptRow(key)).get(key)!;
  };
  for (const i of thisMonth) {
    const r = row(i.departmentId);
    r.reported += 1;
    if (i.severity >= 4) r.serious += 1;
  }
  for (const i of incidents) {
    if (i.status === 'CLOSED' && i.closedAt && i.closedAt >= start && i.closedAt < end) row(i.departmentId).closed += 1;
    if (openAt(i, end)) row(i.departmentId).openAtEnd += 1;
    if (overdueAt(i, end)) row(i.departmentId).overdueAtEnd += 1;
  }
  const departments = [...deptRows.values()]
    .map((r) => ({ name: names.department(r.id === NOT_ASSIGNED ? undefined : r.id), reported: r.reported, closed: r.closed, openAtEnd: r.openAtEnd, overdueAtEnd: r.overdueAtEnd, serious: r.serious }))
    .sort((a, b) => b.reported - a.reported || b.overdueAtEnd - a.overdueAtEnd);

  // Serious events (permanent harm, sentinel) reported this month
  const seriousEvents = thisMonth
    .filter((i) => i.severity >= 4)
    .sort((a, b) => b.severity - a.severity || a.reportedAt.getTime() - b.reportedAt.getTime())
    .map((i) => ({
      _id: i._id,
      incidentNumber: i.incidentNumber,
      title: i.title,
      severity: i.severity,
      severityLabel: SEVERITY_LABELS[i.severity],
      department: names.department(i.departmentId),
      category: names.category(i.categoryId),
      status: i.status,
      reportedAt: i.reportedAt,
    }));

  // Repeats: same location + category twice or more this month
  const repeatsAtLocation = [...countBy(thisMonth, (i) => `${i.locationId ?? ''}|${i.categoryId ?? ''}`).entries()]
    .filter(([, n]) => n >= 2)
    .map(([key, count]) => {
      const [loc, cat] = key.split('|');
      return { location: names.location(loc || undefined), category: names.category(cat || undefined), count };
    })
    .sort((a, b) => b.count - a.count);
  // Recurring: same department + category in each of the last 3 months
  const last3 = [addMonths(month, -2), addMonths(month, -1), month];
  const recurringMap = new Map<string, number[]>();
  for (const i of incidents.filter(inRange(last3[0], month))) {
    const key = `${i.departmentId ?? ''}|${i.categoryId ?? ''}`;
    const counts = recurringMap.get(key) ?? recurringMap.set(key, [0, 0, 0]).get(key)!;
    counts[last3.indexOf(monthKeyOf(i.reportedAt))] += 1;
  }
  const recurring = [...recurringMap.entries()]
    .filter(([, c]) => c.every((n) => n > 0))
    .map(([key, counts]) => {
      const [dept, cat] = key.split('|');
      return { department: names.department(dept || undefined), category: names.category(cat || undefined), counts, total: counts[0] + counts[1] + counts[2] };
    })
    .sort((a, b) => b.total - a.total);

  // Open past their closure target at month end, oldest first
  const overdue = incidents
    .filter((i) => overdueAt(i, end))
    .map((i) => ({
      _id: i._id,
      incidentNumber: i.incidentNumber,
      title: i.title,
      severity: i.severity,
      department: names.department(i.departmentId),
      status: i.status,
      daysOpen: Math.floor((end.getTime() - i.reportedAt.getTime()) / DAY),
      targetDays: CLOSURE_TARGET_DAYS[i.severity] ?? 30,
    }))
    .sort((a, b) => b.daysOpen - a.daysOpen);

  return {
    month,
    monthLabel: monthLabel(month),
    scope: departmentName ? 'DEPARTMENT' : 'HOSPITAL',
    department: departmentName,
    patientDays: q.patientDays ?? null,
    generatedAt: new Date(),
    current,
    previous,
    average3,
    categories,
    departments,
    seriousEvents,
    repeatsAtLocation,
    recurring,
    overdue,
  };
};

type MonthlyReport = Awaited<ReturnType<typeof buildMonthlyReport>>;

/** GET /reports/monthly?month=2026-10[&departmentId][&patientDays] */
export const getMonthlyReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const report = await buildMonthlyReport(req);
    await logActivity('REPORT_MONTHLY_VIEWED', `Viewed the monthly quality report for ${report.monthLabel}`, { req, meta: { month: report.month, department: report.department } });
    sendSuccess(res, report, 'Monthly report');
  } catch (error) {
    next(error);
  }
};

// ---------- Monthly report PDF ----------

const fmt = (v: number | null | undefined, unit = '') => (v === null || v === undefined ? '-' : `${v}${unit}`);
const fmtDate = (d: Date) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
const statusText = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

/** The indicator rows shared by the screen and the PDF: [label, key, unit, note]. */
export const INDICATOR_ROWS: Array<[string, keyof MonthIndicators, string]> = [
  ['Incidents reported', 'reported', ''],
  ['Reporting rate per 1,000 patient days', 'reportingRate', ''],
  ['Near misses', 'nearMiss', ''],
  ['Near-miss ratio', 'nearMissRatio', '%'],
  ['Harm events (adverse, permanent harm, sentinel)', 'harm', ''],
  ['Serious events (permanent harm, sentinel)', 'serious', ''],
  ['Sentinel events', 'sentinel', ''],
  ['Patient involved', 'patientInvolved', ''],
  ['Rejected (not an incident / duplicate)', 'rejected', ''],
  ['Median days from report to assignment', 'medianDaysToAssign', ' d'],
  ['Incidents closed', 'closed', ''],
  ['Closed within target time', 'closedOnTimeRate', '%'],
  ['Median days from report to closure', 'medianDaysToClose', ' d'],
  ['Open at month end', 'openAtEnd', ''],
  ['Open past target at month end', 'overdueAtEnd', ''],
  ['CAPAs raised', 'capaRaised', ''],
  ['CAPAs due this month', 'capaDue', ''],
  ['CAPAs completed by target date', 'capaOnTimeRate', '%'],
  ['CAPAs overdue at month end', 'capaOverdueAtEnd', ''],
  ['CAPAs verified effective', 'capaEffectiveRate', '%'],
];

const buildMonthlyPdf = async (r: MonthlyReport): Promise<Uint8Array> => {
  const w = await DocWriter.create();
  drawLetterhead(w, 'QUALITY COMMITTEE', 'MONTHLY INCIDENT REPORT');
  w.titleBand(
    'Monthly Incident Report',
    `${r.monthLabel}  ·  ${r.department ? `Department: ${r.department}` : 'Whole hospital'}`,
    `Generated ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
  );

  // Breathing room above each section heading (tables end flush with their last row)
  const section = (title: string) => {
    w.spacer(14);
    w.h2(title);
  };

  const c = r.current;
  w.infoGrid(
    [
      ['Reported', String(c.reported)],
      ['Near-miss ratio', fmt(c.nearMissRatio, '%')],
      ['Serious events', String(c.serious)],
      ['Closed on time', fmt(c.closedOnTimeRate, '%')],
      ['Open past target', String(c.overdueAtEnd)],
      ['CAPA on time', fmt(c.capaOnTimeRate, '%')],
    ],
    3
  );

  section('Key indicators');
  const avg = r.average3 as Record<string, number | null>;
  w.table(
    ['Indicator', r.monthLabel, monthLabel(r.previous.month, true), '3-month avg'],
    INDICATOR_ROWS.filter(([, key]) => key !== 'reportingRate' || c.reportingRate !== null).map(([label, key, unit]) => [
      label,
      fmt(c[key] as number | null, unit),
      key === 'reportingRate' ? '-' : fmt(r.previous[key] as number | null, unit),
      key === 'reportingRate' ? '-' : fmt(avg[key], unit),
    ]),
    [235, 90, 85, CONTENT_W - 410]
  );
  if (r.patientDays) w.paragraph(`Patient days this month: ${r.patientDays.toLocaleString('en-IN')}.`, { size: 8.5, color: MUTED });

  section('By severity');
  w.table(
    ['Severity', r.monthLabel, monthLabel(r.previous.month, true)],
    [1, 2, 3, 4, 5].map((s) => [`${s} - ${SEVERITY_LABELS[s]}`, String(c.bySeverity[s - 1]), String(r.previous.bySeverity[s - 1])]),
    [255, 120, CONTENT_W - 375]
  );

  section('Serious events (permanent harm and sentinel)');
  if (!r.seriousEvents.length) w.paragraph('None reported this month.', { color: MUTED });
  else
    w.table(
      ['Incident', 'What happened', 'Department', 'Status'],
      r.seriousEvents.map((e) => [`${e.incidentNumber}\n${e.severityLabel}`, e.title, e.department, statusText(e.status)]),
      [105, 190, 120, CONTENT_W - 415]
    );

  section('Incident types');
  if (!r.categories.length) w.paragraph('No incidents reported.', { color: MUTED });
  else
    w.table(
      ['Category', r.monthLabel, monthLabel(r.previous.month, true), '3-month avg'],
      r.categories.slice(0, 15).map((x) => [x.name, String(x.count), String(x.previous), String(x.average3)]),
      [235, 90, 85, CONTENT_W - 410]
    );

  section('Departments');
  if (!r.departments.length) w.paragraph('Nothing to show.', { color: MUTED });
  else
    w.table(
      ['Department', 'Reported', 'Serious', 'Closed', 'Open', 'Past target'],
      r.departments.slice(0, 25).map((d) => [d.name, String(d.reported), String(d.serious), String(d.closed), String(d.openAtEnd), String(d.overdueAtEnd)]),
      [195, 60, 55, 55, 55, CONTENT_W - 420]
    );

  section('Repeat incidents');
  if (!r.repeatsAtLocation.length && !r.recurring.length) w.paragraph('No repeats found.', { color: MUTED });
  if (r.repeatsAtLocation.length) {
    w.h3('Same type at the same location this month');
    w.table(['Location', 'Category', 'Count'], r.repeatsAtLocation.slice(0, 15).map((x) => [x.location, x.category, String(x.count)]), [190, 235, CONTENT_W - 425]);
  }
  if (r.recurring.length) {
    w.spacer(6);
    w.h3('Same type in the same department in each of the last 3 months');
    const [m1, m2, m3] = [-2, -1, 0].map((n) => monthLabel(addMonths(r.month, n), true));
    w.table(
      ['Department', 'Category', m1, m2, m3],
      r.recurring.slice(0, 15).map((x) => [x.department, x.category, ...x.counts.map(String)]),
      [150, 165, 60, 60, CONTENT_W - 435]
    );
  }

  section('Open past their closure target at month end');
  if (!r.overdue.length) w.paragraph('None.', { color: MUTED });
  else {
    w.table(
      ['Incident', 'What happened', 'Department', 'Days open'],
      r.overdue.slice(0, 25).map((o) => [`${o.incidentNumber}\nSeverity ${o.severity}`, o.title, o.department, `${o.daysOpen} (target ${o.targetDays})`]),
      [105, 190, 120, CONTENT_W - 415]
    );
    if (r.overdue.length > 25) w.paragraph(`...and ${r.overdue.length - 25} more (see the incident register).`, { size: 8.5, color: MUTED });
  }

  // The notes and the signature lines stay together on one page
  w.ensureSpace(250);
  section('How these are counted');
  [
    'Months are calendar months in IST. Rejected reports (duplicates, not an incident) are left out of every figure except "Rejected".',
    'Near-miss ratio = near misses (severity 1) / incidents reported. A higher ratio usually means a healthy reporting culture.',
    'Closure targets by severity: 1 - 30 days, 2 - 21, 3 - 14, 4 - 10, 5 - 7. "Closed within target time" counts incidents closed this month.',
    'Departments are the department responsible for the incident (assigned by Quality). Reporter identities are not included in this report.',
    'Reporting rate is shown only when patient days for the month were entered.',
  ].forEach((t) => w.bullet(t));

  w.ensureSpace(60);
  w.y -= 40;
  const half = CONTENT_W / 2;
  const sigY = w.y;
  for (const [i, label] of ['Quality Manager', 'Medical Superintendent'].entries()) {
    const x = 50 + i * half;
    w.page.drawLine({ start: { x, y: sigY }, end: { x: x + half - 40, y: sigY }, thickness: 0.75, color: MUTED });
    w.page.drawText(label, { x, y: sigY - 12, size: 9, font: w.regular, color: MUTED });
  }
  w.y = sigY - 20;

  return w.doc.save();
};

/** GET /reports/monthly/pdf — the same report as a PDF for the committee. */
export const downloadMonthlyReportPdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const report = await buildMonthlyReport(req);
    const pdf = await buildMonthlyPdf(report);
    await logActivity('REPORT_MONTHLY_PDF_DOWNLOADED', `Downloaded the monthly quality report for ${report.monthLabel} (PDF)`, {
      req,
      meta: { month: report.month, department: report.department, format: 'PDF' },
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Monthly_Incident_Report_${report.month}.pdf"`);
    res.send(Buffer.from(pdf));
  } catch (error) {
    next(error);
  }
};

// ---------- Trends ----------

const trendsSchema = z.object({
  months: z.coerce.number().int().refine((n) => [6, 12, 24].includes(n), 'months must be 6, 12 or 24').optional().default(12),
  by: z.enum(['category', 'department', 'severity']).optional().default('category'),
  departmentId: objectId.optional(),
});

/** GET /reports/trends?months=12&by=category — monthly counts per group, latest month flagged when it spikes. */
export const getTrends = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const q = trendsSchema.parse(req.query);
    const departmentId = scopeDepartment(req, q.departmentId);
    const current = monthKeyOf(new Date());
    const months = monthKeys(current, q.months);
    const { incidents } = await loadRecords(departmentId, monthStart(addMonths(current, 1)), monthStart(months[0]));
    const names = await nameMaps(incidents);
    const groupOf = (i: MetricIncident) =>
      q.by === 'category' ? i.categoryId ?? '' : q.by === 'department' ? i.departmentId ?? NOT_ASSIGNED : String(i.severity);
    const nameOf = (id: string) =>
      q.by === 'category'
        ? names.category(id || undefined)
        : q.by === 'department'
          ? names.department(id === NOT_ASSIGNED ? undefined : id)
          : `${id} - ${SEVERITY_LABELS[Number(id)] ?? ''}`;
    let series = buildTrendSeries(incidents, months, groupOf).map((s) => ({ ...s, name: nameOf(s.id) }));
    if (q.by === 'severity') series = series.sort((a, b) => Number(a.id) - Number(b.id));
    const totals = months.map((_, i) => series.reduce((sum, s) => sum + s.counts[i], 0));
    sendSuccess(res, {
      months: months.map((key) => ({ key, label: monthLabel(key, true) })),
      partialLastMonth: true, // the current month is still running
      by: q.by,
      totals,
      series,
    });
  } catch (error) {
    next(error);
  }
};
