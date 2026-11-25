/**
 * Permanently deletes Inactive accounts that were never used and are not part of any record.
 *
 * An account is deleted only when ALL of these hold:
 *  - its status is Inactive;
 *  - it has never signed in;
 *  - its id appears in no record anywhere: incidents (reporter, HOD, intimated, RCA, reviews,
 *    info requests...), RCA meetings, CAPAs, investigations, attachments, departments, AI chats...
 *    Every collection is searched, so a field added later is covered too. Only log-type
 *    collections (audit log, notifications, sessions, WhatsApp messages, short links) do not count:
 *    they keep the person's name as text, so history still reads correctly.
 * Accounts that fail a check are kept and counted. Their own in-app notifications are deleted with
 * them.
 *
 * Before anything is deleted, the accounts are saved to two files in --out (default /tmp):
 *   deleted-inactive-users-<date>.csv   to read (Employee ID, name, department, designation, phone...)
 *   deleted-inactive-users-<date>.json  the full accounts, to put them back if ever needed:
 *     mongoimport --db incident_db --collection users --jsonArray --file deleted-inactive-users-<date>.json
 * If the files cannot be written, nothing is deleted.
 *
 * Usage (from server/, or in the backend container with node dist/scripts/deleteInactiveUsers.js):
 *   npx tsx src/scripts/deleteInactiveUsers.ts                      dry run: shows what would be deleted
 *   npx tsx src/scripts/deleteInactiveUsers.ts --apply [--out=DIR]  saves the files, then deletes
 */

import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { User } from '../modules/users/user.model.js';
import { AuditLog } from '../modules/audit/audit.model.js';
import { Department } from '../modules/departments/department.model.js';
import { buildCsv, istText } from '../common/helpers/csv.js';

/** Collections that only log activity: a mention there does not keep an account. */
const LOG_COLLECTIONS = new Set([
  'users',
  'auditlogs',
  'notifications',
  'usersessions',
  'whatsappmessages',
  'shortlinks',
  'linkevents',
  'migrations',
  'app_state',
  'seed_meta',
  'counters',
]);

const isObjectId = (v: any): boolean => v instanceof mongoose.Types.ObjectId || v?._bsontype === 'ObjectId';

/** Adds to `found` every candidate id appearing anywhere inside a document. */
const collectIds = (value: any, candidates: Set<string>, found: Set<string>): void => {
  if (value == null) return;
  if (isObjectId(value)) {
    const id = String(value);
    if (candidates.has(id)) found.add(id);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectIds(v, candidates, found);
    return;
  }
  if (typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    for (const v of Object.values(value)) collectIds(v, candidates, found);
  }
};

const main = async () => {
  const apply = process.argv.includes('--apply');
  await mongoose.connect(env.MONGO_URI);
  const db = mongoose.connection.db!;
  const safeUri = env.MONGO_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
  console.log('==================================================================');
  console.log('  Delete unused Inactive accounts');
  console.log(`  Database: ${safeUri}`);
  console.log(`  Mode:     ${apply ? 'APPLY (accounts are deleted)' : 'DRY RUN (nothing is changed)'}`);
  console.log('==================================================================\n');

  const inactive = await User.find({ status: 'INACTIVE' }).select('employeeId name lastLoginAt').lean();
  const signedIn = inactive.filter((u) => u.lastLoginAt);
  const candidates = new Set(inactive.filter((u) => !u.lastLoginAt).map((u) => String(u._id)));

  // Search every record collection for the candidates' ids
  const referenced = new Set<string>();
  const referencedIn = new Map<string, number>();
  for (const { name } of await db.listCollections({}, { nameOnly: true }).toArray()) {
    if (LOG_COLLECTIONS.has(name) || name.startsWith('system.')) continue;
    const before = referenced.size;
    for await (const doc of db.collection(name).find({})) collectIds(doc, candidates, referenced);
    if (referenced.size > before) referencedIn.set(name, referenced.size - before);
  }

  const toDelete = inactive.filter((u) => candidates.has(String(u._id)) && !referenced.has(String(u._id)));
  console.log(`Inactive accounts:                       ${inactive.length}`);
  console.log(`  To delete (never used, in no record):  ${toDelete.length}`);
  console.log(`  Kept, have signed in before:           ${signedIn.length}`);
  console.log(
    `  Kept, part of a record:                ${referenced.size}${
      referencedIn.size ? `   (first found in: ${[...referencedIn].map(([c, n]) => `${c} ${n}`).join(', ')})` : ''
    }`
  );
  console.log('');
  if (toDelete.length) {
    console.log(`To delete (first 15 of ${toDelete.length}):`);
    for (const u of toDelete.slice(0, 15)) console.log(`  ${String(u.employeeId).padEnd(10)} ${u.name}`);
    console.log('');
  }

  if (!apply) {
    console.log('DRY RUN: nothing changed. Add --apply to save them to a file and delete them.');
    return;
  }
  if (!toDelete.length) {
    console.log('Nothing to delete.');
    return;
  }

  // Save the accounts first; if this fails, nothing is deleted
  const ids = toDelete.map((u) => u._id);
  const outDir = process.argv.find((a) => a.startsWith('--out='))?.slice(6) || '/tmp';
  const stamp = new Date().toISOString().slice(0, 10);
  const full = await db.collection('users').find({ _id: { $in: ids } }).toArray();
  const deptName = new Map((await Department.find().select('name').lean()).map((d) => [String(d._id), d.name]));
  fs.mkdirSync(outDir, { recursive: true });
  const csvFile = path.join(outDir, `deleted-inactive-users-${stamp}.csv`);
  const jsonFile = path.join(outDir, `deleted-inactive-users-${stamp}.json`);
  fs.writeFileSync(
    csvFile,
    '﻿' + // so Excel reads it as UTF-8
      buildCsv(
        ['Employee ID', 'Name', 'Username', 'Department', 'Designation', 'Phone', 'WhatsApp', 'Email', 'Account created'],
        full.map((u: any) => [
          u.employeeId,
          u.name,
          u.username,
          deptName.get(String(u.departmentId)) || '',
          u.designation || '',
          u.phone || '',
          u.whatsappNumber || '',
          u.email || '',
          istText(u.createdAt),
        ])
      )
  );
  fs.writeFileSync(jsonFile, mongoose.mongo.BSON.EJSON.stringify(full, undefined, 1, { relaxed: false }));
  if (JSON.parse(fs.readFileSync(jsonFile, 'utf8')).length !== full.length) throw new Error('The saved file is incomplete: nothing deleted.');
  console.log(`Saved ${full.length} accounts to:\n  ${csvFile}\n  ${jsonFile}\n`);

  // Re-checks Inactive and never signed in at delete time
  const res = await User.deleteMany({ _id: { $in: ids }, status: 'INACTIVE', lastLoginAt: null });
  const notes = await db.collection('notifications').deleteMany({ userId: { $in: ids } });
  await AuditLog.create({
    action: 'INACTIVE_USERS_DELETED',
    category: 'users',
    summary: `Deleted ${res.deletedCount} unused Inactive accounts`,
    meta: { file: path.basename(jsonFile), employeeIds: toDelete.map((u) => u.employeeId), keptSignedIn: signedIn.length, keptInRecords: referenced.size },
    timestamp: new Date(),
  });
  console.log(`Deleted ${res.deletedCount} accounts (and ${notes.deletedCount} of their notifications).`);
};

main()
  .then(() => mongoose.disconnect())
  .catch(async (error) => {
    console.error(`\n${error instanceof Error ? error.message : error}`);
    await mongoose.disconnect();
    process.exit(1);
  });
