// Display metadata for the incident workflow (mirrors server/src/modules/incidents/incident.model.ts).

export type IncidentStatus =
  | 'SUBMITTED'
  | 'INFO_REQUESTED'
  | 'REJECTED'
  | 'ASSIGNED'
  | 'UNDER_INVESTIGATION'
  | 'CAPA_IN_PROGRESS'
  | 'PENDING_QUALITY_REVIEW'
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
  1: { label: 'Level 1 – Near Miss', short: 'L1 Near Miss', classes: 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0] font-semibold' },
  2: { label: 'Level 2 – Minor Harm', short: 'L2 Minor', classes: 'bg-[#F0F9FF] text-[#0369A1] border-[#BAE6FD] font-semibold' },
  3: { label: 'Level 3 – Moderate Harm', short: 'L3 Moderate', classes: 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA] font-bold' },
  4: { label: 'Level 4 – Major Harm', short: 'L4 Major', classes: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA] font-bold' },
  5: { label: 'Level 5 – Critical / Sentinel', short: 'L5 Sentinel', classes: 'bg-[#6B1418] text-white border-[#4A0D10] font-black' },
};

/** RCA is required from severity 4, CAPA from severity 3 (same rule as the server). */
export const severityNeeds = (severity: number) => ({ rca: severity >= 4, capa: severity >= 3 });

/** Main path of the workflow, used by the progress indicator. */
export const WORKFLOW_STEPS: Array<{ key: string; label: string; statuses: IncidentStatus[] }> = [
  { key: 'reported', label: 'Reported', statuses: ['SUBMITTED', 'INFO_REQUESTED'] },
  { key: 'assigned', label: 'Assigned to HOD', statuses: ['ASSIGNED'] },
  { key: 'investigation', label: 'Investigation', statuses: ['UNDER_INVESTIGATION'] },
  { key: 'capa', label: 'CAPA', statuses: ['CAPA_IN_PROGRESS'] },
  { key: 'review', label: 'Quality Review', statuses: ['PENDING_QUALITY_REVIEW'] },
  { key: 'closed', label: 'Closed', statuses: ['CLOSED'] },
];

export const CAPA_STATUS_META: Record<string, { label: string; classes: string }> = {
  OPEN: { label: 'Open', classes: 'bg-blue-50 text-blue-700 border-blue-200' },
  DONE: { label: 'Done – awaiting review', classes: 'bg-amber-50 text-amber-800 border-amber-300' },
  EFFECTIVE: { label: 'Effective', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

export const idOf = (value: any): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'object') return value._id ? String(value._id) : undefined;
  return String(value);
};
