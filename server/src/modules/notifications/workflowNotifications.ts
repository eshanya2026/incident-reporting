import mongoose from 'mongoose';
import { IIncident, SEVERITY_LABELS } from '../incidents/incident.model.js';
import type { WorkflowAction } from '../incidents/incidentWorkflow.rules.js';
import type { JwtPayload } from '../auth/auth.utils.js';
import { notifyUsers, qualityUserIds, rcaHeadUserIds } from './notification.service.js';
import { sendWhatsapp, sendWhatsappTemplate, whatsappEnabled } from './whatsapp.js';
import { renderMessage, sessionMessageText, singleLine, TemplateValues, WhatsappTemplateKey } from './whatsappTemplates.js';
import { loadTemplate } from './whatsappTemplate.service.js';
import { User } from '../users/user.model.js';
import { Department } from '../departments/department.model.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

// Who is told about each workflow step (docs/FLOW_REWORK_PLAN.md, Phase 4).
// The person who performed the step is never notified.

type Recipient = 'QUALITY' | 'REPORTER' | 'HOD' | 'RCA_HEAD';
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
  REQUEST_RCA: [
    {
      to: 'RCA_HEAD',
      title: 'RCA requested by Quality',
      message: (i, t) => `Quality requested an RCA meeting on ${ref(i)}${withText(t)}`,
    },
  ],
  SUBMIT_RCA: [
    {
      to: 'QUALITY',
      title: 'RCA meeting report submitted',
      message: (i, t) => `The RCA Head submitted the meeting report for ${ref(i)}${withText(t)}`,
    },
  ],
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
        m.to === 'QUALITY'
          ? await qualityUserIds()
          : m.to === 'RCA_HEAD'
          ? incident.rcaHeadId
            ? [incident.rcaHeadId]
            : await rcaHeadUserIds()
          : m.to === 'REPORTER'
          ? [incident.reportedBy]
          : [hodOf(incident)].filter(Boolean);

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
        await notifyHodByWhatsapp(incident, text);

        const leadDept = incident.departmentId ? await Department.findById(incident.departmentId).select('name') : null;

        // Also notify HODs of additional involved departments for awareness
        if (incident.notifiedDepartmentIds && incident.notifiedDepartmentIds.length > 0) {
          const involvedDepts = await Department.find({ _id: { $in: incident.notifiedDepartmentIds } }).select('name hodUserId');
          const involvedHodIds = involvedDepts.map((d) => d.hodUserId).filter(Boolean) as mongoose.Types.ObjectId[];
          if (involvedHodIds.length > 0) {
            await notifyUsers({
              userIds: involvedHodIds,
              exceptUserId: actor.userId,
              type: 'INCIDENT_ASSIGN',
              title: 'Your department involved in safety report',
              message: `${ref(incident)} — marked as involved department${leadDept ? ` (Lead: ${leadDept.name})` : ''}.`,
              entityType: 'INCIDENT',
              entityId: incident._id as mongoose.Types.ObjectId,
            });
            await notifyInvolvedHodsByWhatsapp(incident, involvedDepts, actor.userId, leadDept?.name);
          }
        }

        // Also notify personnel who were intimated (CC'd) on this incident
        if (incident.intimatedUserIds && incident.intimatedUserIds.length > 0) {
          await notifyUsers({
            userIds: incident.intimatedUserIds,
            exceptUserId: actor.userId,
            type: 'INCIDENT_ASSIGN',
            title: 'Intimated on safety report (CC)',
            message: `${ref(incident)} — you have been intimated (CC)${leadDept ? ` (Lead: ${leadDept.name})` : ''}.`,
            entityType: 'INCIDENT',
            entityId: incident._id as mongoose.Types.ObjectId,
          });
          await notifyIntimatedUsersByWhatsapp(incident, actor.userId, leadDept?.name);
        }
      }

      if (m.to === 'REPORTER' && event === 'REQUEST_INFO') {
        await notifyReporterByWhatsapp(incident, text);
      }
    }
  } catch (error) {
    // Notifications must never fail the workflow action that triggered them
    logger.error({ err: error }, `❌ Notifications for ${event} failed`);
  }
};

/**
 * Sends the one generic WATI template (see docs/whatsapp-template.md) with the recipient's name,
 * this notification's content block and the link filled into its three parameters, when a template
 * is configured; otherwise falls back to a free-form session message (only deliverable within an
 * open 24h WhatsApp session — testing only).
 */
const sendWithTemplate = async (number: string, name: string, content: string, link: string, fallback: string): Promise<void> => {
  if (env.WATI_TEMPLATE_NAME) {
    // {{1}} name, {{2}} content block, {{3}} link — see docs/whatsapp-template.md.
    await sendWhatsappTemplate(number, env.WATI_TEMPLATE_NAME, [singleLine(name), content, singleLine(link)]);
    return;
  }
  await sendWhatsapp(number, fallback);
};

const incidentValues = (incident: IIncident): TemplateValues => ({
  incident: ref(incident),
  incidentNumber: incident.incidentNumber,
  incidentTitle: incident.title,
  severity: SEVERITY_LABELS[incident.severity] ?? `Severity ${incident.severity}`,
});

interface WhatsappRecipient {
  whatsappNumber: string;
  name: string;
  /** Values that differ per recipient (e.g. their own department). */
  values?: TemplateValues;
}

/**
 * Sends one of the editable WhatsApp messages (WhatsApp Messages screen, whatsappTemplates.ts) to
 * each recipient. Does nothing when that message has been switched off.
 */
