import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { Incident } from './incident.model.js';
import { IncidentWorkflowService } from './incidentWorkflow.service.js';
import { Department } from '../departments/department.model.js';
import { User } from '../users/user.model.js';
import { Investigation } from '../investigations/investigation.model.js';
import { RootCauseAnalysis } from '../rca/rca.model.js';
import { Capa } from '../capa/capa.model.js';
import { JwtPayload } from '../auth/auth.utils.js';

// Integration test against a real MongoDB. Runs only when TEST_MONGO_URI points at a
// throwaway database, e.g. TEST_MONGO_URI=mongodb://localhost:27099/workflow_test npx vitest run
// Each test file uses its own database (files run in parallel and drop their database)
const withDbName = (uri: string, db: string) => {
  const url = new URL(uri);
  url.pathname = `/${db}`;
  return url.toString();
};
// Opt-in only: this drops the target database in beforeAll/afterAll, so it must never fall back to a
// real-looking default (MONGO_URI, or a hardcoded localhost:27017/incident_db). On a machine with any
// other MongoDB reachable on the default port -- e.g. another project's own Docker container -- a
// plain `npm test` with no env vars would otherwise silently connect to it and drop a database there.
const MONGO_URI = process.env.TEST_MONGO_URI ? withDbName(process.env.TEST_MONGO_URI, 'workflow_service_test') : undefined;

