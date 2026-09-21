import mongoose from 'mongoose';
import { Capa } from './capa.model.js';
import { Incident } from '../incidents/incident.model.js';
import { Department } from '../departments/department.model.js';
import { notifyUsers, qualityUserIds } from '../notifications/notification.service.js';
import { logger } from '../../config/logger.js';
import { env } from '../../config/env.js';

const CHECK_EVERY_MS = 60 * 60 * 1000; // hourly; each CAPA is reported once per target date

/**
 * Tells the responsible HOD and Quality when an open CAPA passes its target date.
 * A CAPA is reported once; changing its target date makes it eligible again.
 */
export const notifyOverdueCapas = async (now = new Date()): Promise<number> => {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const overdue = await Capa.find({
    status: 'OPEN',
    targetDate: { $lt: startOfToday },
    overdueNotifiedAt: { $exists: false },
  }).limit(500);
  if (overdue.length === 0) return 0;

  const quality = await qualityUserIds();
  let notified = 0;
  for (const capa of overdue) {
    // Claim the CAPA first so two server instances cannot both notify it
    const claimed = await Capa.updateOne(
      { _id: capa._id, overdueNotifiedAt: { $exists: false } },
      { $set: { overdueNotifiedAt: now } }
    );
    if (claimed.modifiedCount === 0) continue;

    const incident = await Incident.findById(capa.incidentId).select('incidentNumber title assignedHod departmentId status');
    if (!incident || incident.status !== 'CAPA_IN_PROGRESS') continue;

    // The department's current HOD, falling back to the HOD it was assigned to
    const dept = incident.departmentId ? await Department.findById(incident.departmentId).select('hodUserId') : null;
    const hod = dept?.hodUserId ?? incident.assignedHod;
    const due = capa.targetDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    await notifyUsers({
      userIds: [hod, ...quality].filter(Boolean) as mongoose.Types.ObjectId[],
      type: 'CAPA_OVERDUE',
      title: 'CAPA overdue',
      message: `${capa.capaNumber} for ${incident.incidentNumber} "${incident.title}" was due on ${due} and is not marked done.`,
      entityType: 'INCIDENT',
      entityId: incident._id as mongoose.Types.ObjectId,
      link: `${env.APP_URL}/incidents/${incident._id}`,
    });
    notified += 1;
  }
  return notified;
};

/** Runs the overdue check now and then hourly. Returns a function that stops it. */
export const startCapaOverdueScheduler = (): (() => void) => {
  const run = () =>
    notifyOverdueCapas()
      .then((n) => n > 0 && logger.info(`⏰ Overdue CAPA notifications sent for ${n} action(s)`))
      .catch((error) => logger.error({ err: error }, '❌ Overdue CAPA check failed'));
  void run();
  const timer = setInterval(run, CHECK_EVERY_MS);
  timer.unref();
  return () => clearInterval(timer);
};