const sendTemplated = async (
  key: WhatsappTemplateKey,
  incident: IIncident,
  recipients: WhatsappRecipient[],
  values: TemplateValues = {}
): Promise<void> => {
  if (!recipients.length) return;
  const template = await loadTemplate(key);
  if (!template.enabled) return;

  const link = `${env.APP_URL}/incidents/${incident._id}`;
  for (const r of recipients) {
    const rendered = renderMessage(template, { ...incidentValues(incident), ...values, ...r.values });
    await sendWithTemplate(r.whatsappNumber, r.name, rendered.content, link, sessionMessageText(rendered, link));
  }
};

/** WhatsApps the HOD on ASSIGN, so they hear about new work immediately. */
const notifyHodByWhatsapp = async (incident: IIncident, text?: string): Promise<void> => {
  if (!whatsappEnabled()) return;

  const hodId = hodOf(incident);
  if (!hodId) return;

  const hod = await User.findById(hodId).select('name whatsappNumber status');
  if (hod?.status !== 'ACTIVE' || !hod.whatsappNumber) return;

  const dept = incident.departmentId ? await Department.findById(incident.departmentId).select('name') : null;
  await sendTemplated('HOD_ASSIGNED', incident, [{ whatsappNumber: hod.whatsappNumber, name: hod.name }], {
    department: dept?.name,
    remarks: text?.trim(),
  });
};

/** WhatsApps the reporter when Quality asks a question, so they see it even if not in the app right then. */
const notifyReporterByWhatsapp = async (incident: IIncident, text?: string): Promise<void> => {
  if (!whatsappEnabled()) return;

  const reporter = await User.findById(incident.reportedBy).select('name whatsappNumber status');
  if (reporter?.status !== 'ACTIVE' || !reporter.whatsappNumber) return;

  await sendTemplated('REPORTER_INFO_REQUEST', incident, [{ whatsappNumber: reporter.whatsappNumber, name: reporter.name }], {
    question: text?.trim() || 'Please check the incident for details.',
  });
};

/** WhatsApps every active HOD of an additional involved department who has a WhatsApp number on file. */
const notifyInvolvedHodsByWhatsapp = async (
  incident: IIncident,
  involvedDepts: Array<{ _id: mongoose.Types.ObjectId; name: string; hodUserId?: mongoose.Types.ObjectId }>,
  actorUserId: string,
  leadDeptName?: string
): Promise<void> => {
  if (!whatsappEnabled()) return;

  const hodIds = involvedDepts.map((d) => d.hodUserId).filter(Boolean) as mongoose.Types.ObjectId[];
  if (hodIds.length === 0) return;

  const hods = await User.find({
    _id: { $in: hodIds, $ne: actorUserId },
    status: 'ACTIVE',
    whatsappNumber: { $exists: true, $ne: '' },
  }).select('name whatsappNumber');

  await sendTemplated(
    'INVOLVED_DEPARTMENT',
    incident,
    hods.map((hod) => ({
      whatsappNumber: hod.whatsappNumber!,
      name: hod.name,
      values: { department: involvedDepts.find((d) => String(d.hodUserId) === String(hod._id))?.name || 'your department' },
    })),
    { leadDepartment: leadDeptName }
  );
};

/** WhatsApps every intimated (CC'd) user who has a WhatsApp number on file, regardless of role. */
const notifyIntimatedUsersByWhatsapp = async (
  incident: IIncident,
  actorUserId: string,
  leadDeptName?: string
): Promise<void> => {
  if (!whatsappEnabled()) return;

  const members = await User.find({
    _id: { $in: incident.intimatedUserIds, $ne: actorUserId },
    status: 'ACTIVE',
    whatsappNumber: { $exists: true, $ne: '' },
  }).select('name whatsappNumber');

  await sendTemplated(
    'INTIMATED',
    incident,
    members.map((m) => ({ whatsappNumber: m.whatsappNumber!, name: m.name })),
    { leadDepartment: leadDeptName }
  );
};

const formatMeetingTime = (at: Date): string =>
  at.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * WhatsApps every attendee (HODs, Quality, the RCA Head) once the RCA meeting is scheduled — an
 * in-app notification is created for all attendees regardless of WhatsApp opt-in.
 */
export const notifyRcaMeetingScheduled = async (
  incident: IIncident,
  meeting: { meetingAt: Date; location: string; attendeeIds: mongoose.Types.ObjectId[] },
  actorUserId: string
): Promise<void> => {
  try {
    const title = 'RCA meeting scheduled';
    const when = formatMeetingTime(meeting.meetingAt);
    const message = `${ref(incident)} — ${when} at ${meeting.location}.`;

    await notifyUsers({
      userIds: meeting.attendeeIds,
      exceptUserId: actorUserId,
      type: 'RCA_MEETING_SCHEDULED',
      title,
      message,
      entityType: 'INCIDENT',
      entityId: incident._id as mongoose.Types.ObjectId,
    });

    if (!whatsappEnabled()) return;

    const attendees = await User.find({
      _id: { $in: meeting.attendeeIds, $ne: actorUserId },
      status: 'ACTIVE',
      whatsappNumber: { $exists: true, $ne: '' },
    }).select('name whatsappNumber');

    await sendTemplated(
      'RCA_MEETING_SCHEDULED',
      incident,
      attendees.map((a) => ({ whatsappNumber: a.whatsappNumber!, name: a.name })),
      { meetingTime: when, meetingPlace: meeting.location }
    );
  } catch (error) {
    logger.error({ err: error }, '❌ RCA meeting notifications failed');
  }
};
