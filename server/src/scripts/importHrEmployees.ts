/**
 * Updates staff accounts from HR's employee list (Employee Id, Name, Department, Designation, Phone).
 *
 * Rules (agreed with the hospital, 2026-11-20):
 *  - Matched by Employee ID. Staff who are not in the HR list are left exactly as they are.
 *  - Staff who have already confirmed their own details (first sign-in done, or set up by an
 *    admin) are NOT touched at all: what they entered stays exactly as it is.
 *  - Staff still waiting for their first sign-in: name, department and designation come from HR;
 *    the WhatsApp number is filled from HR when empty. They still confirm everything at first
 *    sign-in. Roles (HOD, Quality, Admin...), status and passwords are never changed. A current HOD
 *    keeps their department, so their HOD link is not broken (reported, to move by hand if needed).
 *  - New staff: account with username = Employee ID, password mapims@123, Staff role, details from
 *    HR; they confirm their details and set their own password at first sign-in.
 *  - HR department names are matched to system departments by name, then DEPARTMENT_ALIASES;
 *    names in NEW_DEPARTMENTS are created.
 *
 * Usage (from server/, or in the backend container with node dist/scripts/importHrEmployees.js):
 *   npx tsx src/scripts/importHrEmployees.ts <file.csv>            dry run: shows what would change
 *   npx tsx src/scripts/importHrEmployees.ts <file.csv> --apply    makes the changes
 * CSV columns (header row required): Employee Id, Name, Department, Designation, Phone [, Category]
 *
 * Take a database backup before --apply.
 */

import fs from 'node:fs';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { User } from '../modules/users/user.model.js';
import { Role } from '../modules/roles/role.model.js';
import { Department } from '../modules/departments/department.model.js';
import { AuditLog } from '../modules/audit/audit.model.js';
import { hashPassword } from '../modules/auth/auth.utils.js';
import { COMMON_STAFF_PASSWORD } from '../modules/auth/auth.controller.js';
import { ROLE_CODES } from '../common/enums/permissions.js';

/** HR department name (lower case) -> system department name. */
const DEPARTMENT_ALIASES: Record<string, string> = {
  'cardiothoracic surgery': 'Cardiothoracic and Vascular Surgery',
  'central laboratory': 'Laboratory Medicine',
  emergency: 'Emergency Medicine',
  icu: 'Critical Care / Intensive Medicine',
  'nephrology (dialysis)': 'Nephrology',
  otorhinolaryngology: 'ENT / Otorhinolaryngology',
  'plastic surgery': 'Plastic and Reconstructive Surgery',
  'special ward': 'Private Wards / Private Rooms',
  'transfusion medicine & bloodbank': 'Transfusion Medicine and Blood Bank',
  'tuberculosis and chest': 'Tuberculosis and Chest Medicine',
  'uthiramerur center': 'Uthiramerur Centre',
  accounts: 'Accounts and Finance',
  'bio medical': 'Biomedical Engineering',
  'blood bank': 'Transfusion Medicine and Blood Bank',
  dietetics: 'Nutrition and Dietetics',
  'facility management & safety': 'Facility Management',
  'house keeping': 'Housekeeping',
  'information technology': 'Information Technology Department',
  'medical record department': 'Medical Records Department',
  nursing: 'Nursing Services',
  operation: 'Operations',
  'purchase & store': 'Purchase Department',
  quality: 'Quality Department',
  safety: 'Fire and Safety',
  transport: 'Transportation',
};

/** HR departments with no system equivalent: created on --apply. */
const NEW_DEPARTMENTS: Record<string, { name: string; code: string; category: string }> = {
  'gummidipoondi centre': { name: 'Gummidipoondi Centre', code: 'OS_GUMMIDIPOONDI_CENTRE', category: 'Outreach and Satellite Services' },
};

interface HrRow {
  line: number;
  employeeId: string;
  name: string;
  department: string;
  designation: string;
  phone?: string;
}

