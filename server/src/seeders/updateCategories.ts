import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { IncidentCategory } from '../modules/categories/category.model.js';
import { Incident } from '../modules/incidents/incident.model.js';

export const categoriesTaxonomy = [
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

export async function updateCategories() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(env.MONGO_URI);
  }

  logger.info('Updating 18 categories and subcategories in database...');

  // Map of old codes to new codes if applicable for smooth migration of existing incidents
  const oldToNewCodeMap: Record<string, string> = {
    'PATIENT_SAFETY': 'PATIENT_FALL',
    'MEDICATION': 'MEDICATION_SAFETY',
    'INFECTION_CONTROL': 'INFECTION_PREVENTION_CONTROL',
    'FACILITY_EQUIPMENT': 'FACILITY_ENVIRONMENTAL_SAFETY',
    'CLINICAL_PROCESS': 'CLINICAL_CARE_TREATMENT',
    'BEHAVIORAL': 'SECURITY_WORKPLACE_SAFETY',
    'OCCUPATIONAL_HEALTH': 'SECURITY_WORKPLACE_SAFETY',
    'INFO_SECURITY': 'IT_SYSTEM_FAILURE',
  };

  // Upsert the 18 categories with explicit order
  for (let i = 0; i < categoriesTaxonomy.length; i++) {
    const cat = categoriesTaxonomy[i];
    await IncidentCategory.findOneAndUpdate(
      { code: cat.code },
      {
        code: cat.code,
        name: cat.name,
        order: i + 1,
        active: true,
        subcategories: cat.subcategories,
      },
      { upsert: true, new: true }
    );
  }

  // Deactivate old legacy codes if not in the new 18
  const validCodes = categoriesTaxonomy.map((c) => c.code);
  const legacyCategories = await IncidentCategory.find({ code: { $nin: validCodes } });
  
  for (const leg of legacyCategories) {
    const targetCode = oldToNewCodeMap[leg.code] || 'OTHER';
    const targetCat = await IncidentCategory.findOne({ code: targetCode });

    if (targetCat) {
      // Re-assign any incidents pointing to the legacy category
      const affectedIncidents = await Incident.updateMany(
        { categoryId: leg._id },
        { categoryId: targetCat._id }
      );
      if (affectedIncidents.modifiedCount > 0) {
        logger.info(`Migrated ${affectedIncidents.modifiedCount} incidents from ${leg.code} to ${targetCode}`);
      }
    }

    // Set legacy category to inactive so it won't appear in dropdowns
    await IncidentCategory.findByIdAndUpdate(leg._id, { active: false });
    logger.info(`Deactivated legacy category: ${leg.code} (${leg.name})`);
  }

  const activeCount = await IncidentCategory.countDocuments({ active: true });
  logger.info(`✅ Successfully updated categories. Active categories in DB: ${activeCount}`);
}

if (process.argv[1]?.includes('updateCategories')) {
  updateCategories().then(() => {
    logger.info('Category update script finished.');
    process.exit(0);
  }).catch((err) => {
    logger.error({ err }, 'Failed to update categories');
    process.exit(1);
  });
}
