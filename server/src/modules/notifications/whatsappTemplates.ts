// Editable wording of the WhatsApp notifications.
//
// WATI only lets us send one pre-approved template (docs/whatsapp-template.md). Its fixed wrapper
// ("Hello {{1}}, … {{2}} … {{3}} … Thank you…") can only be changed by re-approving it in WATI, but
// everything inside {{2}} is built here — so the title, message and detail lines of every
// notification can be edited from the app (WhatsApp Messages screen) with no new approval.
//
// This file is pure: definitions, defaults, validation and rendering. Loading the saved wording
// lives in whatsappTemplate.service.ts.

export type WhatsappTemplateKey = 'HOD_ASSIGNED' | 'REPORTER_INFO_REQUEST' | 'INVOLVED_DEPARTMENT' | 'INTIMATED' | 'RCA_MEETING_SCHEDULED';

export interface TemplateVariable {
  key: string;
  label: string;
  sample: string;
}

export interface TemplateContent {
  title: string;
  message: string;
  details: string[];
}

export interface TemplateDefinition {
  key: WhatsappTemplateKey;
  name: string;
  sentTo: string;
  sentWhen: string;
  variables: TemplateVariable[];
  defaults: TemplateContent;
  sampleRecipient: string;
}

const INCIDENT_VARS: TemplateVariable[] = [
  { key: 'incident', label: 'Incident number and title', sample: 'INC-2026-000023 "Patient fall near bed 12"' },
  { key: 'incidentNumber', label: 'Incident number', sample: 'INC-2026-000023' },
  { key: 'incidentTitle', label: 'Incident title', sample: 'Patient fall near bed 12' },
  { key: 'severity', label: 'Severity', sample: 'Minor Harm (Level 2)' },
];

export const WHATSAPP_TEMPLATES: TemplateDefinition[] = [
  {
    key: 'HOD_ASSIGNED',
    name: 'Incident assigned to HOD',
    sentTo: 'HOD of the responsible department',
    sentWhen: 'Quality assigns an incident to a department',
    sampleRecipient: 'Dr. Ramesh',
    variables: [
      ...INCIDENT_VARS,
      { key: 'department', label: 'Department', sample: 'Emergency' },
      { key: 'remarks', label: "Quality's remarks", sample: 'Please check the CCTV footage as well.' },
    ],
    defaults: {
      title: 'New Incident Assigned',
      message: 'A new incident has been assigned to your department by Quality. Please review promptly.',
      details: ['Incident: {incident}', 'Severity: {severity}', "Quality's remarks: {remarks}"],
    },
  },
  {
    key: 'REPORTER_INFO_REQUEST',
    name: 'Quality asks the reporter a question',
    sentTo: 'Staff member who reported the incident',
    sentWhen: 'Quality asks for more information during triage',
    sampleRecipient: 'Nurse Mary',
    variables: [...INCIDENT_VARS, { key: 'question', label: "Quality's question", sample: 'Was the bed rail raised at the time of the fall?' }],
    defaults: {
      title: 'Quality Needs More Information',
      message: '{question}',
      details: ['Incident: {incident}'],
    },
  },
  {
    key: 'INVOLVED_DEPARTMENT',
    name: 'Department marked as involved',
    sentTo: 'HODs of the other involved departments',
    sentWhen: 'Quality assigns an incident and marks other departments as involved',
    sampleRecipient: 'Dr. Lakshmi',
    variables: [
      ...INCIDENT_VARS,
      { key: 'department', label: 'Their department', sample: 'ICU' },
      { key: 'leadDepartment', label: 'Lead department', sample: 'Emergency' },
    ],
    defaults: {
      title: 'Department Involved',
      message: 'Your department has been marked as involved in a safety report.',
      details: ['Incident: {incident}', 'Department: {department}', 'Lead department: {leadDepartment}'],
    },
  },
  {
    key: 'INTIMATED',
    name: 'Intimated (CC) on an incident',
    sentTo: 'People picked in "Intimate to"',
    sentWhen: 'Quality assigns an incident that has people intimated on it',
    sampleRecipient: 'Mr. Karthik',
    variables: [...INCIDENT_VARS, { key: 'leadDepartment', label: 'Lead department', sample: 'Emergency' }],
    defaults: {
      title: 'Intimated on Safety Report',
      message: "You have been intimated (CC'd) on a safety report.",
      details: ['Incident: {incident}', 'Lead department: {leadDepartment}'],
    },
  },
  {
    key: 'RCA_MEETING_SCHEDULED',
    name: 'RCA meeting scheduled',
    sentTo: 'Everyone invited to the RCA meeting',
    sentWhen: 'The RCA Head schedules an RCA meeting',
    sampleRecipient: 'Dr. Anita',
    variables: [
      ...INCIDENT_VARS,
      { key: 'meetingTime', label: 'Meeting date and time', sample: '05 Nov 2026, 11:00 am' },
      { key: 'meetingPlace', label: 'Meeting place', sample: 'Quality Conference Room' },
    ],
    defaults: {
      title: 'RCA Meeting Scheduled',
      message: 'An RCA meeting has been scheduled for this safety report.',
      details: ['Incident: {incident}', 'When: {meetingTime}', 'Where: {meetingPlace}'],
    },
  },
];

