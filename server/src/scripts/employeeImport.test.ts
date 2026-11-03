import { describe, expect, it } from 'vitest';
import { buildEmployees, parseCsv } from './employeeImport.js';

const none = () => ({ employeeIds: new Set<string>(), usernames: new Set<string>(), emails: new Set<string>() });
const HEADER = 'Employee ID,Full Name,Email,Username,Department,Designation,Mobile No';

describe('parseCsv', () => {
  it('handles a BOM, CRLF, quoted commas, doubled quotes and blank lines', () => {
    const rows = parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n\r\n1,2');
    expect(rows).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
      ['1', '2'],
    ]);
  });
});

describe('buildEmployees', () => {
  const build = (lines: string[], existing = none()) => buildEmployees(parseCsv([HEADER, ...lines].join('\n')), existing);

  it('uses the Employee ID as username and maps the HR department, ignoring the CSV username', () => {
    const { records, notes } = build(['90001,TEST PERSON A,,99999,Accounts,Ward Boy,']);
    expect(records[0]).toMatchObject({ employeeId: '90001', username: '90001', name: 'TEST PERSON A', designation: 'Ward Boy', departmentCode: 'RD_ACCOUNTS_AND_FINANCE' });
    expect(notes).toEqual([]);
  });

  it('matches HR department names regardless of case and spacing', () => {
    const { records } = build(['1,A,,,  house   keeping ,Helper,', '2,B,,,HouseKeeping,Helper,', '3,C,,,INFORMATION TECHNOLOGY,Engineer,']);
    expect(records.map((r) => r.departmentCode)).toEqual(['RD_HOUSEKEEPING', 'RD_HOUSEKEEPING', 'RD_INFORMATION_TECHNOLOGY_DEPARTMENT']);
  });

  it('leaves interns, blank and unknown departments empty, to be picked on first login', () => {
    const { records, notes } = build(['1,A,,,INTERN,Intern,', '2,B,,,,Staff,', '3,C,,,Brand New Dept,Staff,']);
    expect(records.map((r) => r.departmentCode)).toEqual([null, null, null]);
    expect(notes.filter((n) => n.kind === 'NO_DEPARTMENT')).toHaveLength(3);
  });

  it('keeps valid unique emails only, and keeps mobile digits', () => {
    const { records, notes } = build(
      ['1,A,a@x.org,,Accounts,M,90000 00000', '2,B,not-an-email,,Accounts,M,', '3,C,A@X.org,,Accounts,M,', '4,D,taken@x.org,,Accounts,M,'],
      { ...none(), emails: new Set(['taken@x.org']) }
    );
    // 'a@x.org' appears twice (rows 1 and 3), so it is left out for both
    expect(records.map((r) => r.email)).toEqual([undefined, undefined, undefined, undefined]);
    expect(records[0].phone).toBe('9000000000');
    expect(notes.filter((n) => n.kind === 'WARNING')).toHaveLength(4);
    expect(build(['1,A,solo@x.org,,Accounts,M,']).records[0].email).toBe('solo@x.org');
  });

  it('skips existing accounts and repeated IDs, so re-running is safe', () => {
    const { records, notes } = build(['T99XY001,A,,,Accounts,M,', 't99xy001,A again,,,Accounts,M,', '90002,Existing,,,Accounts,M,'], {
      ...none(),
      employeeIds: new Set(['90002']),
    });
    expect(records.map((r) => r.username)).toEqual(['t99xy001']);
    expect(notes.filter((n) => n.kind === 'SKIPPED').map((n) => n.employeeId)).toEqual(['t99xy001', '90002']);
  });

  it('refuses a file without the expected columns', () => {
    expect(() => buildEmployees(parseCsv('Name,Dept\nA,B'), none())).toThrow(/Missing column/);
  });
});
