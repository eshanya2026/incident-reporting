/**
 * Staff Accounts CSV Bulk Import CLI Script
 * Implements Step 3 of Phase 9 (Rollout & Migration).
 *
 * Reads an HR-provided CSV file and bulk-onboards staff into the system with
 * their assigned department and role.
 *
 * Usage:
 *   npx tsx src/scripts/importStaffCsv.ts <path-to-csv> [--dry-run] [--update] [--default-password=Staff@123]
 *   npm run import:staff -- src/seeders/sample_hr_staff.csv --dry-run
 */

import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { User } from '../modules/users/user.model.js';
import { Role } from '../modules/roles/role.model.js';
import { Department } from '../modules/departments/department.model.js';
import { hashPassword } from '../modules/auth/auth.utils.js';
import { ROLE_CODES } from '../common/enums/permissions.js';

interface CsvRow {
  employeeId: string;
  name: string;
  email: string;
  username: string;
  departmentCode?: string;
  roleCode?: string;
  designation?: string;
  phone?: string;
  password?: string;
}

const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

export const parseCsvFile = (filePath: string): CsvRow[] => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#'));

  if (lines.length < 2) {
    throw new Error('CSV file must contain a header row and at least one data row.');
  }

  const headerLine = lines[0];
  const headers = parseCsvLine(headerLine).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const rowObj: any = {};

    headers.forEach((h, index) => {
      const val = values[index] ?? '';
      if (h.includes('empid') || h === 'employeeid') rowObj.employeeId = val;
      else if (h === 'name' || h === 'fullname') rowObj.name = val;
      else if (h === 'email') rowObj.email = val;
      else if (h === 'username') rowObj.username = val;
      else if (h.includes('dept') || h === 'departmentcode') rowObj.departmentCode = val;
      else if (h.includes('role') || h === 'rolecode') rowObj.roleCode = val;
      else if (h.includes('designation') || h === 'title') rowObj.designation = val;
      else if (h.includes('phone') || h === 'mobile') rowObj.phone = val;
      else if (h.includes('password') || h === 'pwd') rowObj.password = val;
    });

    if (rowObj.employeeId && rowObj.name && rowObj.email && rowObj.username) {
      rows.push(rowObj);
    }
  }

  return rows;
};

export const runCsvImport = async (
  csvPath: string,
  options: { dryRun?: boolean; updateExisting?: boolean; defaultPassword?: string } = {}
): Promise<void> => {
  const isDryRun = Boolean(options.dryRun);
  const updateExisting = Boolean(options.updateExisting);
  const defaultPassword = options.defaultPassword || 'Staff@123';

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(env.MONGO_URI);
  }

  const resolvedPath = path.resolve(process.cwd(), csvPath);
  console.log('==================================================================');
  console.log('  Adhiparasakthi Hospitals - Staff Bulk CSV Import');
  console.log(`  Source File: ${resolvedPath}`);
  console.log(`  Mode:        ${isDryRun ? 'DRY-RUN (Validation only)' : 'DATABASE IMPORT'}`);
  console.log(`  Update:      ${updateExisting ? 'YES (Overwrite existing)' : 'NO (Skip existing)'}`);
  console.log('==================================================================\n');

  const rows = parseCsvFile(resolvedPath);
  console.log(`Found ${rows.length} valid data rows in CSV.\n`);

  const roles = await Role.find({});
  const roleMap = new Map(roles.map((r) => [r.code.toUpperCase(), r]));

  const departments = await Department.find({});
  const deptByCode = new Map(departments.map((d) => [d.code.toUpperCase(), d]));
  const deptByName = new Map(departments.map((d) => [d.name.toLowerCase(), d]));

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const errors: Array<{ row: number; empId: string; reason: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const item = rows[i];
    const rowNum = i + 2; // +1 for 0-index, +1 for header
    const roleCode = (item.roleCode || 'STAFF').toUpperCase();
    const targetRole = roleMap.get(roleCode);

    if (!targetRole) {
      errors.push({ row: rowNum, empId: item.employeeId, reason: `Unknown role: ${roleCode}` });
      continue;
    }

    let deptDoc: any = null;
    if (item.departmentCode) {
      deptDoc =
        deptByCode.get(item.departmentCode.toUpperCase()) ||
        deptByName.get(item.departmentCode.toLowerCase()) ||
        null;
    }

    if ((roleCode === 'STAFF' || roleCode === 'HOD') && !deptDoc) {
      errors.push({
        row: rowNum,
        empId: item.employeeId,
        reason: `Department '${item.departmentCode || ''}' not found in database.`,
      });
      continue;
    }

    try {
      const existing = await User.findOne({
        $or: [
          { employeeId: item.employeeId },
          { username: item.username.toLowerCase() },
          { email: item.email.toLowerCase() },
        ],
      });

      if (existing) {
        if (!updateExisting) {
          skipped++;
          continue;
        }

        if (!isDryRun) {
          existing.name = item.name;
          existing.email = item.email.toLowerCase();
          if (item.designation) existing.designation = item.designation;
          if (item.phone) existing.phone = item.phone;
          if (deptDoc) existing.departmentId = deptDoc._id;
          existing.roles = [targetRole._id as any];
          if (item.password) {
            existing.passwordHash = await hashPassword(item.password);
          }
          await existing.save();
        }
        updated++;
      } else {
        if (!isDryRun) {
          const pwd = item.password || defaultPassword;
          await User.create({
            employeeId: item.employeeId,
            name: item.name,
            email: item.email.toLowerCase(),
            username: item.username.toLowerCase(),
            passwordHash: await hashPassword(pwd),
            phone: item.phone,
            departmentId: deptDoc?._id || null,
            designation: item.designation,
            roles: [targetRole._id],
            status: 'ACTIVE',
          });
        }
        imported++;
      }
    } catch (err: any) {
      errors.push({ row: rowNum, empId: item.employeeId, reason: err.message || 'Save error' });
    }
  }

  console.log('📊 Import Summary:');
  console.table([
    { Metric: 'Total Rows in File', Count: rows.length },
    { Metric: isDryRun ? 'Valid New Accounts' : 'Successfully Created', Count: imported },
    { Metric: isDryRun ? 'Existing Accounts (Would Update)' : 'Updated Accounts', Count: updated },
    { Metric: isDryRun ? 'Existing Accounts (Would Skip)' : 'Skipped Accounts', Count: skipped },
    { Metric: 'Failed / Invalid Rows', Count: errors.length },
  ]);

  if (errors.length > 0) {
    console.log('\n❌ Detailed Row Errors:');
    console.table(errors);
  } else {
    console.log('\n✅ All rows validated/processed without errors.');
  }
};

// Standalone CLI execution
const isDirectRun = process.argv[1]?.includes('importStaffCsv');
if (isDirectRun) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const updateExisting = args.includes('--update');
  const fileArg = args.find((a) => !a.startsWith('--')) || 'src/seeders/sample_hr_staff.csv';

  runCsvImport(fileArg, { dryRun, updateExisting })
    .then(async () => {
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ Import failed:', err);
      await mongoose.disconnect();
      process.exit(1);
    });
}