export const templateDefinition = (key: string): TemplateDefinition | undefined => WHATSAPP_TEMPLATES.find((t) => t.key === key);

// ---------- The approved WATI template (fixed — see docs/whatsapp-template.md) ----------

export const APPROVED_TEMPLATE = {
  header: 'Incident Reporting Alert',
  body: 'Hello {{1}},\n\n{{2}}\n\nPlease open the link below to view the full incident details and take any necessary action.\n\n{{3}}\n\nThank you for helping us maintain patient safety.',
  footer: 'Adhiparasakthi Hospitals',
};

// ---------- Limits ----------

export const LIMITS = { title: 80, message: 300, detailLine: 150, details: 6, content: 400 };

// Keeps {{2}} well clear of WhatsApp's 1024-char body cap, and the message readable, even if a
// free-text value (e.g. a reviewer's remarks) runs long.
const clamp = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

// WATI's send API rejects a template parameter containing newlines/tabs or 5+ consecutive spaces,
// so every value going into a parameter is flattened to one line.
export const singleLine = (text: string): string => text.replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim();

// ---------- Validation ----------

const PLACEHOLDER = /\{(\w+)\}/g;
const placeholdersIn = (text: string): string[] => [...text.matchAll(PLACEHOLDER)].map((m) => m[1]);

/** Problems with edited wording, as human-readable sentences (empty when it is fine). */
export const validateContent = (def: TemplateDefinition, content: TemplateContent): string[] => {
  const problems: string[] = [];
  const allowed = new Set(def.variables.map((v) => v.key));
  if (!content.title.trim()) problems.push('The title cannot be empty.');
  if (content.title.length > LIMITS.title) problems.push(`The title can be at most ${LIMITS.title} characters.`);
  if (!content.message.trim()) problems.push('The message cannot be empty.');
  if (content.message.length > LIMITS.message) problems.push(`The message can be at most ${LIMITS.message} characters.`);
  if (content.details.length > LIMITS.details) problems.push(`At most ${LIMITS.details} detail lines are allowed.`);
  content.details.forEach((line, i) => {
    if (line.length > LIMITS.detailLine) problems.push(`Detail line ${i + 1} can be at most ${LIMITS.detailLine} characters.`);
  });
  const unknown = [...new Set([content.title, content.message, ...content.details].flatMap(placeholdersIn))].filter((p) => !allowed.has(p));
  if (unknown.length) {
    problems.push(`Unknown placeholder${unknown.length > 1 ? 's' : ''} ${unknown.map((u) => `{${u}}`).join(', ')}. Use only the ones listed for this message.`);
  }
  return problems;
};

// ---------- Rendering ----------

export type TemplateValues = Record<string, string | undefined>;

const fill = (text: string, values: TemplateValues): string => text.replace(PLACEHOLDER, (_, k: string) => singleLine(values[k] ?? ''));
const usesEmptyValue = (text: string, values: TemplateValues): boolean => placeholdersIn(text).some((k) => !values[k]?.trim());

export interface RenderedMessage {
  title: string;
  message: string;
  details: string[];
  /** The {{2}} parameter exactly as sent to WATI (one line, clamped). */
  content: string;
  /** Length of the content before clamping, to warn that it will be cut short. */
  contentLength: number;
  truncated: boolean;
}

/**
 * Fills the placeholders. A detail line whose placeholder has no value (e.g. "Quality's remarks:
 * {remarks}" when there were no remarks) is left out entirely rather than sent half-empty.
 */
export const renderMessage = (content: TemplateContent, values: TemplateValues): RenderedMessage => {
  const title = singleLine(fill(content.title, values));
  const message = singleLine(fill(content.message, values));
  const details = content.details
    .filter((line) => line.trim() && !usesEmptyValue(line, values))
    .map((line) => singleLine(fill(line, values)));
  const full = singleLine([title ? `*${title}*` : '', message, ...details].filter(Boolean).join(' | '));
  return { title, message, details, content: clamp(full, LIMITS.content), contentLength: full.length, truncated: full.length > LIMITS.content };
};

/** The whole WhatsApp message as the recipient will see it (approved wrapper + {{1}}/{{2}}/{{3}}). */
export const fullMessageText = (name: string, content: string, link: string): string =>
  APPROVED_TEMPLATE.body.replace('{{1}}', singleLine(name)).replace('{{2}}', content).replace('{{3}}', singleLine(link));

/** Free-form fallback used only when no WATI template is configured (deliverable inside a 24h session). */
export const sessionMessageText = (rendered: RenderedMessage, link: string): string =>
  [`*${rendered.title}*`, rendered.message, ...rendered.details, '', `Open: ${link}`].join('\n');

export const sampleValues = (def: TemplateDefinition): TemplateValues => Object.fromEntries(def.variables.map((v) => [v.key, v.sample]));
