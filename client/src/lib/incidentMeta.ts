// Display metadata for the incident workflow (mirrors server/src/modules/incidents/incident.model.ts).

export type IncidentStatus =
  | 'SUBMITTED'
  | 'INFO_REQUESTED'
  | 'REJECTED'
  | 'ASSIGNED'
  | 'UNDER_INVESTIGATION'
  | 'CAPA_IN_PROGRESS'
  | 'PENDING_QUALITY_REVIEW'
  | 'RCA_REQUESTED'
  | 'CLOSED';

export interface StatusMeta {
  label: string;
  /** Who has the incident right now, in plain words. */
  waitingOn: string;
  classes: string;
  dot: string;
}

export const STATUS_META: Record<IncidentStatus, StatusMeta> = {
  SUBMITTED: {
    label: 'Awaiting Quality',
    waitingOn: 'Quality is reviewing the report',
    classes: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
  },
  INFO_REQUESTED: {
    label: 'Info Requested',
    waitingOn: 'Waiting for the reporter to answer Quality',
    classes: 'bg-amber-50 text-amber-800 border-amber-300',
    dot: 'bg-amber-500',
  },
  REJECTED: {
    label: 'Rejected',
    waitingOn: 'Rejected by Quality',
    classes: 'bg-slate-100 text-slate-600 border-slate-300',
    dot: 'bg-slate-400',
  },
  ASSIGNED: {
    label: 'Assigned to HOD',
    waitingOn: 'Waiting for the HOD to start the investigation',
    classes: 'bg-violet-50 text-violet-700 border-violet-200',
    dot: 'bg-violet-500',
  },
  UNDER_INVESTIGATION: {
    label: 'Under Investigation',
    waitingOn: 'The HOD is investigating',
    classes: 'bg-sky-50 text-sky-700 border-sky-200',
    dot: 'bg-sky-500',
  },
  CAPA_IN_PROGRESS: {
    label: 'CAPA in Progress',
    waitingOn: 'The HOD is carrying out corrective and preventive actions',
    classes: 'bg-orange-50 text-orange-700 border-orange-200',
    dot: 'bg-orange-500',
  },
  PENDING_QUALITY_REVIEW: {
    label: 'Quality Review',
    waitingOn: 'Quality is reviewing the investigation and CAPA',
    classes: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    dot: 'bg-indigo-500',
  },
  RCA_REQUESTED: {
    label: 'RCA Requested',
    waitingOn: 'Quality member is conducting Root Cause Analysis (RCA)',
    classes: 'bg-purple-50 text-purple-700 border-purple-200',
    dot: 'bg-purple-500',
  },
  CLOSED: {
    label: 'Closed',
    waitingOn: 'Completed by Quality',
    classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
};

export const STATUS_ORDER = Object.keys(STATUS_META) as IncidentStatus[];

export const statusMeta = (status: string): StatusMeta =>
  STATUS_META[status as IncidentStatus] ?? {
    label: status?.replace(/_/g, ' ') || 'Unknown',
    waitingOn: '',
    classes: 'bg-slate-100 text-slate-600 border-slate-200',
    dot: 'bg-slate-400',
  };

export const SEVERITY_META: Record<number, { label: string; short: string; classes: string }> = {
  1: { label: 'Level 1 – Near Miss', short: 'Near Miss', classes: 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0] font-semibold' },
  2: { label: 'Level 2 – No Harm', short: 'No Harm', classes: 'bg-[#F0F9FF] text-[#0369A1] border-[#BAE6FD] font-semibold' },
  3: { label: 'Level 3 – Harm', short: 'Harm', classes: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA] font-bold' },
  4: { label: 'Level 4 – Sentinel Event', short: 'Sentinel', classes: 'bg-[#6B1418] text-white border-[#4A0D10] font-black' },
};

/** RCA is required for Sentinel Event (4) only; CAPA is required at every severity (same rule as the server). */
export const severityNeeds = (severity: number) => ({ rca: severity >= 4, capa: true });

/** Main path of the workflow, used by the progress indicator. */
export const WORKFLOW_STEPS: Array<{ key: string; label: string; statuses: IncidentStatus[] }> = [
  { key: 'reported', label: 'Reported', statuses: ['SUBMITTED', 'INFO_REQUESTED'] },
  { key: 'assigned', label: 'Assigned to HOD', statuses: ['ASSIGNED'] },
  { key: 'investigation', label: 'Investigation', statuses: ['UNDER_INVESTIGATION'] },
  { key: 'capa', label: 'CAPA', statuses: ['CAPA_IN_PROGRESS'] },
  { key: 'review', label: 'Quality Review', statuses: ['PENDING_QUALITY_REVIEW', 'RCA_REQUESTED'] },
  { key: 'closed', label: 'Closed', statuses: ['CLOSED'] },
];

export const CAPA_STATUS_META: Record<string, { label: string; classes: string }> = {
  OPEN: { label: 'Open', classes: 'bg-blue-50 text-blue-700 border-blue-200' },
  DONE: { label: 'Done – awaiting review', classes: 'bg-amber-50 text-amber-800 border-amber-300' },
  EFFECTIVE: { label: 'Effective', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

// How urgently the HOD should act, set by Quality at assignment (separate from severity).
export const INCIDENT_PRIORITIES = ['EXTREMELY_LOW', 'LOW', 'MEDIUM', 'HIGH'] as const;
export type IncidentPriority = (typeof INCIDENT_PRIORITIES)[number];

export const PRIORITY_META: Record<IncidentPriority, { label: string; classes: string }> = {
  EXTREMELY_LOW: { label: 'Extremely Low', classes: 'bg-slate-100 text-slate-600 border-slate-200' },
  LOW: { label: 'Low', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  MEDIUM: { label: 'Medium', classes: 'bg-amber-50 text-amber-800 border-amber-300' },
  HIGH: { label: 'High', classes: 'bg-red-50 text-red-700 border-red-200 font-bold' },
};

/** Identity colour for each priority level (selector, badges). */
export const PRIORITY_COLOR: Record<IncidentPriority, string> = {
  EXTREMELY_LOW: '#94A3B8',
  LOW: '#10B981',
  MEDIUM: '#F59E0B',
  HIGH: '#DC2626',
};

export const idOf = (value: any): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'object') return value._id ? String(value._id) : undefined;
  return String(value);
};

/** Identity colour for each severity level (list row stripes, summary cards). */
export const SEVERITY_COLOR: Record<number, string> = {
  1: '#10B981',
  2: '#0284C7',
  3: '#DC2626',
  4: '#6B1418',
};

export interface QualityScore {
  timeliness: number;
  capaQuality: number;
  rework: number;
  overall: number;
}

/** Days Quality targets for closing an incident, by severity (mirrors CLOSURE_TARGET_DAYS on the server). */
const CLOSURE_TARGET_DAYS: Record<number, number> = { 1: 30, 2: 21, 3: 14, 4: 7 };

/**
 * Mirrors computeQualityScore in server/src/modules/incidents/incident.model.ts, so the review
 * panel can show Quality a live preview before they confirm closing — the server computes and
 * stores the real value at that point, this is only for the preview.
 */
export const computeQualityScorePreview = (params: {
  reportedAt: string | Date;
  closedAt: Date;
  severity: number;
  reworkCount: number;
  capaTypes: Array<'CORRECTIVE' | 'PREVENTIVE'>;
}): QualityScore => {
  const targetDays = CLOSURE_TARGET_DAYS[params.severity] || CLOSURE_TARGET_DAYS[1];
  const reportedAt = new Date(params.reportedAt);
  const daysToClose = Math.max(0, (params.closedAt.getTime() - reportedAt.getTime()) / (24 * 60 * 60 * 1000));
  const timeliness = Math.max(0, Math.min(100, Math.round(100 - Math.max(0, daysToClose - targetDays) * 5)));

  const hasCorrective = params.capaTypes.includes('CORRECTIVE');
  const hasPreventive = params.capaTypes.includes('PREVENTIVE');
  const capaQuality = params.capaTypes.length === 0 ? 0 : (hasCorrective ? 50 : 0) + (hasPreventive ? 50 : 0);

  const rework = Math.max(0, 100 - params.reworkCount * 20);

  const overall = Math.round((timeliness + capaQuality + rework) / 3);

  return { timeliness, capaQuality, rework, overall };
};

/** Colour and short label for a score band, used for the preview and the stored result. */
export const scoreBand = (score: number): { label: string; classes: string } => {
  if (score >= 85) return { label: 'Excellent', classes: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  if (score >= 70) return { label: 'Good', classes: 'text-sky-700 bg-sky-50 border-sky-200' };
  if (score >= 50) return { label: 'Fair', classes: 'text-amber-700 bg-amber-50 border-amber-300' };
  return { label: 'Needs improvement', classes: 'text-red-700 bg-red-50 border-red-200' };
};
