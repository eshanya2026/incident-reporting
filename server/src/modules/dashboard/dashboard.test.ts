import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { Incident, INCIDENT_STATUSES } from '../incidents/incident.model.js';
import { Capa } from '../capa/capa.model.js';
import { Department } from '../departments/department.model.js';
import { User } from '../users/user.model.js';
import { getDashboardOverview } from './dashboard.controller.js';
import { getIncidentRegisterReport, getCapaRegisterReport } from '../reports/report.controller.js';
import { PERMISSIONS } from '../../common/enums/permissions.js';

// Integration test against a seeded MongoDB — run `npm run seed` against this database first
// (it checks controller output against direct counts on whatever is already there, rather than
// creating its own fixtures). Requires an explicit opt-in via TEST_MONGO_URI, the same convention
// every other integration test in this project uses:
//   TEST_MONGO_URI=mongodb://localhost:27099/incident_db npm run seed
//   TEST_MONGO_URI=mongodb://localhost:27099/incident_db npx vitest run
// This must NOT default to a real-looking connection string (it previously defaulted to
// mongodb://localhost:27017/incident_db and ran unconditionally): on a machine that has any other
// MongoDB reachable on the default port — for example another project's own Docker container — a
// plain `npm test` would silently connect to it and, if that project ever also ran this repo's
// seeder against the same default, read real cross-project data instead of failing loudly.
const MONGO_URI = process.env.TEST_MONGO_URI;

