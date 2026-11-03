/**
 * Creates staff accounts from the HR "active employees" CSV export.
 *
 *   npx tsx src/scripts/importEmployees.ts <file.csv> [--dry-run]          (development)
 *   node dist/scripts/importEmployees.js <file.csv> [--dry-run]            (inside the backend container)
 *
 * Every account: Staff role, username = Employee ID, password mapims@123, and must confirm details
 * and set a new password on first login. Existing Employee IDs are skipped, so it is safe to re-run.
 * Writes <file>-import-report.csv listing everything skipped, changed or needing a department.
 */
import fs from 'node:fs';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { User } from '../modules/users/user.model.js';
import { Role } from '../modules/roles/role.model.js';
import { Department } from '../modules/departments/department.model.js';
import { hashPassword } from '../modules/auth/auth.utils.js';
import { COMMON_STAFF_PASSWORD } from '../modules/auth/auth.controller.js';
import { ROLE_CODES } from '../common/enums/permissions.js';
import { runMigrations } from '../migrations/index.js';
import { buildEmployees, parseCsv } from './employeeImport.js';

const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

const main = async () => {
  const file = process.argv.slice(2).find((a) => !a.startsWith('--'));
  const dryRun = process.argv.includes('--dry-run');
  if (!file || !fs.existsSync(file)) {
    console.error('Usage: importEmployees <file.csv> [--dry-run]');
    process.exit(1);
  }

  await mongoose.connect(env.MONGO_URI);
  await runMigrations(); // makes email optional on databases that predate it

  const staffRole = await Role.findOne({ code: ROLE_CODES.STAFF }).select('_id');
  if (!staffRole) throw new Error('Staff role not found');
  const departments = await Department.find({ active: { $ne: false } }).select('code').lean();
  const deptIdByCode = new Map(departments.map((d: any) => [d.code, d._id]));

  const users = await User.find().select('employeeId username email').lean();
  const existing = {
    employeeIds: new Set(users.map((u: any) => String(u.employeeId).toLowerCase())),
    usernames: new Set(users.map((u: any) => String(u.username).toLowerCase())),
    emails: new Set(users.map((u: any) => u.email).filter(Boolean).map((e: string) => e.toLowerCase())),
  };

  const { records, notes } = buildEmployees(parseCsv(fs.readFileSync(file, 'utf8')), existing);
  for (const r of records) {
    if (r.departmentCode && !deptIdByCode.has(r.departmentCode)) {
      notes.push({ row: 0, employeeId: r.employeeId, name: r.name, kind: 'NO_DEPARTMENT', note: `Department ${r.departmentCode} not found; they pick one on first login` });
      r.departmentCode = null;
    }
  }

  const count = (kind: string) => notes.filter((n) => n.kind === kind).length;
  console.log(`To create: ${records.length} | skipped: ${count('SKIPPED')} | to pick department on first login: ${records.filter((r) => !r.departmentCode).length} | warnings: ${count('WARNING')}`);

  const reportPath = file.replace(/\.csv$/i, '') + '-import-report.csv';
  fs.writeFileSync(
    reportPath,
    '﻿' + ['Row,Employee ID,Name,Type,Note', ...notes.sort((a, b) => a.row - b.row).map((n) => [n.row || '', n.employeeId, n.name, n.kind, n.note].map(csvCell).join(','))].join('\r\n')
  );
  console.log(`Report: ${reportPath}`);

  if (dryRun) {
    console.log('Dry run: nothing was written.');
  } else if (records.length) {
    // Same starting password for everyone, so it is hashed once
    const passwordHash = await hashPassword(COMMON_STAFF_PASSWORD);
    const docs = records.map((r) => ({
      employeeId: r.employeeId,
      username: r.username,
      name: r.name,
      designation: r.designation,
      email: r.email,
      phone: r.phone,
      departmentId: r.departmentCode ? deptIdByCode.get(r.departmentCode) : undefined,
      roles: [staffRole._id],
      passwordHash,
      status: 'ACTIVE',
      mustCompleteProfile: true,
    }));
    let created = 0;
    for (let i = 0; i < docs.length; i += 500) {
      const res = await User.insertMany(docs.slice(i, i + 500), { ordered: false }).catch((err: any) => {
        console.error(`Some rows in batch ${i / 500 + 1} failed: ${err?.writeErrors?.length ?? ''} ${err?.message ?? err}`);
        return err?.insertedDocs ?? [];
      });
      created += res.length;
    }
    console.log(`Created ${created} staff accounts.`);
  }
  await mongoose.disconnect();
};

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
