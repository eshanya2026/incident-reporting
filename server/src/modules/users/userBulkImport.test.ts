import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import path from 'node:path';
import { User } from './user.model.js';
import { Role } from '../roles/role.model.js';
import { Department } from '../departments/department.model.js';
import { bulkImportUsers } from './user.controller.js';
import { parseCsvFile } from '../../scripts/importStaffCsv.js';
import { comparePassword } from '../auth/auth.utils.js';

const withDbName = (uri: string, db: string) => {
  const url = new URL(uri);
  url.pathname = `/${db}`;
  return url.toString();
};
// Opt-in only: this drops the target database in beforeAll/afterAll, so it must never fall back to a
// real-looking default (MONGO_URI, or a hardcoded localhost:27017/incident_db). On a machine with any
// other MongoDB reachable on the default port -- e.g. another project's own Docker container -- a
// plain `npm test` with no env vars would otherwise silently connect to it and drop a database there.
const MONGO_URI = process.env.TEST_MONGO_URI ? withDbName(process.env.TEST_MONGO_URI, 'user_bulk_import_test') : undefined;

describe.skipIf(!MONGO_URI)('User Bulk Import (Integration & Unit)', () => {
  let roleStaffId: mongoose.Types.ObjectId;
  let roleHodId: mongoose.Types.ObjectId;
  let roleQualityId: mongoose.Types.ObjectId;
  let deptEmgId: mongoose.Types.ObjectId;
  let deptIcuId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await mongoose.connect(MONGO_URI!);
    await mongoose.connection.dropDatabase();

    const [rStaff, rHod, rQuality] = await Promise.all([
      Role.create({ name: 'Staff', code: 'STAFF', permissions: [] }),
      Role.create({ name: 'HOD', code: 'HOD', permissions: [] }),
      Role.create({ name: 'Quality', code: 'QUALITY', permissions: [] }),
    ]);
    roleStaffId = rStaff._id as mongoose.Types.ObjectId;
    roleHodId = rHod._id as mongoose.Types.ObjectId;
    roleQualityId = rQuality._id as mongoose.Types.ObjectId;

    const [dEmg, dIcu] = await Promise.all([
      Department.create({ name: 'Emergency Medicine', code: 'EMERGENCY' }),
      Department.create({ name: 'Intensive Care Unit', code: 'ICU' }),
    ]);
    deptEmgId = dEmg._id as mongoose.Types.ObjectId;
    deptIcuId = dIcu._id as mongoose.Types.ObjectId;
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  it('parses sample CSV template correctly', () => {
    const csvPath = path.resolve(__dirname, '../../seeders/sample_hr_staff.csv');
    const rows = parseCsvFile(csvPath);
    expect(rows.length).toBeGreaterThanOrEqual(8);
    expect(rows[0]).toMatchObject({
      employeeId: 'EMP-EMG-101',
      name: 'Dr. Ananya Nair',
      email: 'ananya.nair@adhiparasakthi.org',
      departmentCode: 'EMERGENCY',
      roleCode: 'STAFF',
    });
  });

  it('bulk imports new staff and hashes default password', async () => {
    let responseData: any = null;
    let statusCode: number = 0;

    const req: any = {
      body: {
        users: [
          {
            employeeId: 'EMP-T1',
            name: 'Dr. Test One',
            email: 'test1@hospital.org',
            username: 'test.one',
            departmentCode: 'EMERGENCY',
            roleCode: 'STAFF',
            designation: 'Medical Officer',
          },
          {
            employeeId: 'EMP-T2',
            name: 'Sister Test Two',
            email: 'test2@hospital.org',
            username: 'test.two',
            departmentCode: 'ICU',
            roleCode: 'STAFF',
          },
        ],
        updateExisting: false,
      },
    };

    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (data: any) => {
        responseData = data;
        return res;
      },
    };

    const next: any = (err: any) => {
      if (err) throw err;
    };

    await bulkImportUsers(req, res, next);

    expect(statusCode).toBe(200);
    expect(responseData.data.imported).toBe(2);
    expect(responseData.data.failed).toBe(0);

    const user1 = await User.findOne({ employeeId: 'EMP-T1' });
    expect(user1).not.toBeNull();
    expect(user1?.name).toBe('Dr. Test One');
    expect(user1?.departmentId?.toString()).toBe(deptEmgId.toString());

    // Password must be hashed and match default Staff@123
    const isMatch = await comparePassword('Staff@123', user1!.passwordHash);
    expect(isMatch).toBe(true);
  });

  it('updates existing users when updateExisting is true and skips when false', async () => {
    // Seed initial user
    await User.create({
      employeeId: 'EMP-T1',
      name: 'Original Name',
      email: 'original@hospital.org',
      username: 'original.user',
      passwordHash: 'hash',
      departmentId: deptEmgId,
      roles: [roleStaffId],
      status: 'ACTIVE',
    });

    const createReq = (updateExisting: boolean) => ({
      body: {
        users: [
          {
            employeeId: 'EMP-T1',
            name: 'Updated Name',
            email: 'updated@hospital.org',
            username: 'original.user',
            departmentCode: 'ICU',
            roleCode: 'STAFF',
          },
        ],
        updateExisting,
      },
    });

    const mockRes = () => {
      let r: any = {};
      const res: any = {
        status: (code: number) => {
          r.code = code;
          return res;
        },
        json: (data: any) => {
          r.data = data;
          return res;
        },
      };
      return { res, getResult: () => r };
    };

    // 1. Skip when false
    const h1 = mockRes();
    await bulkImportUsers(createReq(false) as any, h1.res, (e) => { if (e) throw e; });
    expect(h1.getResult().data.data.skipped).toBe(1);
    expect(h1.getResult().data.data.updated).toBe(0);

    let doc = await User.findOne({ employeeId: 'EMP-T1' });
    expect(doc?.name).toBe('Original Name');

    // 2. Update when true
    const h2 = mockRes();
    await bulkImportUsers(createReq(true) as any, h2.res, (e) => { if (e) throw e; });
    expect(h2.getResult().data.data.updated).toBe(1);

    doc = await User.findOne({ employeeId: 'EMP-T1' });
    expect(doc?.name).toBe('Updated Name');
    expect(doc?.departmentId?.toString()).toBe(deptIcuId.toString());
  });

  it('reports errors for unknown roles and missing departments gracefully', async () => {
    let responseData: any = null;
    const req: any = {
      body: {
        users: [
          {
            employeeId: 'EMP-BAD-1',
            name: 'Invalid Role',
            email: 'bad1@hospital.org',
            username: 'bad.one',
            roleCode: 'NON_EXISTENT_ROLE',
          },
          {
            employeeId: 'EMP-BAD-2',
            name: 'Missing Dept',
            email: 'bad2@hospital.org',
            username: 'bad.two',
            roleCode: 'STAFF',
            departmentCode: 'GHOST_DEPT',
          },
        ],
      },
    };

    const res: any = {
      status: () => res,
      json: (data: any) => {
        responseData = data;
        return res;
      },
    };

    await bulkImportUsers(req, res, (e) => { if (e) throw e; });

    expect(responseData.data.failed).toBe(2);
    expect(responseData.data.errors).toHaveLength(2);
    expect(responseData.data.errors[0].error).toContain('Unknown role');
    expect(responseData.data.errors[1].error).toContain('Department \'GHOST_DEPT\' not found');
  });
});
