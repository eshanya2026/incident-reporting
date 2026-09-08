import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { Role } from '../modules/roles/role.model.js';
import { Department } from '../modules/departments/department.model.js';
import { Location } from '../modules/locations/location.model.js';
import { User } from '../modules/users/user.model.js';
import { hashPassword } from '../modules/auth/auth.utils.js';
import { PERMISSIONS } from '../common/enums/permissions.js';

export const seedDatabase = async (): Promise<void> => {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.MONGO_URI);
    }

    logger.info('🌱 Starting database seeding process...');

    // 1. Seed System Roles
    const allPermissions = Object.values(PERMISSIONS);

    const rolesData = [
      {
        name: 'Super Administrator',
        code: 'SUPER_ADMIN',
        permissions: allPermissions,
        isSystemRole: true,
      },
      {
        name: 'Quality & Patient Safety Admin',
        code: 'QUALITY_ADMIN',
        permissions: [
          PERMISSIONS.INCIDENT_CREATE,
          PERMISSIONS.INCIDENT_READ_ALL,
          PERMISSIONS.INCIDENT_UPDATE,
          PERMISSIONS.INCIDENT_TRIAGE,
          PERMISSIONS.INCIDENT_ASSIGN,
          PERMISSIONS.INCIDENT_CHANGE_SEVERITY,
          PERMISSIONS.INCIDENT_CLOSE,
          PERMISSIONS.INCIDENT_REOPEN,
          PERMISSIONS.INVESTIGATION_CREATE,
          PERMISSIONS.INVESTIGATION_READ,
          PERMISSIONS.INVESTIGATION_UPDATE,
          PERMISSIONS.INVESTIGATION_COMPLETE,
          PERMISSIONS.RCA_CREATE,
          PERMISSIONS.RCA_READ,
          PERMISSIONS.RCA_UPDATE,
          PERMISSIONS.RCA_APPROVE,
          PERMISSIONS.CAPA_CREATE,
          PERMISSIONS.CAPA_READ,
          PERMISSIONS.CAPA_UPDATE,
          PERMISSIONS.CAPA_VERIFY,
          PERMISSIONS.REPORT_VIEW_ALL,
          PERMISSIONS.DASHBOARD_VIEW_MANAGEMENT,
          PERMISSIONS.ADMIN_USER_MANAGE,
          PERMISSIONS.ADMIN_ROLE_MANAGE,
          PERMISSIONS.ADMIN_DEPARTMENT_MANAGE,
          PERMISSIONS.ADMIN_LOCATION_MANAGE,
          PERMISSIONS.ADMIN_CATEGORY_MANAGE,
          PERMISSIONS.ADMIN_AUDIT_VIEW,
        ],
        isSystemRole: true,
      },
      {
        name: 'Hospital Management',
        code: 'MANAGEMENT',
        permissions: [
          PERMISSIONS.INCIDENT_READ_ALL,
          PERMISSIONS.INVESTIGATION_READ,
          PERMISSIONS.RCA_READ,
          PERMISSIONS.CAPA_READ,
          PERMISSIONS.REPORT_VIEW_ALL,
          PERMISSIONS.DASHBOARD_VIEW_MANAGEMENT,
        ],
        isSystemRole: true,
      },
      {
        name: 'Head of Department (HOD)',
        code: 'HOD',
        permissions: [
          PERMISSIONS.INCIDENT_CREATE,
          PERMISSIONS.INCIDENT_READ_DEPARTMENT,
          PERMISSIONS.INCIDENT_TRIAGE,
          PERMISSIONS.INCIDENT_ASSIGN,
          PERMISSIONS.INVESTIGATION_READ,
          PERMISSIONS.CAPA_READ,
          PERMISSIONS.CAPA_UPDATE,
          PERMISSIONS.REPORT_VIEW_DEPARTMENT,
        ],
        isSystemRole: true,
      },
      {
        name: 'Incident Investigator',
        code: 'INVESTIGATOR',
        permissions: [
          PERMISSIONS.INCIDENT_CREATE,
          PERMISSIONS.INCIDENT_READ_DEPARTMENT,
          PERMISSIONS.INVESTIGATION_CREATE,
          PERMISSIONS.INVESTIGATION_READ,
          PERMISSIONS.INVESTIGATION_UPDATE,
          PERMISSIONS.INVESTIGATION_COMPLETE,
          PERMISSIONS.RCA_CREATE,
          PERMISSIONS.RCA_READ,
          PERMISSIONS.RCA_UPDATE,
        ],
        isSystemRole: true,
      },
      {
        name: 'CAPA Action Owner',
        code: 'CAPA_OWNER',
        permissions: [
          PERMISSIONS.INCIDENT_CREATE,
          PERMISSIONS.INCIDENT_READ_OWN,
          PERMISSIONS.CAPA_READ,
          PERMISSIONS.CAPA_UPDATE,
          PERMISSIONS.CAPA_COMPLETE,
        ],
        isSystemRole: true,
      },
      {
        name: 'Hospital Staff',
        code: 'STAFF',
        permissions: [PERMISSIONS.INCIDENT_CREATE, PERMISSIONS.INCIDENT_READ_OWN],
        isSystemRole: true,
      },
      {
        name: 'Safety Auditor',
        code: 'AUDITOR',
        permissions: [
          PERMISSIONS.INCIDENT_READ_ALL,
          PERMISSIONS.INVESTIGATION_READ,
          PERMISSIONS.RCA_READ,
          PERMISSIONS.CAPA_READ,
          PERMISSIONS.REPORT_VIEW_ALL,
          PERMISSIONS.ADMIN_AUDIT_VIEW,
        ],
        isSystemRole: true,
      },
    ];

    for (const r of rolesData) {
      await Role.findOneAndUpdate({ code: r.code }, r, { upsert: true, new: true });
    }
    logger.info('✅ Roles seeded');

    // Fetch Roles
    const superAdminRole = await Role.findOne({ code: 'SUPER_ADMIN' });
    const qualityAdminRole = await Role.findOne({ code: 'QUALITY_ADMIN' });
    const hodRole = await Role.findOne({ code: 'HOD' });
    const staffRole = await Role.findOne({ code: 'STAFF' });

    // 2. Seed Departments
    const deptsData = [
      { code: 'EMERGENCY', name: 'Emergency Medicine' },
      { code: 'ICU', name: 'Intensive Care Unit' },
      { code: 'OT', name: 'Operation Theatre' },
      { code: 'WARD', name: 'General Inpatient Wards' },
      { code: 'PHARMACY', name: 'Hospital Pharmacy' },
      { code: 'RADIOLOGY', name: 'Radiology & Imaging' },
      { code: 'LAB', name: 'Clinical Laboratory' },
      { code: 'QUALITY', name: 'Quality & Patient Safety' },
    ];

    const deptMap = new Map<string, mongoose.Types.ObjectId>();
    for (const d of deptsData) {
      const dept = await Department.findOneAndUpdate({ code: d.code }, d, { upsert: true, new: true });
      deptMap.set(d.code, dept._id as mongoose.Types.ObjectId);
    }
    logger.info('✅ Departments seeded');

    // 3. Seed Locations
    const locationsData = [
      { code: 'ER-BAY-1', name: 'ER Bay 1 - Resuscitation', type: 'ROOM', departmentId: deptMap.get('EMERGENCY') },
      { code: 'ICU-BED-01', name: 'ICU Bed 01', type: 'ICU', departmentId: deptMap.get('ICU') },
      { code: 'OT-SUITE-1', name: 'Main OT Suite 1', type: 'OT', departmentId: deptMap.get('OT') },
      { code: 'WARD-302', name: 'General Ward Room 302', type: 'WARD', departmentId: deptMap.get('WARD') },
      { code: 'PHARM-CTR-1', name: 'IPD Pharmacy Counter', type: 'ROOM', departmentId: deptMap.get('PHARMACY') },
    ];

    for (const l of locationsData) {
      await Location.findOneAndUpdate({ code: l.code }, l, { upsert: true, new: true });
    }
    logger.info('✅ Locations seeded');

    // 4. Seed Initial Users
    const defaultPassword = await hashPassword('Admin@123');
    const defaultStaffPassword = await hashPassword('Staff@123');
    const defaultHodPassword = await hashPassword('Hod@123');
    const defaultQualityPassword = await hashPassword('Quality@123');

    const usersData = [
      {
        employeeId: 'EMP-001',
        name: 'System Administrator',
        email: 'admin@adhiparasakthi.hospital',
        username: 'admin',
        passwordHash: defaultPassword,
        departmentId: deptMap.get('QUALITY'),
        designation: 'Lead IT Admin',
        roles: [superAdminRole?._id],
        status: 'ACTIVE',
      },
      {
        employeeId: 'EMP-002',
        name: 'Dr. Anita Quality Head',
        email: 'anita.quality@adhiparasakthi.hospital',
        username: 'quality.admin',
        passwordHash: defaultQualityPassword,
        departmentId: deptMap.get('QUALITY'),
        designation: 'Chief Quality Officer',
        roles: [qualityAdminRole?._id],
        status: 'ACTIVE',
      },
      {
        employeeId: 'EMP-003',
        name: 'Dr. Ramesh Emergency HOD',
        email: 'ramesh.hod@adhiparasakthi.hospital',
        username: 'hod.emergency',
        passwordHash: defaultHodPassword,
        departmentId: deptMap.get('EMERGENCY'),
        designation: 'HOD Emergency',
        roles: [hodRole?._id],
        status: 'ACTIVE',
      },
      {
        employeeId: 'EMP-004',
        name: 'Nurse Mary Staff',
        email: 'mary.staff@adhiparasakthi.hospital',
        username: 'nurse.mary',
        passwordHash: defaultStaffPassword,
        departmentId: deptMap.get('EMERGENCY'),
        designation: 'Senior Staff Nurse',
        roles: [staffRole?._id],
        status: 'ACTIVE',
      },
    ];

    for (const u of usersData) {
      const user = await User.findOneAndUpdate({ employeeId: u.employeeId }, u, { upsert: true, new: true });
      // Update HOD link in Emergency department
      if (u.username === 'hod.emergency') {
        await Department.findByIdAndUpdate(deptMap.get('EMERGENCY'), { hodUserId: user._id });
      }
    }
    logger.info('✅ Initial Users seeded (admin / quality.admin / hod.emergency / nurse.mary)');

    logger.info('🎉 Seeding completed successfully!');
  } catch (error) {
    logger.error({ err: error }, '❌ Seeding Error');
  }
};

// Allow executing script standalone via CLI
if (process.argv[1]?.includes('index.ts') || process.argv[1]?.includes('index.js')) {
  seedDatabase().then(() => process.exit(0));
}
