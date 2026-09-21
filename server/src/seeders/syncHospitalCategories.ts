/**
 * Sync Hospital Categories & Subcategories into Database
 * Populates or updates the complete 48 clinical and operational categories
 * from docs/Hospital_Incident_Categories_and_Subcategories.md.
 *
 * Usage:
 *   npx tsx src/seeders/syncHospitalCategories.ts
 */

import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { IncidentCategory } from '../modules/categories/category.model.js';
import { HOSPITAL_CATEGORIES } from './hospitalCategoriesData.js';

const LEGACY_CODE_MAP: Record<string, string> = {
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

export const syncCategories = async (): Promise<void> => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(env.MONGO_URI);
  }

  console.log('🔄 Syncing hospital categories and subcategories into database...');

  let createdCount = 0;
  let updatedCount = 0;
  let totalSubcategories = 0;

  for (const cat of HOSPITAL_CATEGORIES) {
    totalSubcategories += cat.subcategories.length;

    // Check if category exists by code, by name, or by legacy code mapping
    const legacyCode = Object.keys(LEGACY_CODE_MAP).find((k) => LEGACY_CODE_MAP[k] === cat.code);
    const existing = await IncidentCategory.findOne({
      $or: [
        { code: cat.code },
        { name: { $regex: new RegExp(`^${cat.name}$`, 'i') } },
        ...(legacyCode ? [{ code: legacyCode }] : []),
      ],
    });

    if (existing) {
      // Merge subcategories so existing subcategory codes remain active
      const existingSubMap = new Map(existing.subcategories.map((s) => [s.code, s]));
      const mergedSubs = [...cat.subcategories];

      // Preserve historical subcategories from database if not in new list
      for (const oldSub of existing.subcategories) {
        if (!mergedSubs.some((s) => s.code === oldSub.code)) {
          mergedSubs.push({
            code: oldSub.code,
            name: oldSub.name,
            active: oldSub.active,
          });
        }
      }

      existing.code = cat.code;
      existing.name = cat.name;
      existing.domain = cat.domain;
      existing.order = cat.order;
      existing.active = true;
      existing.subcategories = mergedSubs as any;
      await existing.save();
      updatedCount++;
    } else {
      await IncidentCategory.create({
        code: cat.code,
        name: cat.name,
        domain: cat.domain,
        order: cat.order,
        active: true,
        subcategories: cat.subcategories,
      });
      createdCount++;
    }
  }

  console.log(
    `✅ Hospital categories synchronized: ${createdCount} created, ${updatedCount} updated (${HOSPITAL_CATEGORIES.length} total categories, ${totalSubcategories} subcategories).`
  );
};

// Standalone execution
const isDirectRun = process.argv[1]?.includes('syncHospitalCategories');
if (isDirectRun) {
  syncCategories()
    .then(async () => {
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ Sync failed:', err);
      await mongoose.disconnect();
      process.exit(1);
    });
}
