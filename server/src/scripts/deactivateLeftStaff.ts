/**
 * Deactivates the accounts of people who are not in HR's current employee list.
 *
 * The first import (HR's list of 2 Nov 2026) included people who had already left; HR's list of
 * 19 Nov 2026 has only current employees. Every Active account whose Employee ID is not in the
 * current list is deactivated — except anyone who is using the system, who is left alone and
 * listed so a person can decide:
 *  - anyone with a role other than Staff (HOD, Quality, Admin, Super Admin, RCA Head, Intimation Member...);
 *  - a department's HOD;
 *  - anyone who has ever signed in;
 *  - anyone taking part in an open incident (reporter, HOD, RCA Head, intimated, RCA meeting attendee).
 *
 * Nothing is deleted: the account is set to Inactive, so it can no longer sign in, receives no
 * messages and is not offered in pickers, while past incidents still show the name. An
 * administrator can reactivate one person on the Users screen; --undo reactivates the whole batch.
 *
 * Usage (from server/, or in the backend container with node dist/scripts/deactivateLeftStaff.js):
 *   npx tsx src/scripts/deactivateLeftStaff.ts <hr.csv>            dry run: shows what would change
 *   npx tsx src/scripts/deactivateLeftStaff.ts <hr.csv> --apply    makes the changes
 *   npx tsx src/scripts/deactivateLeftStaff.ts --undo [--apply]    reactivates the last batch
 * The CSV needs a header row with an Employee ID column ("Employee Id", "Employee ID", "Emp Id"...).
 *
 * Take a database backup before --apply.
 */

import fs from 'node:fs';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { User } from '../modules/users/user.model.js';
import { Role } from '../modules/roles/role.model.js';
import { Department } from '../modules/departments/department.model.js';
import { Incident } from '../modules/incidents/incident.model.js';
import { RcaMeeting } from '../modules/rca/rcaMeeting.model.js';
import { AuditLog } from '../modules/audit/audit.model.js';
import { ROLE_CODES } from '../common/enums/permissions.js';

const BATCH_ACTION = 'HR_LEFT_STAFF_DEACTIVATED';
const UNDO_ACTION = 'HR_LEFT_STAFF_REACTIVATED';
/** A list shorter than this is almost certainly the wrong file. */
const MIN_NEW_LIST = 300;

/** Employee IDs in an HR CSV (first column whose header looks like an employee ID). */
export const readEmployeeIds = (path: string): Set<string> => {
  const lines = fs.readFileSync(path, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  // Employee IDs never contain commas or quotes, so a simple split is enough for this column
  const cells = (line: string) => line.split(',').map((c) => c.replace(/^"|"$/g, '').trim());
  const header = cells(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z]/g, ''));
  const col = header.findIndex((h) => ['employeeid', 'empid', 'employeeno', 'empno'].includes(h));
  if (col < 0) throw new Error(`${path}: no Employee ID column (found: ${lines[0]})`);
  return new Set(lines.slice(1).map((l) => cells(l)[col]).filter(Boolean));
};

const OPEN = { status: { $nin: ['CLOSED', 'REJECTED'] } };

/** Everyone taking part in an incident that is still open. */
const openIncidentPeople = async (): Promise<Set<string>> => {
  const incidents = await Incident.find(OPEN).select('reportedBy assignedHod rcaHeadId intimatedUserIds rcaAdditionalAttendeeIds').lean();
  const meetings = await RcaMeeting.find({ incidentId: { $in: incidents.map((i) => i._id) } }).select('attendeeIds').lean();
  const ids = new Set<string>();
  const add = (v: unknown) => v && ids.add(String(v));
  for (const i of incidents) {
    [i.reportedBy, i.assignedHod, i.rcaHeadId, ...(i.intimatedUserIds || []), ...(i.rcaAdditionalAttendeeIds || [])].forEach(add);
  }
  for (const m of meetings) (m.attendeeIds || []).forEach(add);
  return ids;
};

const header = (title: string, lines: string[]) => {
  const safeUri = env.MONGO_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
  console.log('==================================================================');
  console.log(`  ${title}`);
  for (const l of lines) console.log(`  ${l}`);
  console.log(`  Database: ${safeUri}`);
  console.log('==================================================================\n');
};

const undo = async (apply: boolean) => {
  const last = await AuditLog.findOne({ action: BATCH_ACTION }).sort({ timestamp: -1 });
  header('Reactivate the last batch of deactivated staff', [`Mode:     ${apply ? 'APPLY (changes are written)' : 'DRY RUN (nothing is changed)'}`]);
  if (!last) {
    console.log('No batch has been deactivated by this script.');
    return;
  }
  const ids: string[] = (last.meta as any)?.userIds || [];
  // Only those still Inactive: someone an administrator has since changed is left as they are
  const users = await User.find({ _id: { $in: ids }, status: 'INACTIVE' }).select('_id');
  console.log(`Batch of ${(last as any).timestamp?.toISOString?.() ?? ''}: ${ids.length} deactivated, ${users.length} still inactive and will be reactivated.`);
  if (!apply) {
    console.log('\nDRY RUN: nothing changed. Add --apply to reactivate them.');
    return;
  }
  const res = await User.updateMany({ _id: { $in: users.map((u) => u._id) }, status: 'INACTIVE' }, { $set: { status: 'ACTIVE' } });
  await AuditLog.create({
    action: UNDO_ACTION,
    category: 'users',
    summary: `Reactivated ${res.modifiedCount} staff accounts deactivated from the HR list`,
    meta: { userIds: users.map((u) => String(u._id)), batchId: String(last._id) },
    timestamp: new Date(),
  });
  console.log(`\nReactivated ${res.modifiedCount} accounts.`);
};

