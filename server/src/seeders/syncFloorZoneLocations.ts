import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Location } from '../modules/locations/location.model.js';
import { Department } from '../modules/departments/department.model.js';
import { Incident } from '../modules/incidents/incident.model.js';
import { logger } from '../config/logger.js';

// This project compiles to CommonJS (see server/tsconfig.json + no "type": "module" in
// package.json), so `import.meta.url` is not available — resolve relative to cwd instead,
// the same convention config/env.ts uses.
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/incident_db';

export const CORE_FLOOR_ZONE_LOCATIONS = [
  // Floor 1
  { code: 'FL1-Z1', name: 'Floor 1 - Zone-1', floor: 'Floor 1', zone: 'Zone-1', type: 'ROOM' },
  { code: 'FL1-ZB', name: 'Floor 1 - Zone-B', floor: 'Floor 1', zone: 'Zone-B', type: 'ROOM' },
  { code: 'FL1-ZC', name: 'Floor 1 - Zone-C', floor: 'Floor 1', zone: 'Zone-C', type: 'ROOM' },

  // Floor 2
  { code: 'FL2-Z1', name: 'Floor 2 - Zone-1', floor: 'Floor 2', zone: 'Zone-1', type: 'ICU' },
  { code: 'FL2-ZB', name: 'Floor 2 - Zone-B', floor: 'Floor 2', zone: 'Zone-B', type: 'ICU' },
  { code: 'FL2-ZC', name: 'Floor 2 - Zone-C', floor: 'Floor 2', zone: 'Zone-C', type: 'ROOM' },

  // Floor 3
  { code: 'FL3-Z1', name: 'Floor 3 - Zone-1', floor: 'Floor 3', zone: 'Zone-1', type: 'OT' },
  { code: 'FL3-ZB', name: 'Floor 3 - Zone-B', floor: 'Floor 3', zone: 'Zone-B', type: 'OT' },
  { code: 'FL3-ZC', name: 'Floor 3 - Zone-C', floor: 'Floor 3', zone: 'Zone-C', type: 'WARD' },

  // Floor 4
  { code: 'FL4-Z1', name: 'Floor 4 - Zone-1', floor: 'Floor 4', zone: 'Zone-1', type: 'WARD' },
  { code: 'FL4-ZB', name: 'Floor 4 - Zone-B', floor: 'Floor 4', zone: 'Zone-B', type: 'LAB' },
  { code: 'FL4-ZC', name: 'Floor 4 - Zone-C', floor: 'Floor 4', zone: 'Zone-C', type: 'WARD' },

  // Floor 5
  { code: 'FL5-Z1', name: 'Floor 5 - Zone-1', floor: 'Floor 5', zone: 'Zone-1', type: 'ROOM' },
  { code: 'FL5-ZB', name: 'Floor 5 - Zone-B', floor: 'Floor 5', zone: 'Zone-B', type: 'OTHER' },
  { code: 'FL5-ZC', name: 'Floor 5 - Zone-C', floor: 'Floor 5', zone: 'Zone-C', type: 'OTHER' },
];

export const EXISTING_LOCATION_MAPPINGS: Record<string, { floor: string; zone: string; deptCode?: string }> = {
  'ER-BAY-1': { floor: 'Floor 1', zone: 'Zone-1', deptCode: 'EMERGENCY' },
  'ER-BAY-2': { floor: 'Floor 1', zone: 'Zone-1', deptCode: 'EMERGENCY' },
  'PHARM-CTR-1': { floor: 'Floor 1', zone: 'Zone-B', deptCode: 'PHARMACY' },
  'RAD-CT-1': { floor: 'Floor 1', zone: 'Zone-C', deptCode: 'RADIOLOGY' },
  'ICU-BED-01': { floor: 'Floor 2', zone: 'Zone-1', deptCode: 'ICU' },
  'ICU-BED-02': { floor: 'Floor 2', zone: 'Zone-B', deptCode: 'ICU' },
  'OT-SUITE-1': { floor: 'Floor 3', zone: 'Zone-1', deptCode: 'OT' },
  'OT-SUITE-2': { floor: 'Floor 3', zone: 'Zone-B', deptCode: 'OT' },
  'WARD-302': { floor: 'Floor 3', zone: 'Zone-C', deptCode: 'WARD' },
  'WARD-401': { floor: 'Floor 4', zone: 'Zone-1', deptCode: 'WARD' },
  'LAB-PHLEBO-1': { floor: 'Floor 4', zone: 'Zone-B', deptCode: 'LAB' },
  'QUALITY-OFFICE': { floor: 'Floor 5', zone: 'Zone-C', deptCode: 'QUALITY' },
};

export async function syncFloorZoneLocations() {
  await mongoose.connect(MONGO_URI);
  logger.info('Connected to MongoDB for Floor/Zone synchronization...');

  const departments = await Department.find();
  const deptMap = new Map<string, mongoose.Types.ObjectId>();
  departments.forEach((d) => deptMap.set(d.code, d._id as mongoose.Types.ObjectId));

  // 1. Upsert the 15 standard Floor-Zone locations
  let createdCount = 0;
  let updatedCount = 0;
  for (const locDef of CORE_FLOOR_ZONE_LOCATIONS) {
    const existing = await Location.findOne({ code: locDef.code });
    if (!existing) {
      await Location.create({
        ...locDef,
        active: true,
      });
      createdCount++;
    } else {
      existing.name = locDef.name;
      existing.floor = locDef.floor;
      existing.zone = locDef.zone;
      existing.type = locDef.type as any;
      await existing.save();
      updatedCount++;
    }
  }
  logger.info(`✅ Core Floor-Zone Locations: ${createdCount} created, ${updatedCount} updated.`);

  // 2. Update existing clinical locations with floor and zone
  let clinicalUpdated = 0;
  for (const [code, meta] of Object.entries(EXISTING_LOCATION_MAPPINGS)) {
    const loc = await Location.findOne({ code });
    if (loc) {
      loc.floor = meta.floor;
      loc.zone = meta.zone;
      if (meta.deptCode && deptMap.has(meta.deptCode)) {
        loc.departmentId = deptMap.get(meta.deptCode);
      }
      await loc.save();
      clinicalUpdated++;
    }
  }
  logger.info(`✅ Existing clinical locations updated with floor/zone: ${clinicalUpdated}`);

  // 3. Backfill existing Incidents with floor and zone from their locationId
  const incidents = await Incident.find({ $or: [{ floor: { $exists: false } }, { floor: null }] }).populate('locationId');
  let incidentsUpdated = 0;
  for (const inc of incidents) {
    const loc = inc.locationId as any;
    if (loc && loc.floor && loc.zone) {
      inc.floor = loc.floor;
      inc.zone = loc.zone;
      await inc.save();
      incidentsUpdated++;
    }
  }
  logger.info(`✅ Backfilled ${incidentsUpdated} incidents with floor and zone metadata.`);

  await mongoose.disconnect();
  logger.info('MongoDB disconnected.');
}

const isDirectRun = process.argv[1]?.includes('syncFloorZoneLocations');
if (isDirectRun) {
  syncFloorZoneLocations()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('Error syncing locations:', err);
      process.exit(1);
    });
}