describe.skipIf(!MONGO_URI)('IncidentWorkflowService (MongoDB)', () => {
  const oid = () => new mongoose.Types.ObjectId();
  const ids = { staff: oid(), quality: oid(), hod: oid(), otherHod: oid(), dept: oid(), otherDept: oid(), noHodDept: oid() };

  const as = (userId: mongoose.Types.ObjectId, roles: string[], departmentId?: mongoose.Types.ObjectId): JwtPayload => ({
    userId: userId.toString(),
    username: 'test',
    roles,
    permissions: [],
    departmentId: departmentId?.toString(),
  });
  const staff = as(ids.staff, ['STAFF'], ids.otherDept);
  const quality = as(ids.quality, ['QUALITY']);
  const hod = as(ids.hod, ['HOD'], ids.dept);
  const otherHod = as(ids.otherHod, ['HOD'], ids.otherDept);

  let seq = 0;
  const newIncident = () =>
    Incident.create({
      incidentNumber: `TEST-${Date.now()}-${++seq}`,
      reportedBy: ids.staff,
      incidentDateTime: new Date(),
      reportingDepartmentId: ids.otherDept,
      occurredInDepartmentId: ids.dept,
      locationId: oid(),
      categoryId: oid(),
      title: 'Test incident',
      description: 'Test description',
      initialSeverity: 2,
      severity: 2,
      status: 'SUBMITTED',
    });

  const perform = (incidentId: unknown, action: any, user: JwtPayload, input?: any) =>
    IncidentWorkflowService.perform({ incidentId: String(incidentId), action, user, input });

  beforeAll(async () => {
    await mongoose.connect(MONGO_URI!);
    await mongoose.connection.dropDatabase();
    const user = (id: mongoose.Types.ObjectId, username: string, departmentId?: mongoose.Types.ObjectId) =>
      User.create({ _id: id, employeeId: username, name: username, email: `${username}@x.test`, username, passwordHash: 'x', departmentId, status: 'ACTIVE' });
    await Promise.all([
      user(ids.staff, 'staff', ids.otherDept),
      user(ids.quality, 'quality'),
      user(ids.hod, 'hod', ids.dept),
      user(ids.otherHod, 'otherhod', ids.otherDept),
    ]);
    await Department.create([
      { _id: ids.dept, code: 'D1', name: 'Dept One', hodUserId: ids.hod },
      { _id: ids.otherDept, code: 'D2', name: 'Dept Two', hodUserId: ids.otherHod },
      { _id: ids.noHodDept, code: 'D3', name: 'Dept Three' },
    ]);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('runs the full flow, including an info request, a send-back and the timeline', async () => {
    const incident = await newIncident();

    await perform(incident._id, 'REQUEST_INFO', quality, { text: 'Which bed?' });
    let doc = await perform(incident._id, 'RESPOND_INFO', staff, { text: 'Bed 4' });
    expect(doc.status).toBe('SUBMITTED');
    expect(doc.infoRequests[0]).toMatchObject({ question: 'Which bed?', response: 'Bed 4' });

    doc = await perform(incident._id, 'ASSIGN', quality, { departmentId: ids.dept.toString(), severity: 4, text: 'Major harm' });
    expect(doc).toMatchObject({ status: 'ASSIGNED', severity: 4, requiresRca: true, requiresCapa: true });
    expect(doc.assignedHod?.toString()).toBe(ids.hod.toString());
    expect(doc.assignments).toHaveLength(1);

    await expect(perform(incident._id, 'START_INVESTIGATION', otherHod)).rejects.toMatchObject({ statusCode: 403 });
    doc = await perform(incident._id, 'START_INVESTIGATION', hod);
    expect(doc.status).toBe('UNDER_INVESTIGATION');
    const investigation = await Investigation.findOne({ incidentId: incident._id });
    expect(investigation?.investigatorId.toString()).toBe(ids.hod.toString());

    // Gate: investigation and RCA must be complete before moving to CAPA
    await expect(perform(incident._id, 'COMPLETE_INVESTIGATION', hod)).rejects.toMatchObject({ statusCode: 400 });
    await Investigation.updateOne({ incidentId: incident._id }, { status: 'COMPLETED', findings: 'Label missing' });
    await RootCauseAnalysis.create({ incidentId: incident._id, rootCauseSummary: 'No double check', status: 'COMPLETED' });
    doc = await perform(incident._id, 'COMPLETE_INVESTIGATION', hod);
    expect(doc.status).toBe('CAPA_IN_PROGRESS');

    const capa = await Capa.create({
      capaNumber: `CAPA-TEST-${seq}`,
      incidentId: incident._id,
      type: 'CORRECTIVE',
      action: 'Double check',
      ownerUserId: ids.hod,
      ownerDepartmentId: ids.dept,
      targetDate: new Date(),
      status: 'OPEN',
    });
    await expect(perform(incident._id, 'SUBMIT_CLOSURE', hod, { text: 'Done' })).rejects.toThrow(/not marked done/);
    await Capa.updateOne({ _id: capa._id }, { status: 'DONE' });
    doc = await perform(incident._id, 'SUBMIT_CLOSURE', hod, { text: 'All CAPA done' });
    expect(doc.status).toBe('PENDING_QUALITY_REVIEW');

    // Quality sends it back: the CAPA reopens with the review remarks
    doc = await perform(incident._id, 'REVIEW_RETURN', quality, {
      text: 'Evidence missing',
      capaResults: [{ capaId: capa._id.toString(), effective: false, remarks: 'Attach the audit sheet' }],
    });
    expect(doc.status).toBe('CAPA_IN_PROGRESS');
    let capaDoc = await Capa.findById(capa._id);
    expect(capaDoc?.status).toBe('OPEN');
    expect(capaDoc?.verification).toMatchObject({ effective: false, remarks: 'Attach the audit sheet' });

    await Capa.updateOne({ _id: capa._id }, { status: 'DONE' });
    await perform(incident._id, 'SUBMIT_CLOSURE', hod, { text: 'Audit sheet attached' });
    await expect(
      perform(incident._id, 'REVIEW_ACCEPT', quality, { text: 'OK', capaResults: [] })
    ).rejects.toThrow(/verdict is required/);
    doc = await perform(incident._id, 'REVIEW_ACCEPT', quality, {
      text: 'Effective',
      capaResults: [{ capaId: capa._id.toString(), effective: true }],
    });
    expect(doc.status).toBe('CLOSED');
    expect(doc.closedBy?.toString()).toBe(ids.quality.toString());
    capaDoc = await Capa.findById(capa._id);
    expect(capaDoc?.status).toBe('EFFECTIVE');
    expect(doc.qualityReviews.map((r) => r.decision)).toEqual(['RETURNED', 'ACCEPTED']);

    // Closed is final
    await expect(perform(incident._id, 'REVIEW_RETURN', quality, { text: 'Again' })).rejects.toMatchObject({ statusCode: 409 });

    const timeline = await IncidentWorkflowService.timeline(incident._id.toString());
    expect(timeline.map((t) => t.action)).toEqual([
      'REQUEST_INFO',
      'RESPOND_INFO',
      'ASSIGN',
      'START_INVESTIGATION',
      'COMPLETE_INVESTIGATION',
      'SUBMIT_CLOSURE',
      'REVIEW_RETURN',
      'SUBMIT_CLOSURE',
      'REVIEW_ACCEPT',
    ]);
    expect(timeline[2]).toMatchObject({ fromStatus: 'SUBMITTED', toStatus: 'ASSIGNED', text: 'Major harm' });
  });

  it('HOD return clears the assignment but keeps the history', async () => {
    const incident = await newIncident();
    await perform(incident._id, 'ASSIGN', quality, { departmentId: ids.dept.toString(), severity: 2 });
    const doc = await perform(incident._id, 'RETURN_TO_QUALITY', hod, { text: 'Not our department' });
    expect(doc.status).toBe('SUBMITTED');
    expect(doc.departmentId).toBeUndefined();
    expect(doc.assignedHod).toBeUndefined();
    expect(doc.assignments).toHaveLength(1);
    expect(doc.hodReturns[0].reason).toBe('Not our department');
  });

  it('refuses to assign to a department without an HOD, and rejects with a reason', async () => {
    const incident = await newIncident();
    await expect(
      perform(incident._id, 'ASSIGN', quality, { departmentId: ids.noHodDept.toString(), severity: 2 })
    ).rejects.toThrow(/no active HOD/);
    await expect(perform(incident._id, 'REJECT', quality, { text: '' })).rejects.toMatchObject({ statusCode: 400 });
    const doc = await perform(incident._id, 'REJECT', quality, { text: 'Duplicate' });
    expect(doc.status).toBe('REJECTED');
    await expect(perform(incident._id, 'ASSIGN', quality, { departmentId: ids.dept.toString(), severity: 2 })).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('rejects a CAPA verdict for a CAPA of another incident', async () => {
    const incident = await newIncident();
    await expect(
      perform(incident._id, 'ASSIGN', quality, {
        departmentId: ids.dept.toString(),
        severity: 2,
        capaResults: [{ capaId: oid().toString(), effective: true }],
      })
    ).rejects.toThrow(/does not belong to this incident/);
  });

  it('refuses a stale save when someone else changed the incident first', async () => {
    const incident = await newIncident();
    const copyA = await Incident.findById(incident._id);
    const copyB = await Incident.findById(incident._id);
    copyA!.title = 'Changed by A';
    await copyA!.save();
    copyB!.title = 'Changed by B';
    await expect(copyB!.save()).rejects.toBeInstanceOf(mongoose.Error.VersionError);
  });
});
