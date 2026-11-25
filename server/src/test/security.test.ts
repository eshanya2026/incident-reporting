import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { inflateSync } from 'node:zlib';
import app from '../app.js';
import { syncSystemRoles } from '../seeders/systemRoles.js';
import { Role } from '../modules/roles/role.model.js';
import { User } from '../modules/users/user.model.js';
import { Department } from '../modules/departments/department.model.js';
import { Location } from '../modules/locations/location.model.js';
import { IncidentCategory } from '../modules/categories/category.model.js';
import { Incident } from '../modules/incidents/incident.model.js';
import { UserSession } from '../modules/audit/session.model.js';
import { WhatsappMessage } from '../modules/notifications/whatsappMessage.model.js';
import { hashPassword } from '../modules/auth/auth.utils.js';
import { ROLE_CODES } from '../common/enums/permissions.js';
import { AuditLog } from '../modules/audit/audit.model.js';
import { releaseOldWrongPasswordLocks } from '../migrations/releaseOldLocks.js';
import { createShortLink, attachLinkToMessage } from '../modules/links/shortLink.service.js';
import { LinkEvent } from '../modules/links/shortLink.model.js';
import { Notification } from '../modules/notifications/notification.model.js';
import { RcaMeeting } from '../modules/rca/rcaMeeting.model.js';
import { notifyWorkflowEvent } from '../modules/notifications/workflowNotifications.js';
import { env } from '../config/env.js';

// End-to-end checks of the promises the hospital relies on, through the real HTTP API with real
// roles and real sign-ins: reporter confidentiality, who may create Admins, HOD hand-over, ended
// sessions, and WhatsApp delivery statuses. Opt-in (drops its own database), like the other
// MongoDB tests:  TEST_MONGO_URI=mongodb://localhost:27018 npx vitest run src/test/security.test.ts

const withDbName = (uri: string, db: string) => {
  const url = new URL(uri);
  url.pathname = `/${db}`;
  return url.toString();
};
const MONGO_URI = process.env.TEST_MONGO_URI ? withDbName(process.env.TEST_MONGO_URI, 'security_test') : undefined;

const PASSWORD = 'Secure#Pass2026';
const WEBHOOK = `/api/v1/whatsapp/webhook/${process.env.WATI_WEBHOOK_SECRET}`;

// A reporter whose name, username and employee ID are unique strings, so any leak is caught
// wherever it appears in a response
const REPORTER = { name: 'Zebulon Quillfeather', username: 'zquillfeather', employeeId: 'ZQ-77441' };

