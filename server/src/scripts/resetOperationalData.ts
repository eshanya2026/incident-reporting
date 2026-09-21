/**
 * Production Operational Data Purge Script
 * Implements Decision D10 of docs/FLOW_REWORK_PLAN.md.
 *
 * Clears all operational collections:
 *   - Incidents
 *   - Investigations
 *   - Root Cause Analyses (RCAs)
 *   - CAPAs
 *   - Notifications
 *   - Audit Logs
 *   - Sequence Counters (resets to 0 so live incidents start at INC-YYYY-0001)
 *
 * Strictly PRESERVES master data collections:
 *   - Roles (Staff, Quality, HOD, Admin)
 *   - Departments & HOD assignments
 *   - Locations
 *   - Incident Categories & Subcategories
 *   - User accounts
 *
 * Usage:
 *   npx tsx src/scripts/resetOperationalData.ts [--dry-run] [--force|-y]
 */

import readline from 'node:readline';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Incident } from '../modules/incidents/incident.model.js';
import { Investigation } from '../modules/investigations/investigation.model.js';
import { RootCauseAnalysis } from '../modules/rca/rca.model.js';
import { Capa } from '../modules/capa/capa.model.js';
import { Notification } from '../modules/notifications/notification.model.js';
import { AuditLog } from '../modules/audit/audit.model.js';
import { Counter } from '../common/models/counter.model.js';
import { Role } from '../modules/roles/role.model.js';
import { Department } from '../modules/departments/department.model.js';
import { Location } from '../modules/locations/location.model.js';
import { IncidentCategory } from '../modules/categories/category.model.js';
import { User } from '../modules/users/user.model.js';

interface ResetCounts {
  incidents: number;
  investigations: number;
  rcas: number;
  capas: number;
  notifications: number;
  auditLogs: number;
  counters: number;
}

interface MasterCounts {
  roles: number;
  departments: number;
  locations: number;
  categories: number;
  users: number;
}

const getOperationalCounts = async (): Promise<ResetCounts> => {
  const [incidents, investigations, rcas, capas, notifications, auditLogs, counters] = await Promise.all([
    Incident.countDocuments(),
    Investigation.countDocuments(),
    RootCauseAnalysis.countDocuments(),
    Capa.countDocuments(),
    Notification.countDocuments(),
    AuditLog.countDocuments(),
    Counter.countDocuments(),
  ]);
  return { incidents, investigations, rcas, capas, notifications, auditLogs, counters };
};

const getMasterCounts = async (): Promise<MasterCounts> => {
  const [roles, departments, locations, categories, users] = await Promise.all([
    Role.countDocuments(),
    Department.countDocuments(),
    Location.countDocuments(),
    IncidentCategory.countDocuments(),
    User.countDocuments(),
  ]);
  return { roles, departments, locations, categories, users };
};

const promptConfirmation = (question: string): Promise<boolean> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes');
    });
  });
};

