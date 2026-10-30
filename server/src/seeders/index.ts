import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { Role } from '../modules/roles/role.model.js';
import { Department } from '../modules/departments/department.model.js';
import { Location } from '../modules/locations/location.model.js';
import { User } from '../modules/users/user.model.js';
import { IncidentCategory } from '../modules/categories/category.model.js';
import { hashPassword } from '../modules/auth/auth.utils.js';
import { seedDummyOperationalData } from './dummyData.js';
import { SYSTEM_ROLE_CODES, syncSystemRoles } from './systemRoles.js';
import { runMigrations } from '../migrations/index.js';
import { ROLE_CODES, RoleCode } from '../common/enums/permissions.js';
import { HOSPITAL_CATEGORIES } from './hospitalCategoriesData.js';
import { RECOMMENDED_DEPARTMENTS } from './recommendedDepartments.js';

export const seedDatabase = async (): Promise<void> => {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.MONGO_URI);
    }

    logger.info('🌱 Starting database seeding process...');

    // Bring any data from earlier versions up to date before upserting
    await runMigrations();

    // 1. Seed the four system roles: Staff, Quality, HOD, Admin (see systemRoles.ts)
    const allowedRoleCodes = SYSTEM_ROLE_CODES;
    await syncSystemRoles();

    const roleIds = new Map<string, mongoose.Types.ObjectId>();
    for (const code of allowedRoleCodes) {
      const role = await Role.findOne({ code });
      if (!role) {
        throw new Error(`System role ${code} was not seeded`);
      }
      roleIds.set(code, role._id as mongoose.Types.ObjectId);
    }
    logger.info('✅ Roles seeded (Staff / Quality / HOD / Admin)');

    // 2. Seed Departments
    // These 8 are the demo departments: seed users, locations and demo incidents all reference
    // them by code, so their codes must stay stable.
    const deptsData = [
      { code: 'EMERGENCY', name: 'Emergency Medicine' },
      { code: 'ICU', name: 'Intensive Care Unit' },
      { code: 'OT', name: 'Operation Theatre' },
      { code: 'WARD', name: 'General Inpatient Wards' },
      { code: 'PHARMACY', name: 'Hospital Pharmacy' },
      { code: 'RADIOLOGY', name: 'Radiology & Imaging' },
      { code: 'LAB', name: 'Clinical Laboratory' },
      { code: 'QUALITY', name: 'Quality & Patient Safety' },
    ].map((d) => ({ ...d, category: 'Demo & Core Operations' }));

    const deptMap = new Map<string, mongoose.Types.ObjectId>();
    for (const d of deptsData) {
      const dept = await Department.findOneAndUpdate({ code: d.code }, d, { upsert: true, new: true });
      deptMap.set(d.code, dept._id as mongoose.Types.ObjectId);
    }
    logger.info('✅ Departments seeded');

    // 2b. Seed the recommended hospital department taxonomy (Recommended_Department_Categories.md).
    // Additive: these sit alongside the 8 demo departments above and start with no HOD assigned;
    // Admin assigns real HODs to the ones the hospital actually uses.
    for (const d of RECOMMENDED_DEPARTMENTS) {
      await Department.findOneAndUpdate(
        { code: d.code },
        { code: d.code, name: d.name, category: d.category },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    logger.info(`✅ Recommended department taxonomy seeded (${RECOMMENDED_DEPARTMENTS.length} departments across 17 categories)`);

    // 3. Seed Locations (15 Core Floor-Zone Locations + Department Specialized Locations)
    const locationsData = [
      // 18 Standard Core Floor-Zone Locations
      { code: 'GF-Z1', name: 'Ground Floor - Zone-A', floor: 'Ground Floor', zone: 'Zone-A', type: 'OPD' },
      { code: 'GF-ZB', name: 'Ground Floor - Zone-B', floor: 'Ground Floor', zone: 'Zone-B', type: 'OPD' },
      { code: 'GF-ZC', name: 'Ground Floor - Zone-C', floor: 'Ground Floor', zone: 'Zone-C', type: 'OTHER' },
      { code: 'FL1-Z1', name: 'Floor 1 - Zone-A', floor: 'Floor 1', zone: 'Zone-A', type: 'ROOM' },
      { code: 'FL1-ZB', name: 'Floor 1 - Zone-B', floor: 'Floor 1', zone: 'Zone-B', type: 'ROOM' },
      { code: 'FL1-ZC', name: 'Floor 1 - Zone-C', floor: 'Floor 1', zone: 'Zone-C', type: 'ROOM' },
      { code: 'FL2-Z1', name: 'Floor 2 - Zone-A', floor: 'Floor 2', zone: 'Zone-A', type: 'ICU' },
      { code: 'FL2-ZB', name: 'Floor 2 - Zone-B', floor: 'Floor 2', zone: 'Zone-B', type: 'ICU' },
      { code: 'FL2-ZC', name: 'Floor 2 - Zone-C', floor: 'Floor 2', zone: 'Zone-C', type: 'ROOM' },
      { code: 'FL3-Z1', name: 'Floor 3 - Zone-A', floor: 'Floor 3', zone: 'Zone-A', type: 'OT' },
      { code: 'FL3-ZB', name: 'Floor 3 - Zone-B', floor: 'Floor 3', zone: 'Zone-B', type: 'OT' },
      { code: 'FL3-ZC', name: 'Floor 3 - Zone-C', floor: 'Floor 3', zone: 'Zone-C', type: 'WARD' },
      { code: 'FL4-Z1', name: 'Floor 4 - Zone-A', floor: 'Floor 4', zone: 'Zone-A', type: 'WARD' },
      { code: 'FL4-ZB', name: 'Floor 4 - Zone-B', floor: 'Floor 4', zone: 'Zone-B', type: 'LAB' },
      { code: 'FL4-ZC', name: 'Floor 4 - Zone-C', floor: 'Floor 4', zone: 'Zone-C', type: 'WARD' },
      { code: 'FL5-Z1', name: 'Floor 5 - Zone-A', floor: 'Floor 5', zone: 'Zone-A', type: 'ROOM' },
      { code: 'FL5-ZB', name: 'Floor 5 - Zone-B', floor: 'Floor 5', zone: 'Zone-B', type: 'OTHER' },
      { code: 'FL5-ZC', name: 'Floor 5 - Zone-C', floor: 'Floor 5', zone: 'Zone-C', type: 'OTHER' },

      // Specialized clinical locations mapped to their floor & zone
      { code: 'ER-BAY-1', name: 'ER Bay 1 - Resuscitation', floor: 'Floor 1', zone: 'Zone-A', type: 'ROOM', departmentId: deptMap.get('EMERGENCY') },
      { code: 'ER-BAY-2', name: 'ER Bay 2 - Acute Care', floor: 'Floor 1', zone: 'Zone-A', type: 'ROOM', departmentId: deptMap.get('EMERGENCY') },
      { code: 'ICU-BED-01', name: 'ICU Bed 01', floor: 'Floor 2', zone: 'Zone-A', type: 'ICU', departmentId: deptMap.get('ICU') },
      { code: 'ICU-BED-02', name: 'ICU Bed 02', floor: 'Floor 2', zone: 'Zone-B', type: 'ICU', departmentId: deptMap.get('ICU') },
      { code: 'OT-SUITE-1', name: 'Main OT Suite 1', floor: 'Floor 3', zone: 'Zone-A', type: 'OT', departmentId: deptMap.get('OT') },
      { code: 'OT-SUITE-2', name: 'Main OT Suite 2', floor: 'Floor 3', zone: 'Zone-B', type: 'OT', departmentId: deptMap.get('OT') },
      { code: 'WARD-302', name: 'General Ward Room 302', floor: 'Floor 3', zone: 'Zone-C', type: 'WARD', departmentId: deptMap.get('WARD') },
      { code: 'WARD-401', name: 'General Ward Room 401', floor: 'Floor 4', zone: 'Zone-A', type: 'WARD', departmentId: deptMap.get('WARD') },
      { code: 'PHARM-CTR-1', name: 'IPD Pharmacy Counter', floor: 'Floor 1', zone: 'Zone-B', type: 'ROOM', departmentId: deptMap.get('PHARMACY') },
      { code: 'RAD-CT-1', name: 'CT Scan Suite 1', floor: 'Floor 1', zone: 'Zone-C', type: 'ROOM', departmentId: deptMap.get('RADIOLOGY') },
      { code: 'LAB-PHLEBO-1', name: 'Phlebotomy / Accessioning', floor: 'Floor 4', zone: 'Zone-B', type: 'LAB', departmentId: deptMap.get('LAB') },
      { code: 'QUALITY-OFFICE', name: 'Quality & Patient Safety Office', floor: 'Floor 5', zone: 'Zone-C', type: 'OTHER', departmentId: deptMap.get('QUALITY') },
    ];

    // Real hospital ward master (docs/ward.xlsx). These are their own Location
    // records with no floor/zone — an inpatient incident "in the ward" only needs
    // the ward itself; floor/zone is only asked when it happened elsewhere.
    const wardLocationsData = [
      { code: 'AMW', name: 'ADMITTING WARD', type: 'WARD' },
      { code: 'AICUW', name: 'ANESTHESIA INTENSIVE CARE UNIT - (UNSCREEN WARD)', type: 'WARD' },
      { code: 'CICUW', name: 'CARDIAC INTENSIVE CARE UNIT', type: 'WARD' },
      { code: 'CSW', name: 'CARDIOLOGY SPECIALITY WARD', type: 'WARD' },
      { code: 'CLW', name: 'CATH LAB WARD', type: 'WARD' },
      { code: 'CDW', name: 'CRADLE WARD', type: 'WARD' },
      { code: 'CTVSW', name: 'CTVS INTENSIVE CARE UNIT', type: 'WARD' },
      { code: 'DYW', name: 'DIALYSIS WARD', type: 'WARD' },
      { code: 'FEW', name: 'FEMALE ENT WARD', type: 'WARD' },
      { code: 'FMW', name: 'FEMALE MEDICAL WARD', type: 'WARD' },
      { code: 'FOPW', name: 'FEMALE OPHTHAL WARD', type: 'WARD' },
      { code: 'FOW', name: 'FEMALE ORTHO WARD', type: 'WARD' },
      { code: 'FPW', name: 'FEMALE PSYCHIATRY WARD', type: 'WARD' },
      { code: 'FSSW', name: 'FEMALE SKIN & STD WARD', type: 'WARD' },
      { code: 'FSSPW', name: 'FEMALE SUPER SPECIALITY', type: 'WARD' },
      { code: 'FSW', name: 'FEMALE SURGICAL WARD', type: 'WARD' },
      { code: 'FTCW', name: 'FEMALE TB & CHEST WARD', type: 'WARD' },
      { code: 'GNW', name: 'GYNAECOLOGY WARD', type: 'WARD' },
      { code: 'MEW', name: 'MALE ENT WARD', type: 'WARD' },
      { code: 'MMW', name: 'MALE MEDICAL WARD', type: 'WARD' },
      { code: 'MOPW', name: 'MALE OPHTHAL WARD', type: 'WARD' },
      { code: 'MOW', name: 'MALE ORTHO WARD', type: 'WARD' },
      { code: 'MPW', name: 'MALE PSYCHIATRY WARD', type: 'WARD' },
      { code: 'MSSW', name: 'MALE SKIN & STD WARD', type: 'WARD' },
      { code: 'MSSPW', name: 'MALE SUPER SPECIALITY', type: 'WARD' },
      { code: 'MSW', name: 'MALE SURGICAL WARD', type: 'WARD' },
      { code: 'MTCW', name: 'MALE TB & CHEST WARD', type: 'WARD' },
      { code: 'MTICU', name: 'MATERNITY INTENSIVE CARE UNIT', type: 'WARD' },
      { code: 'MICU', name: 'MEDICAL INTENSIVE CARE UNIT', type: 'WARD' },
      { code: 'NEON', name: 'NEONATOL INTENSIVE CARE UNIT', type: 'WARD' },
      { code: 'OBSW', name: 'OBS WARD', type: 'WARD' },
      { code: 'OTC', name: 'OT COMPLEX', type: 'WARD' },
      { code: 'OTCW', name: 'OT COMPLEX WARD', type: 'WARD' },
      { code: 'PICU', name: 'PAEDIATRIC INTENSIVE CARE UNIT', type: 'WARD' },
      { code: 'PTW', name: 'PAEDIATRIC WARD', type: 'WARD' },
      { code: 'PACUW', name: 'POST ANAESTHESIA CARE UNIT', type: 'WARD' },
      { code: 'RTICU', name: 'RENAL TRANSPLANT ICU', type: 'WARD' },
      { code: 'RICU', name: 'RESPIRATORY INTENSIVE CARE UNIT', type: 'WARD' },
      { code: 'SPW', name: 'SPECIAL WARD', type: 'WARD' },
      { code: 'SPW-SR', name: 'SPECIAL WARD - SHARING ROOM', type: 'WARD' },
      { code: 'SRW', name: 'SUITE ROOM WARD', type: 'WARD' },
      { code: 'SICU', name: 'SURGICAL INTENSIVE CARE UNIT', type: 'WARD' },
      { code: 'TICU1', name: 'TRAUMA INTENSIVE CARE UNIT - I', type: 'WARD' },
      { code: 'TICU2', name: 'TRAUMA INTENSIVE CARE UNIT - II', type: 'WARD' },
    ];

    const locationMap = new Map<string, mongoose.Types.ObjectId>();
    for (const l of [...locationsData, ...wardLocationsData]) {
      const loc = await Location.findOneAndUpdate({ code: l.code }, l, { upsert: true, new: true });
      locationMap.set(l.code, loc._id as mongoose.Types.ObjectId);
    }
    logger.info(
      `✅ Locations seeded (${locationsData.length} floor/zone locations + ${wardLocationsData.length} ward locations)`
    );

    // 4. Seed Incident Categories (48 Hospital Categories from docs/Hospital_Incident_Categories_and_Subcategories.md)
    const categoryMap = new Map<string, mongoose.Types.ObjectId>();
    for (let i = 0; i < HOSPITAL_CATEGORIES.length; i++) {
      const cat = HOSPITAL_CATEGORIES[i];
      const saved = await IncidentCategory.findOneAndUpdate(
        { code: cat.code },
        { ...cat, order: i + 1, active: true },
        { upsert: true, new: true }
      );
      categoryMap.set(cat.code, saved._id as mongoose.Types.ObjectId);
    }

    // Map legacy category codes used in seeders/dummy data to canonical category IDs
    const LEGACY_CATEGORY_ALIASES: Record<string, string> = {
      PATIENT_FALL: 'PATIENT_FALL_AND_ACCIDENTAL_INJURY',
      MEDICATION_SAFETY: 'MEDICATION_ERROR',
      CLINICAL_CARE_TREATMENT: 'DELAYED_OR_OMITTED_CARE',
      SURGERY_PROCEDURE: 'SURGERY_AND_INVASIVE_PROCEDURE',
      LABORATORY: 'LABORATORY_AND_PATHOLOGY',
      RADIOLOGY_IMAGING: 'RADIOLOGY_AND_IMAGING',
      MEDICATION_PHARMACY: 'STORES_SUPPLY_CHAIN_AND_COLD_CHAIN',
      BLOOD_TRANSFUSION: 'BLOOD_AND_BLOOD_PRODUCTS',
      MEDICAL_DEVICE_EQUIPMENT: 'BIOMEDICAL_EQUIPMENT',
      INFECTION_PREVENTION_CONTROL: 'HEALTHCARE_ASSOCIATED_INFECTION',
      COMMUNICATION_HANDOVER: 'HANDOVER_TRANSFER_AND_DISCHARGE',
      DOCUMENTATION_MEDICAL_RECORDS: 'REGISTRATION_MEDICAL_RECORDS_AND_CONSENT',
      FACILITY_ENVIRONMENTAL_SAFETY: 'BUILDING_AND_UTILITY_FAILURE',
      SECURITY_WORKPLACE_SAFETY: 'SECURITY_THEFT_AND_PROPERTY_DAMAGE',
      IT_SYSTEM_FAILURE: 'IT_AND_COMMUNICATION_DOWNTIME',
      PATIENT_VISITOR_COMPLAINT: 'SAFEGUARDING_AND_PATIENT_RIGHTS',
    };
    for (const [legacyCode, newCode] of Object.entries(LEGACY_CATEGORY_ALIASES)) {
      if (categoryMap.has(newCode) && !categoryMap.has(legacyCode)) {
        categoryMap.set(legacyCode, categoryMap.get(newCode)!);
      }
    }
    logger.info(`✅ Incident Categories seeded (${HOSPITAL_CATEGORIES.length} categories with 490+ subcategories)`);

    // 5. Seed Users — staff and an HOD in every department, Quality officers, Admins
    const passwords: Record<RoleCode, string> = {
      [ROLE_CODES.STAFF]: await hashPassword('Staff@123'),
      [ROLE_CODES.QUALITY]: await hashPassword('Quality@123'),
      [ROLE_CODES.RCA_HEAD]: await hashPassword('Rca@123'),
      [ROLE_CODES.HOD]: await hashPassword('Hod@123'),
      [ROLE_CODES.ADMIN]: await hashPassword('Admin@123'),
      [ROLE_CODES.INTIMATION_MEMBER]: await hashPassword('Intimate@123'),
    };

    // [employeeId, name, email local part, username, department code, designation, role]
    const people: Array<[string, string, string, string, string | null, string, RoleCode]> = [
      ['EMP-001', 'System Administrator', 'admin', 'admin', null, 'IT Administrator', ROLE_CODES.ADMIN],
      ['EMP-005', 'Dr. Suresh Medical Director', 'suresh.md', 'md.director', null, 'Medical Director', ROLE_CODES.ADMIN],

      ['EMP-002', 'Dr. Anita Quality Head', 'anita.quality', 'quality.anita', 'QUALITY', 'Chief Quality Officer', ROLE_CODES.QUALITY],
      ['EMP-006', 'Mr. Ravi Patient Safety Officer', 'ravi.quality', 'quality.ravi', 'QUALITY', 'Patient Safety Officer', ROLE_CODES.QUALITY],
      ['EMP-024', 'Dr. Rajesh RCA Head', 'rajesh.rca', 'rca.head', 'QUALITY', 'RCA Head', ROLE_CODES.RCA_HEAD],
      ['EMP-025', 'Dr. Ananya RCA Head', 'ananya.rca', 'rca.ananya', 'QUALITY', 'RCA Committee Member', ROLE_CODES.RCA_HEAD],

      ['EMP-003', 'Dr. Ramesh Emergency HOD', 'ramesh.hod', 'hod.emergency', 'EMERGENCY', 'HOD Emergency', ROLE_CODES.HOD],
      ['EMP-009', 'Dr. Lakshmi ICU HOD', 'lakshmi.icu', 'hod.icu', 'ICU', 'HOD Intensive Care', ROLE_CODES.HOD],
      ['EMP-010', 'Dr. Venkat OT HOD', 'venkat.ot', 'hod.ot', 'OT', 'HOD Operation Theatre', ROLE_CODES.HOD],
      ['EMP-011', 'Dr. Meena Ward HOD', 'meena.ward', 'hod.ward', 'WARD', 'HOD Inpatient Wards', ROLE_CODES.HOD],
      ['EMP-017', 'Dr. Priya Pharmacy HOD', 'priya.pharmacy', 'hod.pharmacy', 'PHARMACY', 'HOD Pharmacy', ROLE_CODES.HOD],
      ['EMP-018', 'Dr. Arun Radiology HOD', 'arun.radiology', 'hod.radiology', 'RADIOLOGY', 'HOD Radiology & Imaging', ROLE_CODES.HOD],
      ['EMP-019', 'Dr. Kumar Laboratory HOD', 'kumar.lab', 'hod.lab', 'LAB', 'HOD Clinical Laboratory', ROLE_CODES.HOD],
      ['EMP-020', 'Dr. Deepa Quality HOD', 'deepa.quality', 'hod.quality', 'QUALITY', 'HOD Quality & Patient Safety', ROLE_CODES.HOD],

      ['EMP-004', 'Nurse Mary Staff', 'mary.staff', 'nurse.mary', 'EMERGENCY', 'Senior Staff Nurse', ROLE_CODES.STAFF],
      ['EMP-014', 'Nurse Kavitha ICU', 'kavitha.icu', 'nurse.kavitha', 'ICU', 'ICU Staff Nurse', ROLE_CODES.STAFF],
      ['EMP-015', 'Nurse John OT', 'john.ot', 'nurse.john', 'OT', 'OT Staff Nurse', ROLE_CODES.STAFF],
      ['EMP-021', 'Nurse Selvi Ward', 'selvi.ward', 'nurse.selvi', 'WARD', 'Ward Staff Nurse', ROLE_CODES.STAFF],
      ['EMP-012', 'Pharmacist Raj', 'raj.pharmacy', 'pharm.raj', 'PHARMACY', 'IPD Pharmacist', ROLE_CODES.STAFF],
      ['EMP-016', 'Radiographer Bala', 'bala.radiology', 'rad.bala', 'RADIOLOGY', 'CT Technologist', ROLE_CODES.STAFF],
      ['EMP-013', 'Tech Anitha Lab', 'anitha.lab', 'lab.anitha', 'LAB', 'Lab Technician', ROLE_CODES.STAFF],
      ['EMP-022', 'Nurse Divya IPC', 'divya.ipc', 'nurse.divya', 'QUALITY', 'Infection Control Nurse', ROLE_CODES.STAFF],

      ['EMP-023', 'Mr. Suresh Fire Safety Officer', 'suresh.firesafety', 'intimate.firesafety', null, 'Fire & Safety Officer', ROLE_CODES.INTIMATION_MEMBER],
    ];

    const userMap = new Map<string, mongoose.Types.ObjectId>();
    for (const [employeeId, name, emailLocal, username, deptCode, designation, role] of people) {
      const user = await User.findOneAndUpdate(
        { employeeId },
        {
          employeeId,
          name,
          email: `${emailLocal}@adhiparasakthi.hospital`,
          username,
          passwordHash: passwords[role],
          departmentId: deptCode ? deptMap.get(deptCode) : null,
          designation,
          roles: [roleIds.get(role)],
          status: 'ACTIVE',
        },
        { upsert: true, new: true }
      );
      userMap.set(username, user._id as mongoose.Types.ObjectId);
      if (role === ROLE_CODES.HOD && deptCode) {
        await Department.findByIdAndUpdate(deptMap.get(deptCode), { hodUserId: user._id });
      }
    }

    // Personas from earlier versions of the seed data
    const removedUsers = await User.deleteMany({
      $or: [
        { username: { $in: ['inv.priya', 'capa.arun', 'auditor.kumar', 'mgmt.director'] } },
        { employeeId: { $in: ['EMP-007', 'EMP-008'] } },
      ],
    });
    const extraRoles = await Role.find({ code: { $nin: allowedRoleCodes } });
    if (extraRoles.length) {
      const extraRoleIds = extraRoles.map((r) => r._id);
      await User.updateMany({ roles: { $in: extraRoleIds } }, { $pull: { roles: { $in: extraRoleIds } } });
      // Users left without a role can no longer sign in
      await User.updateMany({ roles: { $size: 0 } }, { $set: { status: 'INACTIVE' } });
    }
    const removedRoles = await Role.deleteMany({ code: { $nin: allowedRoleCodes } });
    logger.info(
      `✅ Users seeded (${people.length} personas across Staff / Quality / HOD / Admin; removed ${removedUsers.deletedCount} extra users, ${removedRoles.deletedCount} extra roles)`
    );

    // 6. Seed dummy incidents, investigations, RCA, CAPA, notifications
    await seedDummyOperationalData({ userMap, deptMap, locationMap, categoryMap });

    logger.info('🎉 Seeding completed successfully!');
  } catch (error) {
    logger.error({ err: error }, '❌ Seeding Error');
    throw error;
  }
};

// Allow executing script standalone via CLI
const isDirectRun =
  process.argv[1]?.includes('seeders') &&
  (process.argv[1].includes('index.ts') || process.argv[1].includes('index.js'));
if (isDirectRun) {
  seedDatabase()
    .then(async () => {
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async () => {
      await mongoose.disconnect();
      process.exit(1);
    });
}