describe.skipIf(!MONGO_URI)('Security and confidentiality (HTTP, MongoDB)', () => {
  const ids: Record<string, string> = {};
  const roleId: Record<string, string> = {};
  const tokens: Record<string, string> = {};
  let openIncidentId = '';
  let closedIncidentId = '';

  const signIn = async (username: string, password = PASSWORD) => {
    const res = await request(app).post('/api/v1/auth/login').send({ username, password });
    expect(res.status, `sign-in as ${username}: ${JSON.stringify(res.body)}`).toBe(200);
    return { token: res.body.data.accessToken as string, cookies: res.headers['set-cookie'] as unknown as string[] };
  };
  const api = (token: string) => ({
    get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string, body?: object) => request(app).post(url).set('Authorization', `Bearer ${token}`).send(body ?? {}),
    patch: (url: string, body?: object) => request(app).patch(url).set('Authorization', `Bearer ${token}`).send(body ?? {}),
  });

  let passwordHash: string | undefined; // hashed once: bcrypt is slow on purpose
  const makeUser = async (key: string, role: string, extra: Record<string, unknown> = {}) => {
    const u = await User.create({
      employeeId: `E-${key}`,
      name: `User ${key}`,
      username: key.toLowerCase(),
      email: `${key.toLowerCase()}@test.local`,
      passwordHash: passwordHash ??= await hashPassword(PASSWORD),
      roles: [roleId[role]],
      status: 'ACTIVE',
      mustCompleteProfile: false,
      designation: role === ROLE_CODES.HOD ? 'Head of Department' : 'Staff',
      ...extra,
    });
    ids[key] = String(u._id);
    return u;
  };

  beforeAll(async () => {
    await mongoose.connect(MONGO_URI!);
    await mongoose.connection.dropDatabase();
    await syncSystemRoles();
    for (const r of await Role.find().select('code')) roleId[r.code] = String(r._id);

    const [deptA, deptB, deptC] = await Department.create([
      { code: 'SECA', name: 'Ward A' },
      { code: 'SECB', name: 'Ward B' },
      { code: 'SECC', name: 'Ward C' },
    ]);
    ids.deptA = String(deptA._id);
    ids.deptB = String(deptB._id);
    ids.deptC = String(deptC._id);
    const [loc] = await Location.create([{ code: 'SECLOC', name: 'Corridor 1', type: 'WARD' }]);
    const [cat] = await IncidentCategory.create([{ code: 'SECCAT', name: 'Patient Fall' }]);
    ids.location = String(loc._id);
    ids.category = String(cat._id);

    await makeUser('reporter', ROLE_CODES.STAFF, { ...REPORTER, departmentId: deptB._id });
    ids.reporter = String((await User.findOne({ username: REPORTER.username }))!._id);
    await makeUser('quality', ROLE_CODES.QUALITY);
    await makeUser('admin', ROLE_CODES.ADMIN);
    await makeUser('admin2', ROLE_CODES.ADMIN);
    await makeUser('superadmin', ROLE_CODES.SUPER_ADMIN);
    await makeUser('hodA', ROLE_CODES.HOD, { departmentId: deptA._id });
    await makeUser('hodB', ROLE_CODES.HOD, { departmentId: deptB._id });
    await makeUser('nextHod', ROLE_CODES.STAFF, { departmentId: deptC._id });
    await makeUser('intimated', ROLE_CODES.INTIMATION_MEMBER);
    await makeUser('plainStaff', ROLE_CODES.STAFF, { departmentId: deptC._id });
    await Department.updateOne({ _id: deptA._id }, { hodUserId: ids.hodA });
    await Department.updateOne({ _id: deptB._id }, { hodUserId: ids.hodB });

    for (const key of ['quality', 'admin', 'superadmin', 'hodA', 'hodB', 'intimated', 'plainStaff']) {
      tokens[key] = (await signIn(key.toLowerCase())).token;
    }
    tokens.reporter = (await signIn(REPORTER.username)).token;

    // The reporter reports through the app; Quality asks a question; the reporter answers;
    // Quality assigns it to Ward A and copies in an intimation member
    const created = await api(tokens.reporter).post('/api/v1/incidents', {
      incidentDateTime: new Date().toISOString(),
      occurredInDepartmentId: ids.deptA,
      locationId: ids.location,
      categoryId: ids.category,
      affectedPersonType: 'EMPLOYEE',
      title: 'Wet floor fall near nurses station',
      description: 'Staff member slipped on a wet floor near the nurses station.',
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    openIncidentId = created.body.data._id;
    expect((await api(tokens.quality).post(`/api/v1/incidents/${openIncidentId}/request-info`, { question: 'Which corridor?' })).status).toBe(200);
    expect((await api(tokens.reporter).post(`/api/v1/incidents/${openIncidentId}/respond`, { response: 'Corridor 1, east side' })).status).toBe(200);
    const assigned = await api(tokens.quality).post(`/api/v1/incidents/${openIncidentId}/assign`, {
      departmentId: ids.deptA,
      severity: 2,
      intimatedUserIds: [ids.intimated],
    });
    expect(assigned.status, JSON.stringify(assigned.body)).toBe(200);

    // A closed incident from the same reporter, closed by Ward A's HOD, for the final report PDF
    const now = new Date();
    const closed = await Incident.create({
      incidentNumber: 'SEC-CLOSED-1',
      reportedBy: ids.reporter,
      reportedAt: new Date(now.getTime() - 10 * 86400000),
      incidentDateTime: new Date(now.getTime() - 10 * 86400000),
      reportingDepartmentId: ids.deptB,
      occurredInDepartmentId: ids.deptA,
      departmentId: ids.deptA,
      locationId: ids.location,
      categoryId: ids.category,
      affectedPersonType: 'EMPLOYEE',
      title: 'Earlier closed incident',
      description: 'Closed earlier for the report test.',
      severity: 2,
      initialSeverity: 2,
      status: 'CLOSED',
      assignedHod: ids.hodA,
      assignedAt: new Date(now.getTime() - 9 * 86400000),
      assignments: [{ departmentId: ids.deptA, hodUserId: ids.hodA, severity: 2, by: ids.quality, at: new Date(now.getTime() - 9 * 86400000) }],
      closedAt: new Date(now.getTime() - 2 * 86400000),
      closedBy: ids.quality,
    });
    closedIncidentId = String(closed._id);
  }, 60_000);

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  // ---------- Reporter confidentiality ----------

  /** Fails if anything identifying the reporter appears anywhere in the response. */
  const expectNoReporter = (body: unknown, where: string) => {
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    for (const needle of [REPORTER.name, REPORTER.username, REPORTER.employeeId, ids.reporter]) {
      expect(text.includes(needle), `${where} leaks "${needle}"`).toBe(false);
    }
  };
  /** Text drawn in a PDF: page streams are compressed and pdf-lib writes strings as hex. */
  const pdfText = (buf: Buffer): string => {
    const raw = buf.toString('latin1');
    const parts: string[] = [raw];
    const re = /stream\r?\n/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw))) {
      const start = m.index + m[0].length;
      const end = raw.indexOf('endstream', start);
      if (end < 0) break;
      try {
        parts.push(inflateSync(buf.subarray(start, end)).toString('latin1'));
      } catch {
        // not a compressed stream (fonts, images...)
      }
    }
    // Decode <hex> strings so names can be searched as plain text
    return parts.join('\n').replace(/<([0-9A-Fa-f]{2,})>/g, (_, hex: string) => Buffer.from(hex, 'hex').toString('latin1'));
  };
  const pdfContains = (buf: Buffer, s: string) => pdfText(buf).includes(s);

  const SCREENS = (id: string) => [
    '/api/v1/incidents',
    '/api/v1/incidents/my-department',
    '/api/v1/incidents/review-queue',
    `/api/v1/incidents/${id}`,
    `/api/v1/incidents/${id}/timeline`,
    '/api/v1/reports/incidents',
    '/api/v1/reports/incidents?format=csv',
    `/api/v1/reports/monthly?month=${new Date().toISOString().slice(0, 7)}`,
    '/api/v1/reports/trends',
    '/api/v1/dashboard/overview',
    '/api/v1/notifications',
  ];

  it('the HOD handling the incident never sees who reported it, on any screen or export', async () => {
    let checked = 0;
    for (const url of SCREENS(openIncidentId)) {
      const res = await api(tokens.hodA).get(url);
      if (res.status === 403 || res.status === 404) continue; // not available to an HOD at all
      expect(res.status, `${url}: ${JSON.stringify(res.body).slice(0, 200)}`).toBe(200);
      expectNoReporter(res.text, `HOD ${url}`);
      checked += 1;
    }
    expect(checked).toBeGreaterThanOrEqual(8);
    // The detail screen says it is confidential rather than just leaving it blank
    const detail = await api(tokens.hodA).get(`/api/v1/incidents/${openIncidentId}`);
    expect(detail.body.data.reporterHidden).toBe(true);
  });

  it('the final report PDF does not name the reporter for the HOD', async () => {
    const res = await api(tokens.hodA).get(`/api/v1/incidents/${closedIncidentId}/report`).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    const pdf = res.body as Buffer;
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdfContains(pdf, REPORTER.name)).toBe(false);
    expect(pdfContains(pdf, 'Earlier closed incident')).toBe(true); // the check can see text at all
  });

  it('an intimation member copied in does not see the reporter either', async () => {
    for (const url of [`/api/v1/incidents/${openIncidentId}`, `/api/v1/incidents/${openIncidentId}/timeline`, '/api/v1/incidents', '/api/v1/notifications']) {
      const res = await api(tokens.intimated).get(url);
      if (res.status === 403 || res.status === 404) continue;
      expect(res.status, url).toBe(200);
      expectNoReporter(res.text, `intimation member ${url}`);
    }
  });

  it('"Copied to me" lists the incidents a person was copied on, reporter hidden, and nothing for others', async () => {
    const res = await api(tokens.intimated).get('/api/v1/incidents/copied-to-me');
    expect(res.status).toBe(200);
    expect(res.body.data.map((i: any) => i._id)).toEqual([openIncidentId]);
    expect(res.body.data[0].copiedBy).toBe('User quality');
    expect(res.body.data[0].copiedAt).toBeTruthy();
    expect(res.body.meta).toMatchObject({ total: 1, open: 1 });
    expectNoReporter(res.text, 'copied-to-me');
    expect((await api(tokens.intimated).get('/api/v1/incidents/copied-to-me?status=closed')).body.data).toHaveLength(0);
    // Not copied: empty, whatever their role
    for (const who of ['hodA', 'plainStaff', 'quality']) {
      expect((await api(tokens[who]).get('/api/v1/incidents/copied-to-me')).body.data, who).toHaveLength(0);
    }
  });

  it('staff who are not involved cannot open the incident at all', async () => {
    const res = await api(tokens.plainStaff).get(`/api/v1/incidents/${openIncidentId}`);
    expect([403, 404]).toContain(res.status);
    expectNoReporter(res.text, 'unrelated staff');
  });

  it('Quality, Admin and the reporter themselves do see the reporter', async () => {
    for (const who of ['quality', 'admin', 'reporter']) {
      const res = await api(tokens[who]).get(`/api/v1/incidents/${openIncidentId}`);
      expect(res.status).toBe(200);
      expect(res.text.includes(REPORTER.name), `${who} should see the reporter`).toBe(true);
    }
  });

  it('an Admin can stand in for Quality: triage inbox, assign, and the step is recorded as theirs', async () => {
    const inc = await Incident.create({
      incidentNumber: 'SEC-ADMIN-1',
      reportedBy: ids.reporter,
      incidentDateTime: new Date(),
      occurredInDepartmentId: ids.deptB,
      locationId: ids.location,
      categoryId: ids.category,
      affectedPersonType: 'EMPLOYEE',
      title: 'Admin triage test',
      description: 'Assigned by an Admin while Quality is away.',
      status: 'SUBMITTED',
    });
    const inbox = await api(tokens.admin).get('/api/v1/incidents/triage-queue');
    expect(inbox.status).toBe(200);
    expect(inbox.body.data.map((i: any) => i._id)).toContain(String(inc._id));
    const res = await api(tokens.admin).post(`/api/v1/incidents/${inc._id}/assign`, { departmentId: ids.deptB, severity: 1 });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const after = await Incident.findById(inc._id);
    expect(after!.status).toBe('ASSIGNED');
    expect(String(after!.assignments[0].by)).toBe(ids.admin);
    // An HOD still can't
    const other = await Incident.create({ ...inc.toObject(), _id: undefined, incidentNumber: 'SEC-ADMIN-2', status: 'SUBMITTED', assignments: [] });
    expect((await api(tokens.hodA).post(`/api/v1/incidents/${other._id}/assign`, { departmentId: ids.deptB, severity: 1 })).status).toBe(403);
  });

  // ---------- Only a Super Admin manages Admins ----------

  const newUserBody = (key: string, role: string) => ({
    employeeId: `NEW-${key}`,
    name: `New ${key}`,
    email: `new-${key}@test.local`,
    username: `new${key}`,
    password: 'Another#Pass2026',
    roles: [roleId[role]],
  });

  it('an Admin cannot create an Admin or a Super Admin', async () => {
    for (const role of [ROLE_CODES.ADMIN, ROLE_CODES.SUPER_ADMIN]) {
      const res = await api(tokens.admin).post('/api/v1/users', newUserBody(`by-admin-${role}`, role));
      expect(res.status, `${role}: ${JSON.stringify(res.body)}`).toBe(403);
    }
    expect(await User.countDocuments({ username: /^newby-admin/ })).toBe(0);
  });

  it('an Admin cannot promote someone to Admin, nor edit another Admin', async () => {
    const promote = await api(tokens.admin).patch(`/api/v1/users/${ids.plainStaff}`, { roles: [roleId[ROLE_CODES.ADMIN]] });
    expect(promote.status).toBe(403);
    const editOther = await api(tokens.admin).patch(`/api/v1/users/${ids.admin2}`, { status: 'INACTIVE' });
    expect(editOther.status).toBe(403);
    expect((await User.findById(ids.admin2))!.status).toBe('ACTIVE');
    const resetOther = await api(tokens.admin).post(`/api/v1/users/${ids.admin2}/reset-password`, { password: 'Hijack#Pass2026' });
    expect([403, 404]).toContain(resetOther.status);
  });

  it('a Super Admin can create an Admin', async () => {
    const res = await api(tokens.superadmin).post('/api/v1/users', newUserBody('by-super', ROLE_CODES.ADMIN));
    expect(res.status, JSON.stringify(res.body)).toBe(201);
  });

  // ---------- HOD change ----------

  it('changing a department HOD hands over open incidents but keeps who handled past ones', async () => {
    const res = await api(tokens.admin).patch(`/api/v1/departments/${ids.deptA}`, { hodUserId: ids.nextHod });
    expect(res.status, JSON.stringify(res.body)).toBe(200);

    const open = await Incident.findById(openIncidentId);
    expect(String(open!.assignedHod)).toBe(ids.nextHod);
    const closed = await Incident.findById(closedIncidentId);
    expect(String(closed!.assignedHod)).toBe(ids.hodA);
    expect(String(closed!.assignments[0].hodUserId)).toBe(ids.hodA);

    const next = await User.findById(ids.nextHod).populate('roles', 'code');
    expect((next!.roles as any[]).map((r) => r.code)).toContain(ROLE_CODES.HOD);
    expect(String(next!.departmentId)).toBe(ids.deptA);

    // The new HOD sees the handed-over incident, still without the reporter
    const nextToken = (await signIn('nexthod')).token;
    const detail = await api(nextToken).get(`/api/v1/incidents/${openIncidentId}`);
    expect(detail.status).toBe(200);
    expectNoReporter(detail.text, 'new HOD detail');
  });

  // ---------- Sessions ----------

  it('a session ended by the Super Admin stops working at once, including refresh', async () => {
    const { token, cookies } = await signIn('hodb');
    expect((await api(token).get('/api/v1/auth/me')).status).toBe(200);
    const session = await UserSession.findOne({ userId: ids.hodB, endedAt: null }).sort({ startedAt: -1 });
    expect((await api(tokens.superadmin).post(`/api/v1/audit/sessions/${session!._id}/end`)).status).toBe(200);

    const after = await api(token).get('/api/v1/auth/me');
    expect(after.status).toBe(401);
    expect(after.body.error.message).toMatch(/ended by an administrator/i);
    const refresh = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookies);
    expect(refresh.status).toBe(401);
  });

  it('changing your password signs out your other sessions, not this one', async () => {
    const here = await signIn('plainstaff');
    const elsewhere = await signIn('plainstaff');
    const res = await api(here.token).post('/api/v1/auth/change-password', { currentPassword: PASSWORD, newPassword: 'Changed#Pass2026' });
    expect(res.status, JSON.stringify(res.body)).toBe(200);

    expect((await api(here.token).get('/api/v1/auth/me')).status).toBe(200);
    const other = await api(elsewhere.token).get('/api/v1/auth/me');
    expect(other.status).toBe(401);
    expect(other.body.error.message).toMatch(/password was changed/i);
    // The old password no longer works
    expect((await request(app).post('/api/v1/auth/login').send({ username: 'plainstaff', password: PASSWORD })).status).toBe(401);
  });

  it('only a Super Admin can see the audit log', async () => {
    for (const who of ['admin', 'quality', 'hodA']) {
      expect((await api(tokens[who]).get('/api/v1/audit/summary')).status, who).toBe(403);
    }
    expect((await api(tokens.superadmin).get('/api/v1/audit/summary')).status).toBe(200);
  });

  // ---------- WhatsApp delivery statuses ----------

  it('WhatsApp statuses only move forward, whatever order WATI reports them in', async () => {
    const msg = await WhatsappMessage.create({
      to: '919000000001',
      notificationKey: 'INCIDENT_ASSIGNED',
      status: 'SENT',
      providerIds: ['wati-msg-1'],
      history: [],
    });
    const event = (eventType: string, extra: object = {}) => request(app).post(WEBHOOK).send({ eventType, localMessageId: 'wati-msg-1', ...extra });

    expect((await event('sentMessageREAD_v2')).status).toBe(200);
    expect((await WhatsappMessage.findById(msg._id))!.status).toBe('READ');
    await event('sentMessageDELIVERED_v2'); // arrives late
    let after = (await WhatsappMessage.findById(msg._id))!;
    expect(after.status).toBe('READ');
    expect(after.deliveredAt).toBeTruthy(); // its time is still recorded
    await event('templateMessageSent_v2');
    after = (await WhatsappMessage.findById(msg._id))!;
    expect(after.status).toBe('READ');
  });

  it('a "read" for a message we did not send (shared WATI number) does not touch our messages', async () => {
    const msg = await WhatsappMessage.create({
      to: '9000000002', // saved without the country code, as an old test send did
      notificationKey: 'TEST',
      status: 'DELIVERED',
      providerIds: ['known-id'],
      history: [],
      createdAt: new Date(Date.now() - 2 * 3600000),
    });
    const res = await request(app).post(WEBHOOK).send({ eventType: 'sentMessageREAD_v2', statusString: 'Read', id: 'unknown-id', waId: '919000000002' });
    expect(res.status).toBe(200);
    const after = (await WhatsappMessage.findById(msg._id))!;
    expect(after.status).toBe('DELIVERED');
    expect(after.providerIds).not.toContain('unknown-id');
    // The webhook keeps a count per event type and the latest events, for diagnosis
    const state: any = await mongoose.connection.collection('app_state').findOne({ _id: 'wati_webhook' as any });
    expect(state.types.sentMessageREAD_v2.total).toBeGreaterThanOrEqual(1);
    expect(state.recent.at(-1)).toMatchObject({ eventType: 'sentMessageREAD_v2', id: 'unknown-id', matched: false });
  });

  it('the delivery list groups repeat sends into one row with the best outcome', async () => {
    const t = Date.now();
    const recipientUserId = new mongoose.Types.ObjectId();
    await WhatsappMessage.create([
      // the same HOD, same incident: failed first, then a resend that was delivered
      { to: '919000000077', recipientUserId, recipientName: 'Dr Grouptest', notificationKey: 'HOD_ASSIGNED', incidentNumber: 'INC-G-1', status: 'FAILED', failureReason: 'x', history: [], createdAt: new Date(t - 60000) },
      { to: '919000000077', recipientUserId, recipientName: 'Dr Grouptest', notificationKey: 'HOD_ASSIGNED', incidentNumber: 'INC-G-1', status: 'DELIVERED', history: [], createdAt: new Date(t - 30000) },
      // test sends to one number, stored with and without 91
      { to: '9000000088', notificationKey: 'TEST', incidentNumber: 'INC-G-2', status: 'SENT', history: [], createdAt: new Date(t - 50000) },
      { to: '919000000088', notificationKey: 'TEST', incidentNumber: 'INC-G-2', status: 'READ', history: [], createdAt: new Date(t - 40000) },
    ]);
    const res = await api(tokens.superadmin).get('/api/v1/whatsapp-delivery/messages?search=INC-G-');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    const hod = res.body.data.find((r: any) => r.incidentNumber === 'INC-G-1');
    expect(hod).toMatchObject({ status: 'DELIVERED', attemptCount: 2, canResend: false });
    expect(hod.attempts.map((a: any) => a.status)).toEqual(['DELIVERED', 'FAILED']); // newest first
    expect(res.body.data.find((r: any) => r.incidentNumber === 'INC-G-2')).toMatchObject({ status: 'READ', attemptCount: 2 });

    // Status filter applies to the row's best outcome: nothing here is "failed" overall
    expect((await api(tokens.superadmin).get('/api/v1/whatsapp-delivery/messages?search=INC-G-&status=FAILED')).body.data).toHaveLength(0);
    // Every attempt on its own
    expect((await api(tokens.superadmin).get('/api/v1/whatsapp-delivery/messages?search=INC-G-&view=all')).body.data).toHaveLength(4);
  });

  it('WhatsApp short links: tap, phone details, previews ignored, opened by the recipient', async () => {
    const msg = await WhatsappMessage.create({ to: '919000000099', recipientUserId: ids.hodA, notificationKey: 'HOD_ASSIGNED', status: 'DELIVERED', history: [] });
    const short = await createShortLink({ target: `/incidents/${openIncidentId}`, recipientUserId: ids.hodA, incidentId: openIncidentId });
    expect(short.code).toMatch(/^[A-Za-z0-9]{8}$/);
    expect(short.url).toBe(`http://localhost:5173/l/${short.code}`);
    await attachLinkToMessage(short.code, String(msg._id));

    const android = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
    const tap = await request(app).get(`/l/${short.code}`).set('User-Agent', android).set('Accept-Language', 'ta-IN,ta;q=0.9,en;q=0.8');
    expect(tap.status).toBe(302);
    expect(tap.headers.location).toBe(`http://localhost:5173/incidents/${openIncidentId}?via=${short.code}`);
    expect(tap.headers['critical-ch']).toMatch(/Sec-CH-UA-Model/);
    // Chrome repeats it once with the phone model: same tap, now with the model
    await request(app).get(`/l/${short.code}`).set('User-Agent', android).set('Sec-CH-UA-Model', '"SM-S918B"').set('Sec-CH-UA-Platform-Version', '"14.0.0"');
    // WhatsApp's own preview fetch is not a person
    await request(app).get(`/l/${short.code}`).set('User-Agent', 'WhatsApp/2.24.1 A');

    let after = (await WhatsappMessage.findById(msg._id))!;
    expect(after.linkTaps).toBe(1);
    expect(after.linkLastDevice).toBe('Android 14 · Chrome 131 · SM-S918B');
    const taps = await LinkEvent.find({ code: short.code }).sort({ at: 1 });
    expect(taps.map((e) => e.kind)).toEqual(['TAP', 'PREVIEW']);
    expect(taps[0].language).toBe('ta-IN');

    // The HOD's app reports the incident opened from the link
    const opened = await api(tokens.hodA).post(`/api/v1/links/${short.code}/opened`, { screen: { width: 412, height: 915, pixelRatio: 2.63 }, timezone: 'Asia/Kolkata' });
    expect(opened.body.data.recorded).toBe(true);
    after = (await WhatsappMessage.findById(msg._id))!;
    expect(after.linkOpenedAt).toBeTruthy();
    expect(after.linkOpenedByRecipient).toBe(true);

    // The dashboard lists it all
    const events = await api(tokens.superadmin).get(`/api/v1/whatsapp-delivery/messages/${msg._id}/link-events`);
    expect(events.body.data.map((e: any) => e.kind)).toEqual(['OPENED', 'PREVIEW', 'TAP']);
    expect(events.body.data[0].user.name).toBe('User hodA');
    // Only the Super Admin can see link activity
    expect((await api(tokens.hodA).get(`/api/v1/whatsapp-delivery/messages/${msg._id}/link-events`)).status).toBe(403);
  });

  it('an unknown short link goes to the app home page', async () => {
    const res = await request(app).get('/l/NotAReal1');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('http://localhost:5173/');
  });

  it('the WhatsApp webhook ignores calls without the secret', async () => {
    const res = await request(app).post('/api/v1/whatsapp/webhook/wrong-secret-value').send({ eventType: 'sentMessageREAD_v2', localMessageId: 'x' });
    expect(res.status).toBe(404);
  });

  // ---------- Wrong-password lock: 15 minutes, then it lifts by itself ----------

  it('locks for 15 minutes after 5 wrong passwords, refusing even the right one meanwhile', async () => {
    await makeUser('lockme', ROLE_CODES.STAFF, { departmentId: ids.deptC });
    const tryLogin = (password: string) => request(app).post('/api/v1/auth/login').send({ username: 'lockme', password });

    for (let i = 1; i <= 4; i++) expect((await tryLogin('wrong-password')).status).toBe(401);
    const fifth = await tryLogin('wrong-password');
    expect(fifth.status).toBe(429);
    expect(fifth.body.error.message).toMatch(/locked for 15 minutes/i);
    const user = await User.findOne({ username: 'lockme' });
    expect(user!.status).toBe('ACTIVE'); // not permanently locked
    const minutes = (user!.lockUntil!.getTime() - Date.now()) / 60000;
    expect(minutes).toBeGreaterThan(14);
    expect(minutes).toBeLessThanOrEqual(15);

    const during = await tryLogin(PASSWORD);
    expect(during.status).toBe(429);
    expect(during.body.error.code).toBe('ACCOUNT_TEMPORARILY_LOCKED');
    expect(during.body.error.message).toMatch(/try again after/i);
    expect(await AuditLog.countDocuments({ action: 'ACCOUNT_LOCKED', userId: user!._id })).toBe(1);

    // 15 minutes later (simulated): the right password works again
    await User.updateOne({ _id: user!._id }, { lockUntil: new Date(Date.now() - 1000) });
    expect((await tryLogin(PASSWORD)).status).toBe(200);
    const after = await User.findById(user!._id);
    expect(after!.lockUntil).toBeFalsy();
    expect(after!.failedLoginAttempts).toBe(0);
  });

  it('warns on the last two tries before the lock', async () => {
    await makeUser('warnme', ROLE_CODES.STAFF, { departmentId: ids.deptC });
    const tryLogin = () => request(app).post('/api/v1/auth/login').send({ username: 'warnme', password: 'wrong-password' });
    for (let i = 1; i <= 2; i++) expect((await tryLogin()).body.error.message).toBe('Invalid username or password');
    expect((await tryLogin()).body.error.message).toMatch(/2 more wrong tries/);
    expect((await tryLogin()).body.error.message).toMatch(/1 more wrong try/);
  });

  it('an administrator can unlock sooner', async () => {
    const u = await makeUser('unlockme', ROLE_CODES.STAFF, { departmentId: ids.deptC, lockUntil: new Date(Date.now() + 10 * 60000) });
    expect((await request(app).post('/api/v1/auth/login').send({ username: 'unlockme', password: PASSWORD })).status).toBe(429);
    expect((await api(tokens.admin).patch(`/api/v1/users/${u._id}`, { status: 'ACTIVE' })).status).toBe(200);
    expect((await request(app).post('/api/v1/auth/login').send({ username: 'unlockme', password: PASSWORD })).status).toBe(200);
  });

  it('releases old wrong-password locks, but not accounts an administrator locked', async () => {
    const auto = await makeUser('oldautolock', ROLE_CODES.STAFF, { departmentId: ids.deptC, status: 'LOCKED' });
    const byAdmin = await makeUser('adminlocked', ROLE_CODES.STAFF, { departmentId: ids.deptC, status: 'LOCKED' });
    const t = Date.now();
    await AuditLog.create([
      { action: 'ACCOUNT_LOCKED', userId: auto._id, timestamp: new Date(t - 3600000) },
      { action: 'ACCOUNT_LOCKED', userId: byAdmin._id, timestamp: new Date(t - 7200000) },
      { action: 'USER_DEACTIVATED', entityId: byAdmin._id, newValue: { status: 'LOCKED' }, timestamp: new Date(t - 3600000) },
    ]);
    await releaseOldWrongPasswordLocks();
    expect((await User.findById(auto._id))!.status).toBe('ACTIVE');
    expect((await User.findById(byAdmin._id))!.status).toBe('LOCKED');
  });

  it('closing an incident tells everyone involved, in the app and on WhatsApp, once each', async () => {
    // Everyone involved has a WhatsApp number; WATI is faked
    const people = ['reporter', 'quality', 'hodA', 'hodB', 'intimated', 'nextHod', 'admin2'];
    for (const [n, key] of people.entries()) await User.updateOne({ _id: ids[key] }, { whatsappNumber: `98765000${String(n).padStart(2, '0')}` });
    const saved = { ...env };
    Object.assign(env, { WHATSAPP_NOTIFICATIONS: true, WATI_API_ENDPOINT: 'http://wati.test', WATI_ACCESS_TOKEN: 'x', WATI_TEMPLATE_NAME: 'incident_alert' });
    let sent = 0;
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ result: true, local_message_id: `close-${++sent}` }))));

    // Ward B involved, an RCA Head, and an RCA meeting attended by Admin 2, the RCA Head and Quality
    const incident = (await Incident.findById(openIncidentId))!;
    incident.notifiedDepartmentIds = [new mongoose.Types.ObjectId(ids.deptB)];
    incident.rcaHeadId = new mongoose.Types.ObjectId(ids.nextHod);
    await RcaMeeting.create({
      incidentId: incident._id,
      scheduledBy: ids.nextHod,
      meetingAt: new Date(),
      location: 'Quality room',
      attendeeIds: [ids.admin2, ids.nextHod, ids.quality, ids.hodA],
    });

    try {
      await notifyWorkflowEvent('REVIEW_ACCEPT', incident, { userId: ids.quality } as any, 'Floor signage added.');

      const msgs = await WhatsappMessage.find({ notificationKey: 'INCIDENT_CLOSED', incidentId: incident._id });
      const to = msgs.map((m) => String(m.recipientUserId)).sort();
      expect(to).toEqual(['reporter', 'hodA', 'hodB', 'intimated', 'nextHod', 'admin2'].map((k) => ids[k]).sort());
      for (const m of msgs) {
        expect(m.preview).toContain('Floor signage added.');
        if (String(m.recipientUserId) !== ids.reporter) expectNoReporter(m.preview, 'closing WhatsApp');
      }

      const inApp = await Notification.find({ entityId: incident._id, type: { $in: ['INCIDENT_CLOSED', 'INCIDENT_REVIEW_ACCEPT'] } });
      expect(inApp.map((n) => String(n.userId)).sort()).toEqual(['reporter', 'hodA', 'hodB', 'intimated', 'nextHod', 'admin2'].map((k) => ids[k]).sort());
    } finally {
      vi.unstubAllGlobals();
      Object.assign(env, saved);
      await RcaMeeting.deleteMany({ incidentId: incident._id });
      await WhatsappMessage.deleteMany({ notificationKey: 'INCIDENT_CLOSED' });
      await User.updateMany({ _id: { $in: people.map((k) => ids[k]) } }, { $unset: { whatsappNumber: 1 } });
    }
  });
});