export const resetOperationalData = async (options: { dryRun?: boolean; force?: boolean } = {}): Promise<void> => {
  const isDryRun = Boolean(options.dryRun);
  const isForce = Boolean(options.force);

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(env.MONGO_URI);
  }

  const safeUri = env.MONGO_URI.replace(/mongodb(\+srv)?:\/\/([^:]+):([^@]+)@/, 'mongodb$1://$2:****@');

  console.log('==================================================================');
  console.log('  Adhiparasakthi Hospitals - Operational Data Reset (D10)');
  console.log(`  Database: ${safeUri}`);
  console.log(`  Mode:     ${isDryRun ? 'DRY-RUN (Simulated)' : 'PRODUCTION RESET (Destructive)'}`);
  console.log('==================================================================\n');

  const beforeOperational = await getOperationalCounts();
  const masterData = await getMasterCounts();

  console.log('📊 Current Operational Records to be Cleared:');
  console.table([
    { Collection: 'incidents', Description: 'Incident Reports & Metadata', Count: beforeOperational.incidents },
    { Collection: 'investigations', Description: 'HOD Investigation Records', Count: beforeOperational.investigations },
    { Collection: 'rootcauseanalyses', Description: '5-Why & Fishbone RCAs', Count: beforeOperational.rcas },
    { Collection: 'capas', Description: 'Corrective & Preventive Actions', Count: beforeOperational.capas },
    { Collection: 'notifications', Description: 'In-app & System Notifications', Count: beforeOperational.notifications },
    { Collection: 'auditlogs', Description: 'Incident Lifecycle Audit Logs', Count: beforeOperational.auditLogs },
    { Collection: 'counters', Description: 'Incident Sequence Counters', Count: beforeOperational.counters },
  ]);

  console.log('\n🔒 Master Data to be STRICTLY PRESERVED:');
  console.table([
    { Collection: 'roles', Description: 'System RBAC Roles', Count: masterData.roles },
    { Collection: 'departments', Description: 'Hospital Departments & HOD Mapping', Count: masterData.departments },
    { Collection: 'locations', Description: 'Wards, Rooms, OTs, ICUs', Count: masterData.locations },
    { Collection: 'incidentcategories', Description: 'Standard Incident Categories', Count: masterData.categories },
    { Collection: 'users', Description: 'Staff, HODs, Quality, Admin Users', Count: masterData.users },
  ]);

  const totalToPurge = Object.values(beforeOperational).reduce((a, b) => a + b, 0);

  if (isDryRun) {
    console.log(`\n🔍 [DRY RUN] Would purge ${totalToPurge} operational records.`);
    console.log('   Master data remains intact. No changes were applied.');
    return;
  }

  if (totalToPurge === 0) {
    console.log('\n✨ Database is already clean. No operational records found.');
    return;
  }

  if (!isForce) {
    console.log(`\n⚠️  WARNING: You are about to permanently delete ${totalToPurge} operational records.`);
    console.log('   This action CANNOT be undone. Ensure you have created a backup first.');
    const confirmed = await promptConfirmation('\nType "y" to confirm and execute the reset: ');
    if (!confirmed) {
      console.log('❌ Reset cancelled by user.');
      return;
    }
  }

  console.log('\n🧹 Purging operational collections...');

  const [delInc, delInv, delRca, delCapa, delNotif, delAudit, delCounter] = await Promise.all([
    Incident.deleteMany({}),
    Investigation.deleteMany({}),
    RootCauseAnalysis.deleteMany({}),
    Capa.deleteMany({}),
    Notification.deleteMany({}),
    AuditLog.deleteMany({}),
    Counter.deleteMany({}),
  ]);

  console.log(`   Deleted ${delInc.deletedCount} incidents`);
  console.log(`   Deleted ${delInv.deletedCount} investigations`);
  console.log(`   Deleted ${delRca.deletedCount} root cause analyses`);
  console.log(`   Deleted ${delCapa.deletedCount} CAPA items`);
  console.log(`   Deleted ${delNotif.deletedCount} notifications`);
  console.log(`   Deleted ${delAudit.deletedCount} audit logs`);
  console.log(`   Reset ${delCounter.deletedCount} sequence counters`);

  const afterOperational = await getOperationalCounts();
  const afterMaster = await getMasterCounts();

  console.log('\n✅ Operational data reset complete!');
  console.log('   Remaining operational records: 0');
  console.log(`   Preserved master records: ${afterMaster.users} users, ${afterMaster.departments} departments, ${afterMaster.locations} locations.`);
  console.log('   The system is now primed for live production operations starting at INC-YYYY-0001.\n');
};

// Direct script execution
const isDirectRun = process.argv[1]?.includes('resetOperationalData');
if (isDirectRun) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force') || args.includes('-y');

  resetOperationalData({ dryRun, force })
    .then(async () => {
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ Reset failed:', err);
      await mongoose.disconnect();
      process.exit(1);
    });
}
