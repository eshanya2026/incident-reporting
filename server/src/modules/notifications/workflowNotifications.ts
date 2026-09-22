import mongoose from 'mongoose';
import { IIncident, SEVERITY_LABELS } from '../incidents/incident.model.js';
import type { WorkflowAction } from '../incidents/incidentWorkflow.rules.js';
import type { JwtPayload } from '../auth/auth.utils.js';
import { notifyUsers, qualityUserIds } from './notification.service.js';
import { sendWhatsapp, sendWhatsappTemplate, whatsappEnabled } from './whatsapp.js';
import { User } from '../users/user.model.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

// Who is told about each workflow step (docs/FLOW_REWORK_PLAN.md, Phase 4).
// The person who performed the step is never notified.

type Recipient = 'QUALITY' | 'REPORTER' | 'HOD';
type NotificationEvent = WorkflowAction | 'SUBMITTED';

interface Message {
  to: Recipient;
  title: string;
  message: (incident: IIncident, text?: string) => string;
}

const ref = (i: IIncident) => `${i.incidentNumber} "${i.title}"`;
const withText = (text?: string) => (text ? `: ${text}` : '.');

const MESSAGES: Partial<Record<NotificationEvent, Message[]>> = {
  SUBMITTED: [{ to: 'QUALITY', title: 'New incident to triage', message: (i) => `${ref(i)} was reported and is waiting in the triage inbox.` }],
  RESPOND_INFO: [{ to: 'QUALITY', title: 'Reporter answered your question', message: (i, t) => `${ref(i)} is back in the triage inbox${withText(t)}` }],
  REQUEST_INFO: [{ to: 'REPORTER', title: 'Quality needs more information', message: (i, t) => `About your report ${ref(i)}${withText(t)}` }],
  REJECT: [{ to: 'REPORTER', title: 'Your report was not accepted', message: (i, t) => `Quality rejected ${ref(i)}${withText(t)}` }],
  ASSIGN: [
    {
      to: 'HOD',
      title: 'New incident assigned to your department',
      message: (i, t) => `${ref(i)} — ${SEVERITY_LABELS[i.severity] ?? `severity ${i.severity}`}. Please start the investigation${t ? `. Quality's remarks: ${t}` : '.'}`,
    },
  ],
  RETURN_TO_QUALITY: [{ to: 'QUALITY', title: 'Incident returned by HOD', message: (i, t) => `${ref(i)} needs to be reassigned${withText(t)}` }],
  SUBMIT_CLOSURE: [{ to: 'QUALITY', title: 'Incident ready for review', message: (i) => `The HOD submitted ${ref(i)} for your review.` }],
  REVIEW_RETURN: [{ to: 'HOD', title: 'Quality sent an incident back', message: (i, t) => `${ref(i)} needs more work${withText(t)}` }],
  REVIEW_ACCEPT: [
    { to: 'REPORTER', title: 'Your report has been closed', message: (i, t) => `${ref(i)} was reviewed and closed${withText(t)}` },
    { to: 'HOD', title: 'Incident closed by Quality', message: (i) => `Quality accepted the CAPA and closed ${ref(i)}.` },
  ],
};

/**
 * HOD to notify. After RETURN_TO_QUALITY the incident has no HOD; for other events it is the
 * department's HOD at assignment time (kept on the incident).
 */
const hodOf = (incident: IIncident): mongoose.Types.ObjectId | undefined => incident.assignedHod as any;

export const notifyWorkflowEvent = async (
  event: NotificationEvent,
  incident: IIncident,
  actor: JwtPayload,
  text?: string
): Promise<void> => {
  const messages = MESSAGES[event];
  if (!messages) return;

  try {
    for (const m of messages) {
      const userIds =
        m.to === 'QUALITY' ? await qualityUserIds() : m.to === 'REPORTER' ? [incident.reportedBy] : [hodOf(incident)].filter(Boolean);

      await notifyUsers({
        userIds: userIds as mongoose.Types.ObjectId[],
        exceptUserId: actor.userId,
        type: `INCIDENT_${event}`,
        title: m.title,
        message: m.message(incident, text),
        entityType: 'INCIDENT',
        entityId: incident._id as mongoose.Types.ObjectId,
      });

      if (m.to === 'HOD' && event === 'ASSIGN') {
        await notifyHodByWhatsapp(incident, m, text);
      }
    }
  } catch (error) {
    // Notifications must never fail the workflow action that triggered them
    logger.error({ err: error }, `❌ Notifications for ${event} failed`);
  }
};

/** WhatsApp is only wired up for the ASSIGN event, so the HOD hears about new work immediately. */
const notifyHodByWhatsapp = async (incident: IIncident, m: Message, text?: string): Promise<void> => {
  if (!whatsappEnabled()) return;

  const hodId = hodOf(incident);
  if (!hodId) return;

  const hod = await User.findById(hodId).select('name whatsappNumber status');
  if (hod?.status !== 'ACTIVE' || !hod.whatsappNumber) return;

  const link = `${env.APP_URL}/incidents/${incident._id}`;

  if (env.WATI_TEMPLATE_NAME) {
    // Uses the "incident_assigned_hod" template (docs/whatsapp-template.md): {{1}} name,
    // {{2}} incident ref, {{3}} severity, {{4}} remarks, {{5}} direct incident link.
    const severity = SEVERITY_LABELS[incident.severity] ?? `Severity ${incident.severity}`;
    const remarks = text?.trim() || 'Please review promptly.';
    await sendWhatsappTemplate(hod.whatsappNumber, [hod.name, ref(incident), severity, remarks, link]);
    return;
  }

  await sendWhatsapp(hod.whatsappNumber, `*${m.title}*\n${m.message(incident, text)}\n\nOpen: ${link}`);
};
