/**
 * Go-live cleanup: removes every piece of demo / test data so the system starts empty.
 *
 * Removes
 *   - All operational records: incidents, investigations, RCAs, RCA meetings, CAPAs, attachments
 *     (and their uploaded files), notifications, audit logs, AI insights and chat logs, incident
 *     sequence counters (live incidents start again at INC-YYYY-000001), demo-seed bookkeeping.
 *   - The demo user accounts created by the seeder (EMP-001 ... EMP-025, EMP-TEST1).
 *     The Super Admin account (EMP-000, username "superadmin") is kept.
 *   - The demo departments (category "Demo & Core Operations") and their demo rooms, provided no
 *     real user still belongs to them.
 *
 * Keeps
 *   - Imported staff accounts, real departments, the ward master list, floor/zone locations
 *     (used by the report form's floor/zone picker), incident categories, roles, WhatsApp templates.
 *
 * Usage (from server/):
 *   npm run remove:dummy -- --dry-run     show what would be removed
 *   npm run remove:dummy                  remove, after typing "y" to confirm
 *   npm run remove:dummy -- --force       remove without the prompt
 *
 * Take a backup first (mongodump). This cannot be undone.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Incident } from '../modules/incidents/incident.model.js';
import { Investigation } from '../modules/investigations/investigation.model.js';
import { RootCauseAnalysis } from '../modules/rca/rca.model.js';
import { RcaMeeting } from '../modules/rca/rcaMeeting.model.js';
import { Capa } from '../modules/capa/capa.model.js';
import { Attachment } from '../modules/attachments/attachment.model.js';
import { Notification } from '../modules/notifications/notification.model.js';
import { AuditLog } from '../modules/audit/audit.model.js';
import { Counter } from '../common/models/counter.model.js';
import { Department } from '../modules/departments/department.model.js';
import { Location } from '../modules/locations/location.model.js';
import { User } from '../modules/users/user.model.js';

/** Employee IDs of the accounts the seeder creates for demos (EMP-000 = Super Admin, kept). */
const DEMO_EMPLOYEE_IDS = [
  ...Array.from({ length: 25 }, (_, i) => `EMP-${String(i + 1).padStart(3, '0')}`),
  'EMP-TEST1',
];
const DEMO_DEPARTMENT_CATEGORY = 'Demo & Core Operations';

/** Collections without a model imported here (importing their modules would pull in AI clients). */
const RAW_COLLECTIONS = ['aichatlogs', 'aiinsights', 'seed_meta'];

const confirm = (question: string): Promise<boolean> => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(['y', 'yes'].includes(answer.trim().toLowerCase()));
    });
  });
};

const rawCount = async (name: string): Promise<number> => {
  const exists = await mongoose.connection.db!.listCollections({ name }).hasNext();
  return exists ? mongoose.connection.collection(name).countDocuments() : 0;
};

export const removeDummyData = async ({ dryRun = false, force = false } = {}): Promise<void> => {
  if (mongoose.connection.readyState === 0) await mongoose.connect(env.MONGO_URI);
  const safeUri = env.MONGO_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');

  const demoUsers = await User.find({ employeeId: { $in: DEMO_EMPLOYEE_IDS } }).select('_id employeeId username');
  const demoUserIds = demoUsers.map((u) => u._id);

  // Demo departments go only if no remaining (real) user belongs to them
  const demoDepts = await Department.find({ category: DEMO_DEPARTMENT_CATEGORY }).select('_id code');
  const removableDeptIds: mongoose.Types.ObjectId[] = [];
  const keptDeptCodes: string[] = [];
  for (const d of demoDepts) {
    const realMembers = await User.countDocuments({ departmentId: d._id, _id: { $nin: demoUserIds } });
    if (realMembers === 0) removableDeptIds.push(d._id as mongoose.Types.ObjectId);
    else keptDeptCodes.push(d.code);
  }

  const attachments = await Attachment.find().select('storedName');
  const plan = {
    incidents: await Incident.countDocuments(),
    investigations: await Investigation.countDocuments(),
    rcas: await RootCauseAnalysis.countDocuments(),
    rcaMeetings: await RcaMeeting.countDocuments(),
    capas: await Capa.countDocuments(),
    attachments: attachments.length,
    notifications: await Notification.countDocuments(),
    auditLogs: await AuditLog.countDocuments(),
    counters: await Counter.countDocuments(),
    ...Object.fromEntries(await Promise.all(RAW_COLLECTIONS.map(async (c) => [c, await rawCount(c)]))),
    demoUsers: demoUsers.length,
    demoDepartments: removableDeptIds.length,
    demoRooms: await Location.countDocuments({ departmentId: { $in: removableDeptIds } }),
    departmentsLosingDemoHod: await Department.countDocuments({
      hodUserId: { $in: demoUserIds },
      _id: { $nin: removableDeptIds },
    }),
  };

  console.log('==================================================================');
  console.log('  Statlog - remove demo / dummy data');
  console.log(`  Database: ${safeUri}`);
  console.log(`  Mode:     ${dryRun ? 'DRY RUN (nothing is changed)' : 'REMOVE (permanent)'}`);
  console.log('==================================================================');
  console.table(plan);
  console.log(`Demo accounts: ${demoUsers.map((u) => u.username).join(', ') || '(none)'}`);
  if (keptDeptCodes.length) console.log(`Kept demo departments (real users still in them): ${keptDeptCodes.join(', ')}`);
  console.log(`Kept: ${await User.countDocuments({ _id: { $nin: demoUserIds } })} user accounts (incl. superadmin).`);

  if (dryRun) return;
  if (!force && !(await confirm('\nType "y" to permanently remove the above: '))) {
    console.log('Cancelled.');
    return;
  }

  // Uploaded files first, so a failure here leaves the records pointing at what still exists
  const uploadDir = path.resolve(process.cwd(), env.FILE_STORAGE_PATH);
  let filesRemoved = 0;
  for (const a of attachments) {
    try {
      await fs.unlink(path.join(uploadDir, path.basename(a.storedName)));
      filesRemoved += 1;
    } catch {
      /* already gone */
    }
  }

  await Promise.all([
    Incident.deleteMany({}),
    Investigation.deleteMany({}),
    RootCauseAnalysis.deleteMany({}),
    RcaMeeting.deleteMany({}),
    Capa.deleteMany({}),
    Attachment.deleteMany({}),
    Notification.deleteMany({}),
    AuditLog.deleteMany({}),
    Counter.deleteMany({}),
    ...RAW_COLLECTIONS.map((c) => mongoose.connection.collection(c).deleteMany({})),
  ]);

  await Location.deleteMany({ departmentId: { $in: removableDeptIds } });
  await Department.deleteMany({ _id: { $in: removableDeptIds } });
  await Department.updateMany({ hodUserId: { $in: demoUserIds } }, { $unset: { hodUserId: 1 } });
  await User.deleteMany({ _id: { $in: demoUserIds } });

  console.log(`\nDone. Removed ${filesRemoved} uploaded file(s) and all records listed above.`);
};

if (process.argv[1]?.includes('removeDummyData')) {
  const args = process.argv.slice(2);
  removeDummyData({ dryRun: args.includes('--dry-run'), force: args.includes('--force') || args.includes('-y') })
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch(async (err) => {
      console.error('Failed:', err);
      await mongoose.disconnect();
      process.exit(1);
    });
}