const main = async () => {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  await mongoose.connect(env.MONGO_URI);
  if (args.includes('--undo')) return undo(apply);

  const file = args.find((a) => !a.startsWith('--'));
  if (!file) throw new Error('Usage: deactivateLeftStaff <hr.csv> [--apply]   or   deactivateLeftStaff --undo [--apply]');
  const hrIds = readEmployeeIds(file);
  header("Deactivate accounts not in HR's current employee list", [
    `HR list:  ${file} (${hrIds.size} employees)`,
    `Mode:     ${apply ? 'APPLY (changes are written)' : 'DRY RUN (nothing is changed)'}`,
  ]);
  if (hrIds.size < MIN_NEW_LIST) throw new Error(`The HR list has only ${hrIds.size} employees: is it the right file? Stopping.`);

  const staffRole = await Role.findOne({ code: ROLE_CODES.STAFF }).select('_id');
  if (!staffRole) throw new Error('Staff role is missing');
  const roleCode = new Map((await Role.find().select('code name')).map((r) => [String(r._id), r.name || r.code]));
  const hodOf = new Map((await Department.find({ hodUserId: { $ne: null } }).select('hodUserId name')).map((d) => [String(d.hodUserId), d.name]));
  const busy = await openIncidentPeople();

  const users = await User.find({ status: 'ACTIVE', employeeId: { $nin: [...hrIds] } })
    .select('employeeId name roles status lastLoginAt designation')
    .sort({ employeeId: 1 });

  const deactivate: typeof users = [];
  const review: Array<{ u: (typeof users)[number]; why: string }> = [];
  for (const u of users) {
    const otherRoles = u.roles.map(String).filter((r) => r !== String(staffRole._id));
    const why = otherRoles.length
      ? `has the role ${otherRoles.map((r) => roleCode.get(r) || r).join(', ')}`
      : hodOf.has(String(u._id))
      ? `is HOD of ${hodOf.get(String(u._id))}`
      : u.lastLoginAt
      ? `has signed in (last ${u.lastLoginAt.toISOString().slice(0, 10)})`
      : busy.has(String(u._id))
      ? 'is part of an open incident'
      : '';
    if (why) review.push({ u, why });
    else deactivate.push(u);
  }

  const kept = await User.countDocuments({ status: 'ACTIVE', employeeId: { $in: [...hrIds] } });
  const notFound = [...hrIds].length - (await User.countDocuments({ employeeId: { $in: [...hrIds] } }));
  const kind = (id: string) => (/^\d{5}$/.test(id) ? '5-digit ID' : /^[A-Za-z]/.test(id) ? 'intern/student ID' : 'other ID');
  const byKind = new Map<string, number>();
  for (const u of deactivate) byKind.set(kind(u.employeeId), (byKind.get(kind(u.employeeId)) ?? 0) + 1);

  console.log(`Active accounts in the HR list (stay as they are): ${kept}${notFound ? `   (${notFound} HR employees have no account yet)` : ''}`);
  console.log(`Active accounts NOT in the HR list:                ${users.length}`);
  console.log(`  To deactivate:                 ${deactivate.length}   (${[...byKind].map(([k, n]) => `${n} ${k}`).join(', ') || '-'})`);
  console.log(`  Kept, in use (please check):   ${review.length}\n`);

  if (review.length) {
    console.log('Kept because they use the system, though not in the HR list (deactivate on the Users screen if they have left):');
    for (const { u, why } of review) console.log(`  ${u.employeeId.padEnd(10)} ${u.name.padEnd(32)} ${why}`);
    console.log('');
  }
  if (deactivate.length) {
    console.log(`To deactivate (first 25 of ${deactivate.length}):`);
    for (const u of deactivate.slice(0, 25)) console.log(`  ${u.employeeId.padEnd(10)} ${u.name.padEnd(32)} ${u.designation || ''}`);
    console.log('');
  }

  if (!apply) {
    console.log('DRY RUN: nothing changed. Add --apply to deactivate them.');
    return;
  }
  if (!deactivate.length) {
    console.log('Nothing to deactivate.');
    return;
  }
  // Re-checks Active and never signed in at write time, in case someone signed in meanwhile
  const ids = deactivate.map((u) => u._id);
  const res = await User.updateMany({ _id: { $in: ids }, status: 'ACTIVE', lastLoginAt: null }, { $set: { status: 'INACTIVE' } });
  const done = await User.find({ _id: { $in: ids }, status: 'INACTIVE' }).select('_id');
  await AuditLog.create({
    action: BATCH_ACTION,
    category: 'users',
    summary: `Deactivated ${res.modifiedCount} staff accounts no longer in HR's employee list`,
    meta: { file: file.split(/[\\/]/).pop(), userIds: done.map((u) => String(u._id)), keptInUse: review.length },
    timestamp: new Date(),
  });
  console.log(`Deactivated ${res.modifiedCount} accounts. To undo: deactivateLeftStaff --undo --apply`);
};

main()
  .then(() => mongoose.disconnect())
  .catch(async (error) => {
    console.error(`\n${error instanceof Error ? error.message : error}`);
    await mongoose.disconnect();
    process.exit(1);
  });
