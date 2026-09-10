import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { Role } from '../modules/roles/role.model.js';
import { Department } from '../modules/departments/department.model.js';
import { Location } from '../modules/locations/location.model.js';
import { User } from '../modules/users/user.model.js';
import { IncidentCategory } from '../modules/categories/category.model.js';
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

    // 4. Seed Incident Categories (18 Standard Healthcare Categories)
    const categoriesData = [
      {
        code: 'PATIENT_FALL',
        name: 'Patient Fall',
        subcategories: [
          { code: 'NEAR_FALL', name: 'Near Fall', active: true },
          { code: 'FALL_WITHOUT_INJURY', name: 'Fall Without Injury', active: true },
          { code: 'FALL_WITH_INJURY', name: 'Fall With Injury', active: true },
        ],
      },
      {
        code: 'MEDICATION_SAFETY',
        name: 'Medication Safety',
        subcategories: [
          { code: 'WRONG_DRUG', name: 'Wrong Drug', active: true },
          { code: 'WRONG_DOSE', name: 'Wrong Dose', active: true },
          { code: 'WRONG_PATIENT_MED', name: 'Wrong Patient', active: true },
          { code: 'MISSED_DOSE', name: 'Missed Dose', active: true },
          { code: 'MEDICATION_DELAY', name: 'Medication Delay', active: true },
        ],
      },
      {
        code: 'PATIENT_IDENTIFICATION',
        name: 'Patient Identification',
        subcategories: [
          { code: 'WRONG_PATIENT_ID', name: 'Wrong Patient', active: true },
          { code: 'WRISTBAND_MISSING', name: 'Wristband Missing', active: true },
          { code: 'ID_MISMATCH', name: 'ID Mismatch', active: true },
        ],
      },
      {
        code: 'CLINICAL_CARE_TREATMENT',
        name: 'Clinical Care / Treatment',
        subcategories: [
          { code: 'TREATMENT_DELAY', name: 'Treatment Delay', active: true },
          { code: 'PROCEDURE_ERROR', name: 'Procedure Error', active: true },
          { code: 'DETERIORATION_NOT_RECOGNIZED', name: 'Deterioration Not Recognized', active: true },
        ],
      },
      {
        code: 'SURGERY_PROCEDURE',
        name: 'Surgery / Procedure',
        subcategories: [
          { code: 'WRONG_SITE', name: 'Wrong Site', active: true },
          { code: 'PROCEDURE_COMPLICATION', name: 'Procedure Complication', active: true },
          { code: 'SURGICAL_SAFETY_CHECKLIST_ISSUE', name: 'Surgical Safety Checklist Issue', active: true },
        ],
      },
      {
        code: 'LABORATORY',
        name: 'Laboratory',
        subcategories: [
          { code: 'SAMPLE_MISMATCH', name: 'Sample Mismatch', active: true },
          { code: 'MISLABELING', name: 'Mislabeling', active: true },
          { code: 'LOST_SAMPLE', name: 'Lost Sample', active: true },
          { code: 'DELAYED_RESULT', name: 'Delayed Result', active: true },
          { code: 'CRITICAL_RESULT_DELAY', name: 'Critical Result Delay', active: true },
        ],
      },
      {
        code: 'RADIOLOGY_IMAGING',
        name: 'Radiology / Imaging',
        subcategories: [
          { code: 'RAD_WRONG_PATIENT', name: 'Wrong Patient', active: true },
          { code: 'WRONG_STUDY', name: 'Wrong Study', active: true },
          { code: 'REPORTING_DELAY', name: 'Reporting Delay', active: true },
          { code: 'CONTRAST_REACTION', name: 'Contrast Reaction', active: true },
        ],
      },
      {
        code: 'MEDICATION_PHARMACY',
        name: 'Medication / Pharmacy',
        subcategories: [
          { code: 'DISPENSING_ERROR', name: 'Dispensing Error', active: true },
          { code: 'STOCK_ISSUE', name: 'Stock Issue', active: true },
          { code: 'WRONG_MEDICINE_SUPPLIED', name: 'Wrong Medicine Supplied', active: true },
        ],
      },
      {
        code: 'BLOOD_TRANSFUSION',
        name: 'Blood & Transfusion',
        subcategories: [
          { code: 'TRANSFUSION_REACTION', name: 'Transfusion Reaction', active: true },
          { code: 'WRONG_COMPONENT', name: 'Wrong Component', active: true },
          { code: 'IDENTIFICATION_ERROR', name: 'Identification Error', active: true },
        ],
      },
      {
        code: 'MEDICAL_DEVICE_EQUIPMENT',
        name: 'Medical Device / Equipment',
        subcategories: [
          { code: 'EQUIPMENT_FAILURE', name: 'Equipment Failure', active: true },
          { code: 'DEVICE_MALFUNCTION', name: 'Device Malfunction', active: true },
          { code: 'EQUIPMENT_UNAVAILABLE', name: 'Equipment Unavailable', active: true },
        ],
      },
      {
        code: 'INFECTION_PREVENTION_CONTROL',
        name: 'Infection Prevention & Control',
        subcategories: [
          { code: 'NEEDLE_STICK_INJURY', name: 'Needle-Stick Injury', active: true },
          { code: 'EXPOSURE', name: 'Exposure', active: true },
          { code: 'ISOLATION_BREACH', name: 'Isolation Breach', active: true },
          { code: 'INFECTION_CONTROL_BREACH', name: 'Infection-Control Breach', active: true },
        ],
      },
      {
        code: 'COMMUNICATION_HANDOVER',
        name: 'Communication / Handover',
        subcategories: [
          { code: 'HANDOVER_FAILURE', name: 'Handover Failure', active: true },
          { code: 'COMMUNICATION_DELAY', name: 'Communication Delay', active: true },
          { code: 'CRITICAL_INFO_NOT_COMMUNICATED', name: 'Critical Information Not Communicated', active: true },
        ],
      },
      {
        code: 'DOCUMENTATION_MEDICAL_RECORDS',
        name: 'Documentation / Medical Records',
        subcategories: [
          { code: 'WRONG_DOCUMENTATION', name: 'Wrong Documentation', active: true },
          { code: 'MISSING_RECORD', name: 'Missing Record', active: true },
          { code: 'INCORRECT_PATIENT_RECORD', name: 'Incorrect Patient Record', active: true },
        ],
      },
      {
        code: 'FACILITY_ENVIRONMENTAL_SAFETY',
        name: 'Facility / Environmental Safety',
        subcategories: [
          { code: 'SLIP_TRIP_HAZARD', name: 'Slip/Trip Hazard', active: true },
          { code: 'ELECTRICAL_ISSUE', name: 'Electrical Issue', active: true },
          { code: 'WATER_LEAKAGE', name: 'Water Leakage', active: true },
          { code: 'FIRE_SMOKE', name: 'Fire/Smoke', active: true },
        ],
      },
      {
        code: 'SECURITY_WORKPLACE_SAFETY',
        name: 'Security / Workplace Safety',
        subcategories: [
          { code: 'VIOLENCE', name: 'Violence', active: true },
          { code: 'THEFT', name: 'Theft', active: true },
          { code: 'UNAUTHORIZED_ACCESS', name: 'Unauthorized Access', active: true },
          { code: 'PATIENT_ELOPEMENT', name: 'Patient Elopement', active: true },
        ],
      },
      {
        code: 'IT_SYSTEM_FAILURE',
        name: 'IT / System / Communication Failure',
        subcategories: [
          { code: 'HIS_DOWNTIME', name: 'HIS Downtime', active: true },
          { code: 'LIS_DOWNTIME', name: 'LIS Downtime', active: true },
          { code: 'NETWORK_FAILURE', name: 'Network Failure', active: true },
          { code: 'SYSTEM_ERROR', name: 'System Error', active: true },
        ],
      },
      {
        code: 'PATIENT_VISITOR_COMPLAINT',
        name: 'Patient / Visitor Complaint Event',
        subcategories: [
          { code: 'STAFF_BEHAVIOUR', name: 'Staff Behaviour', active: true },
          { code: 'SERVICE_DELAY', name: 'Service Delay', active: true },
          { code: 'SAFETY_CONCERN', name: 'Safety Concern', active: true },
        ],
      },
      {
        code: 'OTHER',
        name: 'Other',
        subcategories: [
          { code: 'OTHER_REPORTABLE_INCIDENT', name: 'Other reportable incident', active: true },
        ],
      },
    ];

    for (let i = 0; i < categoriesData.length; i++) {
      const cat = categoriesData[i];
      await IncidentCategory.findOneAndUpdate(
        { code: cat.code },
        { ...cat, order: i + 1, active: true },
        { upsert: true, new: true }
      );
    }
    logger.info('✅ Incident Categories seeded (18 categories with subcategories)');

    // 5. Seed Initial Users
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
