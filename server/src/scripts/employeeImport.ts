// Turns the HR "active employees" export into staff accounts (no database access here, so it can be
// tested). The runner is importEmployees.ts.
//
// Rules agreed with the hospital:
// - Username = Employee ID (lower case); everyone starts with the common password and must set
//   their own on first login (mustCompleteProfile).
// - Department comes from HR_DEPARTMENT_MAP; HR departments with no match are left empty and the
//   staff member picks one on first login.
// - Email is optional: kept only when valid and not already used. WhatsApp numbers are not imported
//   (staff add them on first login).

import { HR_DEPARTMENT_MAP } from './hrDepartmentMap.js';

/** RFC 4180 CSV: quoted fields, doubled quotes, commas and line breaks inside quotes, BOM, CRLF. */
export const parseCsv = (text: string): string[][] => {
  const src = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
};

export const normaliseHrDepartment = (name: string): string => name.trim().replace(/\s+/g, ' ').toLowerCase();

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface EmployeeRecord {
  employeeId: string;
  username: string;
  name: string;
  designation?: string;
  email?: string;
  phone?: string;
  /** Code of the standard department, or null when the staff member must pick one. */
  departmentCode: string | null;
  hrDepartment: string;
}

export interface ImportNote {
  row: number;
  employeeId: string;
  name: string;
  kind: 'SKIPPED' | 'WARNING' | 'NO_DEPARTMENT';
  note: string;
}

export interface ExistingAccounts {
  employeeIds: Set<string>; // lower case
  usernames: Set<string>; // lower case
  emails: Set<string>; // lower case
}

const REQUIRED_COLUMNS = ['employee id', 'full name', 'department', 'designation'];

/** Builds the accounts to create from the parsed CSV, with a note for everything skipped or changed. */
export const buildEmployees = (rows: string[][], existing: ExistingAccounts) => {
  if (!rows.length) throw new Error('The file is empty');
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length) throw new Error(`Missing column(s): ${missing.join(', ')}`);
  const col = (name: string) => header.indexOf(name);
  const get = (r: string[], name: string) => (col(name) >= 0 ? (r[col(name)] ?? '').trim() : '');

  const records: EmployeeRecord[] = [];
  const notes: ImportNote[] = [];
  const seenIds = new Set<string>();
  // An address on several rows (e.g. a department's shared inbox) belongs to nobody in particular
  const emailUses = new Map<string, number>();
  rows.slice(1).forEach((r) => {
    const e = get(r, 'email').toLowerCase();
    if (e) emailUses.set(e, (emailUses.get(e) ?? 0) + 1);
  });

  rows.slice(1).forEach((r, i) => {
    const rowNum = i + 2; // spreadsheet row, counting the header
    const employeeId = get(r, 'employee id');
    const name = get(r, 'full name');
    const note = (kind: ImportNote['kind'], text: string) => notes.push({ row: rowNum, employeeId, name, kind, note: text });

    if (!employeeId) return note('SKIPPED', 'No Employee ID');
    if (!name) return note('SKIPPED', 'No name');
    const username = employeeId.toLowerCase();
    if (seenIds.has(username)) return note('SKIPPED', 'Employee ID appears more than once in the file');
    seenIds.add(username);
    if (existing.employeeIds.has(username) || existing.usernames.has(username)) {
      return note('SKIPPED', 'An account with this Employee ID already exists');
    }
    if (/\s/.test(employeeId)) note('WARNING', `Employee ID contains a space; they sign in with "${employeeId}" exactly`);

    const hrDepartment = get(r, 'department');
    const key = normaliseHrDepartment(hrDepartment);
    let departmentCode: string | null = null;
    if (key in HR_DEPARTMENT_MAP) {
      departmentCode = HR_DEPARTMENT_MAP[key];
      if (!departmentCode) note('NO_DEPARTMENT', `"${hrDepartment || '(blank)'}" has no matching department; they pick one on first login`);
    } else {
      note('NO_DEPARTMENT', `Unknown HR department "${hrDepartment}"; they pick one on first login`);
    }

    let email: string | undefined = get(r, 'email').toLowerCase() || undefined;
    if (email && !EMAIL.test(email)) {
      note('WARNING', `Email "${email}" is not valid and was left out`);
      email = undefined;
    } else if (email && (emailUses.get(email) ?? 0) > 1) {
      note('WARNING', `Email "${email}" is shared by ${emailUses.get(email)} employees and was left out`);
      email = undefined;
    } else if (email && existing.emails.has(email)) {
      note('WARNING', `Email "${email}" is already used by another account and was left out`);
      email = undefined;
    }

    const phone = get(r, 'mobile no').replace(/\D/g, '') || undefined;
    records.push({
      employeeId,
      username,
      name,
      designation: get(r, 'designation') || undefined,
      email,
      phone,
      departmentCode,
      hrDepartment,
    });
  });

  return { records, notes };
};