/** Small CSV parser (quoted fields, commas and quotes inside quotes). */
const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim()));
};

const clean = (s?: string) => (s ?? '').replace(/\s+/g, ' ').trim();

/** Digits with India's 91 added to a 10-digit mobile; undefined if not a plausible number. */
const toWhatsapp = (raw?: string): string | undefined => {
  const digits = (raw ?? '').replace(/\D/g, '').replace(/^0+/, '');
  if (!digits) return undefined;
  const full = digits.length === 10 ? `91${digits}` : digits;
  return full.length >= 11 && full.length <= 15 ? full : undefined;
};

const readHr = (path: string): HrRow[] => {
  const rows = parseCsv(fs.readFileSync(path, 'utf8').replace(/^﻿/, ''));
  const header = rows[0].map((h) => h.toLowerCase().replace(/[^a-z]/g, ''));
  const col = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const idx = {
    id: col('employeeid', 'empid', 'employeeno'),
    name: col('name', 'employeename'),
    dept: col('department', 'dept'),
    desig: col('designation'),
    phone: col('phoneno', 'phone', 'mobile', 'mobileno', 'whatsapp'),
  };
  if (idx.id < 0 || idx.name < 0 || idx.dept < 0) {
    throw new Error(`CSV needs Employee Id, Name and Department columns (found: ${rows[0].join(', ')})`);
  }
  return rows.slice(1).map((r, i) => ({
    line: i + 2,
    employeeId: clean(r[idx.id]),
    name: clean(r[idx.name]),
    department: clean(r[idx.dept]),
    designation: idx.desig >= 0 ? clean(r[idx.desig]) : '',
    phone: idx.phone >= 0 ? toWhatsapp(r[idx.phone]) : undefined,
  }));
};

