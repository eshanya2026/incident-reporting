import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { Incident } from '../incidents/incident.model.js';
import { IncidentWorkflowService } from '../incidents/incidentWorkflow.service.js';
import { Department } from '../departments/department.model.js';
import { User } from '../users/user.model.js';
import { Role } from '../roles/role.model.js';
import { Investigation } from '../investigations/investigation.model.js';
import { Capa } from '../capa/capa.model.js';
import { Notification } from './notification.model.js';
import { notifyUsers } from './notification.service.js';
import { notifyOverdueCapas } from '../capa/capaOverdue.job.js';
import { JwtPayload } from '../auth/auth.utils.js';

// Integration test against a throwaway MongoDB:
//   TEST_MONGO_URI=mongodb://localhost:27099/notifications_test npx vitest run
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
const MONGO_URI = process.env.TEST_MONGO_URI ? withDbName(process.env.TEST_MONGO_URI, 'notifications_test') : undefined;

describe.skipIf(!MONGO_URI)('notifications (MongoDB)', () => {
  const oid = () => new mongoose.Types.ObjectId();
  const ids = { staff: oid(), quality1: oid(), quality2: oid(), qualityInactive: oid(), hod: oid(), dept: oid() };
  const as = (userId: mongoose.Types.ObjectId, roles: string[], departmentId?: mongoose.Types.ObjectId): JwtPayload => ({
    userId: userId.toString(),
    username: 'test',
    roles,
    permissions: [],
    departmentId: departmentId?.toString(),
  });
  const staff = as(ids.staff, ['STAFF']);
  const quality = as(ids.quality1, ['QUALITY']);
  const hod = as(ids.hod, ['HOD'], ids.dept);

  /** Notification types each user received since the last reset, e.g. { staff: ['INCIDENT_REQUEST_INFO'] }. */
  const received = async () => {
    const all = await Notification.find().sort({ createdAt: 1 });
    const name = (id: string) => (Object.entries(ids).find(([, v]) => v.toString() === id) ?? ['?'])[0];
    const out: Record<string, string[]> = {};
    for (const n of all) (out[name(n.userId.toString())] ??= []).push(n.type);
    return out;
  };

  let seq = 0;
  const newIncident = async () => {
    const incident = await Incident.create({
      incidentNumber: `NTEST-${++seq}`,
      reportedBy: ids.staff,
      incidentDateTime: new Date(),
      occurredInDepartmentId: ids.dept,
      locationId: oid(),
      categoryId: oid(),
      title: 'Test incident',
      description: 'Test description',
      initialSeverity: 3,
      severity: 3,
      status: 'SUBMITTED',
    });
    await IncidentWorkflowService.recordSubmission(incident, staff);
    return incident;
  };
  const perform = (incident: any, action: any, user: JwtPayload, input?: any) =>
    IncidentWorkflowService.perform({ incidentId: incident._id.toString(), action, user, input });

  beforeAll(async () => {
    await mongoose.connect(MONGO_URI!);
    await mongoose.connection.dropDatabase();
    const [qualityRole, hodRole, staffRole] = await Role.create([
      { name: 'Quality', code: 'QUALITY', permissions: [] },
      { name: 'HOD', code: 'HOD', permissions: [] },
      { name: 'Staff', code: 'STAFF', permissions: [] },
    ]);
    const user = (id: mongoose.Types.ObjectId, username: string, role: any, status = 'ACTIVE', departmentId?: mongoose.Types.ObjectId) =>
      User.create({ _id: id, employeeId: username, name: username, email: `${username}@x.test`, username, passwordHash: 'x', roles: [role._id], status, departmentId });
    await Promise.all([
      user(ids.staff, 'staff', staffRole),
      user(ids.quality1, 'quality1', qualityRole),
      user(ids.quality2, 'quality2', qualityRole),
      user(ids.qualityInactive, 'qinactive', qualityRole, 'INACTIVE'),
      user(ids.hod, 'hod', hodRole, 'ACTIVE', ids.dept),
    ]);
    await Department.create({ _id: ids.dept, code: 'D1', name: 'Dept One', hodUserId: ids.hod });
  });

  beforeEach(async () => {
    await Notification.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('a new report goes to every active Quality user', async () => {
    await newIncident();
    expect(await received()).toEqual({ quality1: ['INCIDENT_SUBMITTED'], quality2: ['INCIDENT_SUBMITTED'] });
  });

  it('each hand-over notifies the next person, never the person acting', async () => {
    const incident = await newIncident();
    await Notification.deleteMany({});

    await perform(incident, 'REQUEST_INFO', quality, { text: 'Which bed?' });
    expect(await received()).toEqual({ staff: ['INCIDENT_REQUEST_INFO'] });

    await Notification.deleteMany({});
    await perform(incident, 'RESPOND_INFO', staff, { text: 'Bed 4' });
    expect(await received()).toEqual({ quality1: ['INCIDENT_RESPOND_INFO'], quality2: ['INCIDENT_RESPOND_INFO'] });

    await Notification.deleteMany({});
    await perform(incident, 'ASSIGN', quality, { departmentId: ids.dept.toString(), severity: 3 });
    expect(await received()).toEqual({ hod: ['INCIDENT_ASSIGN'] });

    await Notification.deleteMany({});
    await perform(incident, 'START_INVESTIGATION', hod);
    expect(await received()).toEqual({});

    await Investigation.updateOne({ incidentId: incident._id }, { status: 'COMPLETED', findings: 'Found' });
    await perform(incident, 'COMPLETE_INVESTIGATION', hod);
    const capa = await Capa.create({
      capaNumber: `NCAPA-${seq}`,
      incidentId: incident._id,
      type: 'CORRECTIVE',
      action: 'Fix',
      ownerUserId: ids.hod,
      ownerDepartmentId: ids.dept,
      targetDate: new Date(Date.now() + 864e5),
      status: 'DONE',
    });
    await Notification.deleteMany({});
    await perform(incident, 'SUBMIT_CLOSURE', hod, { text: 'Done' });
    expect(await received()).toEqual({ quality1: ['INCIDENT_SUBMIT_CLOSURE'], quality2: ['INCIDENT_SUBMIT_CLOSURE'] });

    await Notification.deleteMany({});
    await perform(incident, 'REVIEW_RETURN', quality, { text: 'More evidence', capaResults: [{ capaId: capa._id.toString(), effective: false }] });
    expect(await received()).toEqual({ hod: ['INCIDENT_REVIEW_RETURN'] });

    await Capa.updateOne({ _id: capa._id }, { status: 'DONE' });
    await perform(incident, 'SUBMIT_CLOSURE', hod, { text: 'Evidence added' });
    await Notification.deleteMany({});
    await perform(incident, 'REVIEW_ACCEPT', quality, { text: 'Effective', capaResults: [{ capaId: capa._id.toString(), effective: true }] });
    expect(await received()).toEqual({ staff: ['INCIDENT_REVIEW_ACCEPT'], hod: ['INCIDENT_REVIEW_ACCEPT'] });

    const toReporter = await Notification.findOne({ userId: ids.staff });
    expect(toReporter).toMatchObject({ title: 'Your report has been closed', entityType: 'INCIDENT' });
    expect(toReporter?.message).toContain('Effective');
    expect(toReporter?.entityId?.toString()).toBe(incident._id.toString());
  });

  it('HOD return and rejection reach the right people', async () => {
    const incident = await newIncident();
    await perform(incident, 'ASSIGN', quality, { departmentId: ids.dept.toString(), severity: 2 });
    await Notification.deleteMany({});
    await perform(incident, 'RETURN_TO_QUALITY', hod, { text: 'Wrong department' });
    expect(await received()).toEqual({ quality1: ['INCIDENT_RETURN_TO_QUALITY'], quality2: ['INCIDENT_RETURN_TO_QUALITY'] });

    await Notification.deleteMany({});
    await perform(incident, 'REJECT', quality, { text: 'Duplicate' });
    expect(await received()).toEqual({ staff: ['INCIDENT_REJECT'] });
  });

  it('never notifies the person acting or inactive users', async () => {
    const count = await notifyUsers({
      userIds: [ids.quality1, ids.quality2, ids.qualityInactive, ids.quality2],
      exceptUserId: ids.quality1,
      type: 'TEST',
      title: 't',
      message: 'm',
    });
    expect(count).toBe(1);
    expect(await received()).toEqual({ quality2: ['TEST'] });
  });

  it('reports each overdue CAPA once, to the HOD and Quality', async () => {
    const incident = await newIncident();
    await perform(incident, 'ASSIGN', quality, { departmentId: ids.dept.toString(), severity: 3 });
    await Incident.updateOne({ _id: incident._id }, { status: 'CAPA_IN_PROGRESS' });
    const yesterday = new Date(Date.now() - 2 * 864e5);
    await Capa.create([
      { capaNumber: `OVER-${seq}`, incidentId: incident._id, type: 'CORRECTIVE', action: 'Late', ownerUserId: ids.hod, ownerDepartmentId: ids.dept, targetDate: yesterday, status: 'OPEN' },
      { capaNumber: `DONE-${seq}`, incidentId: incident._id, type: 'CORRECTIVE', action: 'Done late', ownerUserId: ids.hod, ownerDepartmentId: ids.dept, targetDate: yesterday, status: 'DONE' },
      { capaNumber: `FUTURE-${seq}`, incidentId: incident._id, type: 'CORRECTIVE', action: 'On time', ownerUserId: ids.hod, ownerDepartmentId: ids.dept, targetDate: new Date(Date.now() + 864e5), status: 'OPEN' },
    ]);
    await Notification.deleteMany({});

    expect(await notifyOverdueCapas()).toBe(1);
    expect(await received()).toEqual({ hod: ['CAPA_OVERDUE'], quality1: ['CAPA_OVERDUE'], quality2: ['CAPA_OVERDUE'] });
    expect((await Notification.findOne({ userId: ids.hod }))?.message).toContain(`OVER-${seq}`);

    await Notification.deleteMany({});
    expect(await notifyOverdueCapas()).toBe(0);
    expect(await received()).toEqual({});

    // A new target date that is also missed is reported again
    await Capa.updateOne({ capaNumber: `OVER-${seq}` }, { $unset: { overdueNotifiedAt: '' } });
    expect(await notifyOverdueCapas()).toBe(1);
  });
});