describe.skipIf(!MONGO_URI)('Phase 6: Dashboards and Reports Verification against Seed Data', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGO_URI!);
    }
  });

  afterAll(async () => {
    // Keep database intact
  });

  it('verifies hospital-wide dashboard overview numbers match direct database counts', async () => {
    // Manual database counts
    const totalIncidents = await Incident.countDocuments();
    expect(totalIncidents).toBeGreaterThanOrEqual(26);

    const openStatuses = ['SUBMITTED', 'INFO_REQUESTED', 'ASSIGNED', 'UNDER_INVESTIGATION', 'CAPA_IN_PROGRESS', 'PENDING_QUALITY_REVIEW'];
    const expectedOpen = await Incident.countDocuments({ status: { $in: openStatuses } });
    const expectedSubmitted = await Incident.countDocuments({ status: 'SUBMITTED' });
    const expectedPendingReview = await Incident.countDocuments({ status: 'PENDING_QUALITY_REVIEW' });
    const expectedClosed = await Incident.countDocuments({ status: 'CLOSED' });
    const expectedRejected = await Incident.countDocuments({ status: 'REJECTED' });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const expectedOverdueCapas = await Capa.countDocuments({ status: 'OPEN', targetDate: { $lt: startOfToday } });

    // Mock Quality/Admin user request (hospitalWide)
    let overviewResponse: any = null;
    const req: any = {
      user: {
        userId: new mongoose.Types.ObjectId().toString(),
        username: 'quality.anita',
        roles: ['QUALITY'],
        permissions: [PERMISSIONS.INCIDENT_READ_ALL, PERMISSIONS.DASHBOARD_VIEW],
      },
      query: { period: '12m' },
    };
    const res: any = {
      status: () => res,
      json: (data: any) => {
        overviewResponse = data.data;
      },
    };
    const next = (err: any) => {
      if (err) throw err;
    };

    await getDashboardOverview(req, res, next);

    expect(overviewResponse).toBeDefined();
    expect(overviewResponse.scope).toBe('HOSPITAL');
    expect(overviewResponse.now.open).toBe(expectedOpen);
    expect(overviewResponse.now.byStatus.SUBMITTED).toBe(expectedSubmitted);
    expect(overviewResponse.now.byStatus.PENDING_QUALITY_REVIEW).toBe(expectedPendingReview);
    expect(overviewResponse.now.capa.overdue).toBe(expectedOverdueCapas);
    expect(overviewResponse.inPeriod.closed).toBe(expectedClosed);
    expect(overviewResponse.inPeriod.rejected).toBe(expectedRejected);

    // Verify monthly trend sum matches total reported in period
    const totalReportedMonthly = overviewResponse.inPeriod.monthly.reduce(
      (sum: number, m: any) => sum + m.reported,
      0
    );
    expect(totalReportedMonthly).toBe(overviewResponse.inPeriod.reported);
  });

  it('verifies HOD dashboard overview numbers match department-scoped database counts', async () => {
    // Find Emergency department
    const emergencyDept = await Department.findOne({ code: 'EMERGENCY' });
    expect(emergencyDept).toBeDefined();

    const deptId = emergencyDept!._id;

    // Manual department counts
    const openStatuses = ['SUBMITTED', 'INFO_REQUESTED', 'ASSIGNED', 'UNDER_INVESTIGATION', 'CAPA_IN_PROGRESS', 'PENDING_QUALITY_REVIEW'];
    const deptOpen = await Incident.countDocuments({ departmentId: deptId, status: { $in: openStatuses } });
    const deptAssigned = await Incident.countDocuments({ departmentId: deptId, status: 'ASSIGNED' });
    const deptUnderInv = await Incident.countDocuments({ departmentId: deptId, status: 'UNDER_INVESTIGATION' });
    const deptCapaInProgress = await Incident.countDocuments({ departmentId: deptId, status: 'CAPA_IN_PROGRESS' });
    const deptPendingReview = await Incident.countDocuments({ departmentId: deptId, status: 'PENDING_QUALITY_REVIEW' });
    const deptClosed = await Incident.countDocuments({ departmentId: deptId, status: 'CLOSED' });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const deptOverdueCapas = await Capa.countDocuments({
      ownerDepartmentId: deptId,
      status: 'OPEN',
      targetDate: { $lt: startOfToday },
    });

    // Mock HOD request
    let overviewResponse: any = null;
    const req: any = {
      user: {
        userId: new mongoose.Types.ObjectId().toString(),
        username: 'hod.emergency',
        roles: ['HOD'],
        permissions: [PERMISSIONS.INCIDENT_READ_ASSIGNED, PERMISSIONS.DASHBOARD_VIEW],
        departmentId: deptId.toString(),
      },
      query: { period: '12m' },
    };
    const res: any = {
      status: () => res,
      json: (data: any) => {
        overviewResponse = data.data;
      },
    };
    const next = (err: any) => {
      if (err) throw err;
    };

    await getDashboardOverview(req, res, next);

    expect(overviewResponse).toBeDefined();
    expect(overviewResponse.scope).toBe('DEPARTMENT');
    expect(overviewResponse.department.name).toBe('Emergency Medicine');
    expect(overviewResponse.now.open).toBe(deptOpen);
    expect(overviewResponse.now.byStatus.ASSIGNED).toBe(deptAssigned);
    expect(overviewResponse.now.byStatus.UNDER_INVESTIGATION).toBe(deptUnderInv);
    expect(overviewResponse.now.byStatus.CAPA_IN_PROGRESS).toBe(deptCapaInProgress);
    expect(overviewResponse.now.byStatus.PENDING_QUALITY_REVIEW).toBe(deptPendingReview);
    expect(overviewResponse.now.capa.overdue).toBe(deptOverdueCapas);
    expect(overviewResponse.inPeriod.closed).toBe(deptClosed);
  });

  it('verifies incident report contains all required Phase 6 audit fields', async () => {
    let reportRows: any = null;
    const req: any = {
      user: {
        userId: new mongoose.Types.ObjectId().toString(),
        username: 'quality.anita',
        roles: ['QUALITY'],
        permissions: [PERMISSIONS.INCIDENT_READ_ALL, PERMISSIONS.REPORT_VIEW_ALL],
      },
      query: {},
    };
    const res: any = {
      status: () => res,
      json: (data: any) => {
        reportRows = data.data;
      },
    };
    const next = (err: any) => {
      if (err) throw err;
    };

    await getIncidentRegisterReport(req, res, next);

    expect(Array.isArray(reportRows)).toBe(true);
    expect(reportRows.length).toBeGreaterThan(0);

    const firstRow = reportRows[0];
    expect(firstRow).toHaveProperty('incidentNumber');
    expect(firstRow).toHaveProperty('reportedAt');
    expect(firstRow).toHaveProperty('occurredAt');
    expect(firstRow).toHaveProperty('title');
    expect(firstRow).toHaveProperty('category');
    expect(firstRow).toHaveProperty('reportingDepartment');
    expect(firstRow).toHaveProperty('occurredInDepartment');
    expect(firstRow).toHaveProperty('responsibleDepartment');
    expect(firstRow).toHaveProperty('hod');
    expect(firstRow).toHaveProperty('severity');
    expect(firstRow).toHaveProperty('status');
    expect(firstRow).toHaveProperty('daysToAssign');
    expect(firstRow).toHaveProperty('daysToClose');
  });

  it('verifies incident report CSV format export', async () => {
    let sentData: string = '';
    let contentType: string = '';
    let contentDisposition: string = '';

    const req: any = {
      user: {
        userId: new mongoose.Types.ObjectId().toString(),
        username: 'quality.anita',
        roles: ['QUALITY'],
        permissions: [PERMISSIONS.INCIDENT_READ_ALL, PERMISSIONS.REPORT_VIEW_ALL],
      },
      query: { format: 'csv' },
    };
    const res: any = {
      setHeader: (name: string, value: string) => {
        if (name.toLowerCase() === 'content-type') contentType = value;
        if (name.toLowerCase() === 'content-disposition') contentDisposition = value;
      },
      status: () => res,
      send: (body: string) => {
        sentData = body;
      },
    };
    const next = (err: any) => {
      if (err) throw err;
    };

    await getIncidentRegisterReport(req, res, next);

    expect(contentType).toContain('text/csv');
    expect(contentDisposition).toContain('attachment; filename="incident_register.csv"');
    expect(sentData.length).toBeGreaterThan(100);
    expect(sentData).toContain('Incident Number');
    expect(sentData).toContain('Reporting Department');
    expect(sentData).toContain('Occurred In Department');
    expect(sentData).toContain('Responsible Department');
    expect(sentData).toContain('Total Days to Close');
  });

  it('verifies CAPA report CSV format export', async () => {
    let sentData: string = '';
    let contentType: string = '';
    let contentDisposition: string = '';

    const req: any = {
      user: {
        userId: new mongoose.Types.ObjectId().toString(),
        username: 'quality.anita',
        roles: ['QUALITY'],
        permissions: [PERMISSIONS.INCIDENT_READ_ALL, PERMISSIONS.REPORT_VIEW_ALL],
      },
      query: { format: 'csv' },
    };
    const res: any = {
      setHeader: (name: string, value: string) => {
        if (name.toLowerCase() === 'content-type') contentType = value;
        if (name.toLowerCase() === 'content-disposition') contentDisposition = value;
      },
      status: () => res,
      send: (body: string) => {
        sentData = body;
      },
    };
    const next = (err: any) => {
      if (err) throw err;
    };

    await getCapaRegisterReport(req, res, next);

    expect(contentType).toContain('text/csv');
    expect(contentDisposition).toContain('attachment; filename="capa_register.csv"');
    expect(sentData.length).toBeGreaterThan(100);
    expect(sentData).toContain('CAPA Number');
    expect(sentData).toContain('Incident Number');
    expect(sentData).toContain('Department');
    expect(sentData).toContain('Action');
  });
});
