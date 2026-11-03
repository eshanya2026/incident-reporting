import mongoose from 'mongoose';
import { logger } from '../config/logger.js';
import { migrateWorkflowV2, removeReopening } from './workflowV2.js';
import { makeEmailOptional } from '../modules/users/user.model.js';

// One-off data migrations, applied in order at server start (and by the seeder).
// Each runs once; applied names are recorded in the `migrations` collection.
// Migrations must also be safe to re-run (idempotent) in case recording fails.
const MIGRATIONS: Array<{ name: string; run: () => Promise<string> }> = [
  { name: '2026-09-19-workflow-v2', run: migrateWorkflowV2 },
  { name: '2026-09-19-no-reopen', run: removeReopening },
  { name: '2026-11-02-optional-email', run: makeEmailOptional },
];

export const runMigrations = async (): Promise<void> => {
  const collection = mongoose.connection.collection('migrations');
  for (const migration of MIGRATIONS) {
    if (await collection.findOne({ name: migration.name })) continue;
    const summary = await migration.run();
    await collection.insertOne({ name: migration.name, appliedAt: new Date(), summary });
    logger.info(`🔁 Migration ${migration.name} applied: ${summary}`);
  }
};