const main = async () => {
  const file = process.argv.slice(2).find((a) => !a.startsWith('--'));
  const apply = process.argv.includes('--apply');
  if (!file) throw new Error('Usage: importHrEmployees <file.csv> [--apply]');
  const hr = readHr(file).filter((r) => r.employeeId);

  await mongoose.connect(env.MONGO_URI);
  const safeUri = env.MONGO_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
  console.log('==================================================================');
  console.log('  HR employee update');
  console.log(`  File:     ${file} (${hr.length} employees)`);
  console.log(`  Database: ${safeUri}`);
  console.log(`  Mode:     ${apply ? 'APPLY (changes are written)' : 'DRY RUN (nothing is changed)'}`);
  console.log('==================================================================\n');

  const problems: string[] = [];
  const seen = new Set<string>();
  for (const r of hr) {
    if (seen.has(r.employeeId)) problems.push(`Line ${r.line}: Employee ID ${r.employeeId} appears more than once`);
    seen.add(r.employeeId);
  }

  // ---- Departments ----
  const depts = await Department.find().select('name');
  const byName = new Map(depts.map((d) => [d.name.toLowerCase().trim(), d]));
  const resolved = new Map<string, mongoose.Types.ObjectId | 'NEW'>();
  const toCreate = new Map<string, (typeof NEW_DEPARTMENTS)[string]>();
  for (const name of new Set(hr.map((r) => r.department))) {
    const key = name.toLowerCase();
    const target = byName.get(key) ?? (DEPARTMENT_ALIASES[key] ? byName.get(DEPARTMENT_ALIASES[key].toLowerCase()) : undefined);
    if (target) resolved.set(key, target._id as mongoose.Types.ObjectId);
    else if (NEW_DEPARTMENTS[key]) {
      const existing = byName.get(NEW_DEPARTMENTS[key].name.toLowerCase());
      if (existing) resolved.set(key, existing._id as mongoose.Types.ObjectId);
      else {
        resolved.set(key, 'NEW');
        toCreate.set(key, NEW_DEPARTMENTS[key]);
      }
    } else problems.push(`Department "${name}" matches no system department (add it to DEPARTMENT_ALIASES or create it)`);
  }

  // ---- Users ----
  const staffRole = await Role.findOne({ code: ROLE_CODES.STAFF }).select('_id');
  if (!staffRole) throw new Error('Staff role is missing');
  const hodOf = new Map((await Department.find({ hodUserId: { $ne: null } }).select('hodUserId name')).map((d) => [String(d.hodUserId), d.name]));
  const users = await User.find({ employeeId: { $in: hr.map((r) => r.employeeId) } }).select('employeeId name departmentId designation whatsappNumber username mustCompleteProfile');
  const userById = new Map(users.map((u) => [u.employeeId, u]));
  const takenUsernames = new Set(
    (await User.find({ username: { $in: hr.map((r) => r.employeeId.toLowerCase()) } }).select('username employeeId')).map((u) => u.username)
  );
  const deptName = new Map(depts.map((d) => [String(d._id), d.name]));

  const stats = { ownDetailsKept: 0, nameChanged: 0, deptChanged: 0, designationChanged: 0, whatsappAdded: 0, whatsappKeptOwn: 0, hodDeptKept: 0, unchanged: 0, created: 0 };
  const updates: Array<{ id: mongoose.Types.ObjectId; set: Record<string, any> }> = [];
  const creates: HrRow[] = [];
  const hodNotes: string[] = [];
  const samples: string[] = [];

  for (const r of hr) {
    const key = r.department.toLowerCase();
    const dept = resolved.get(key);
    if (dept === undefined) continue; // unmatched department: reported above
    const u = userById.get(r.employeeId);
    if (!u) {
      if (takenUsernames.has(r.employeeId.toLowerCase())) {
        problems.push(`Line ${r.line}: username "${r.employeeId}" is already used by another account; ${r.name} was not created`);
        continue;
      }
      creates.push(r);
      continue;
    }
    // Already confirmed their own details (or set up by an admin): leave everything as it is
    if (!u.mustCompleteProfile) {
      stats.ownDetailsKept++;
      continue;
    }
    const set: Record<string, any> = {};
    const changes: string[] = [];
    if (r.name && r.name !== u.name) {
      set.name = r.name;
      stats.nameChanged++;
      changes.push(`name "${u.name}" → "${r.name}"`);
    }
    if (r.designation && r.designation !== (u.designation ?? '')) {
      set.designation = r.designation;
      stats.designationChanged++;
      changes.push(`designation "${u.designation ?? ''}" → "${r.designation}"`);
    }
    const hodDept = hodOf.get(String(u._id));
    if (dept !== 'NEW' && String(u.departmentId ?? '') !== String(dept)) {
      if (hodDept) {
        stats.hodDeptKept++;
        hodNotes.push(`${u.name} (${u.employeeId}) is HOD of ${hodDept}; HR says ${r.department} — department kept`);
      } else {
        set.departmentId = dept;
        stats.deptChanged++;
        changes.push(`department "${deptName.get(String(u.departmentId)) ?? '—'}" → "${deptName.get(String(dept))}"`);
      }
    } else if (dept === 'NEW' && !hodDept) {
      set.__newDept = key;
      stats.deptChanged++;
      changes.push(`department → "${toCreate.get(key)!.name}" (new)`);
    }
    if (r.phone) {
      if (!u.whatsappNumber) {
        set.whatsappNumber = r.phone;
        stats.whatsappAdded++;
        changes.push(`WhatsApp +${r.phone} added`);
      } else if (u.whatsappNumber !== r.phone) stats.whatsappKeptOwn++;
    }
    if (Object.keys(set).length) {
      updates.push({ id: u._id as mongoose.Types.ObjectId, set });
      if (samples.length < 15) samples.push(`  ${u.employeeId} ${r.name}: ${changes.join('; ')}`);
    } else stats.unchanged++;
  }
  stats.created = creates.length;

  // ---- Report ----
  console.log(`Matched existing accounts: ${users.length}   New accounts to create: ${creates.length}`);
  console.table({
    'Filled in own details — not touched': stats.ownDetailsKept,
    'Name updated': stats.nameChanged,
    'Department updated': stats.deptChanged,
    'Designation updated': stats.designationChanged,
    'WhatsApp number added': stats.whatsappAdded,
    'Own WhatsApp kept (differs from HR)': stats.whatsappKeptOwn,
    'HOD kept in their department': stats.hodDeptKept,
    'Already up to date': stats.unchanged,
    'New accounts': stats.created,
  });
  if (toCreate.size) console.log(`Departments to create: ${[...toCreate.values()].map((d) => d.name).join(', ')}`);
  if (samples.length) console.log(`\nExamples of changes:\n${samples.join('\n')}`);
  if (creates.length) console.log(`\nNew accounts (first 10):\n${creates.slice(0, 10).map((r) => `  ${r.employeeId} ${r.name} — ${r.department}, ${r.designation}`).join('\n')}`);
  if (hodNotes.length) console.log(`\nHODs whose HR department differs (not moved):\n  ${hodNotes.join('\n  ')}`);
  if (problems.length) console.log(`\n⚠️  Problems (${problems.length}):\n  ${problems.join('\n  ')}`);

  if (!apply) {
    console.log('\nDRY RUN — nothing was changed. Run again with --apply to make these changes.');
    return;
  }
  if (problems.some((p) => p.startsWith('Department'))) {
    throw new Error('Some HR departments match no system department; fix the mapping before applying.');
  }

  // ---- Apply ----
  const createdDepts = new Map<string, mongoose.Types.ObjectId>();
  for (const [key, d] of toCreate) {
    const dept = await Department.findOneAndUpdate({ code: d.code }, { $setOnInsert: { ...d, active: true } }, { upsert: true, new: true });
    createdDepts.set(key, dept!._id as mongoose.Types.ObjectId);
  }
  const deptFor = (key: string) => {
    const d = resolved.get(key);
    return d === 'NEW' ? createdDepts.get(key) : d;
  };

  if (updates.length) {
    await User.bulkWrite(
      updates.map(({ id, set }) => {
        const { __newDept, ...rest } = set;
        return { updateOne: { filter: { _id: id }, update: { $set: { ...rest, ...(__newDept ? { departmentId: createdDepts.get(__newDept) } : {}) } } } };
      })
    );
  }

  const passwordHash = await hashPassword(COMMON_STAFF_PASSWORD);
  let created = 0;
  for (const r of creates) {
    try {
      await User.create({
        employeeId: r.employeeId,
        username: r.employeeId.toLowerCase(),
        name: r.name,
        passwordHash,
        mustCompleteProfile: true,
        roles: [staffRole._id],
        departmentId: deptFor(r.department.toLowerCase()) ?? null,
        designation: r.designation || undefined,
        whatsappNumber: r.phone,
        status: 'ACTIVE',
      });
      created++;
    } catch (err: any) {
      console.log(`  ⚠️  Could not create ${r.employeeId} ${r.name}: ${err?.message}`);
    }
  }

  await AuditLog.create({
    action: 'USERS_HR_SYNC',
    category: 'users',
    summary: `HR employee list applied: ${updates.length} accounts updated, ${created} created`,
    meta: { file: file.split(/[\\/]/).pop(), ...stats, created, departmentsCreated: [...toCreate.values()].map((d) => d.name) },
    timestamp: new Date(),
  });
  console.log(`\n✅ Applied: ${updates.length} accounts updated, ${created} accounts created${toCreate.size ? `, ${toCreate.size} department(s) created` : ''}.`);
};

main()
  .then(() => mongoose.disconnect())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('❌', err?.message || err);
    await mongoose.disconnect();
    process.exit(1);
  });
