import mongoose from 'mongoose';
import { CLOSURE_TARGET_DAYS, Incident, SEVERITY_LABELS } from '../incidents/incident.model.js';
import { Investigation } from '../investigations/investigation.model.js';
import { RootCauseAnalysis } from '../rca/rca.model.js';
import { RcaMeeting } from '../rca/rcaMeeting.model.js';
import { Capa } from '../capa/capa.model.js';
import { Department } from '../departments/department.model.js';
import { InsightScope, deidentify } from './insightFacts.js';
import { env } from '../../config/env.js';

// The full case record "Ask AI" answers from: every incident in scope with its timings, severity
// history, assignments, investigations, RCA, CAPA, reviews, closure and risk score, plus complete
// aggregate tables (so counts stay right even when the case list is capped), the hospital rules the
// figures are judged against, and an explicit list of what the system does not record.
//
// Patient identifiers never leave the server. Free-text case details (findings, root causes,
// CAPA wording, remarks, reasons) are only included when AI_SHARE_CASE_TEXT is on, de-identified.

export const CHAT_MAX_RECORDS = 400;
const DAY = 86_400_000;
const HOUR = 3_600_000;
const HOD_WORK_STATUSES = ['ASSIGNED', 'UNDER_INVESTIGATION', 'CAPA_IN_PROGRESS'];
const OPEN_STATUSES = [...HOD_WORK_STATUSES, 'SUBMITTED', 'INFO_REQUESTED', 'PENDING_QUALITY_REVIEW', 'RCA_REQUESTED'];

export const POLICY = {
  reportingWindowHours: 24,
  reportingWindowNote: 'Assumed hospital standard: an incident should be reported within 24 hours of occurring (not yet confirmed by the hospital).',
  shifts: 'Morning 08:00-14:00, Evening 14:00-20:00, Night 20:00-08:00 (assumed; derived from the recorded occurrence time).',
  initialReview: "Quality's first action on a report: assigning it, asking the reporter a question, or rejecting it.",
  closureTargetDaysBySeverity: CLOSURE_TARGET_DAYS,
  hodActionDeadlineHoursByPriority: { HIGH: 48, MEDIUM: 72, LOW: 120, EXTREMELY_LOW: 168 },
  rcaRequired: 'A completed 5-Why/fishbone RCA is required before the investigation can be completed for severity 4 (Permanent Harm) and 5 (Sentinel Event). Quality may also request an RCA meeting for any incident at review.',
  capaRequired: 'Every incident needs at least one CAPA from each involved department before it can be submitted for closure.',
  closureApprovals:
    'Closure requires, in order: investigation completed with findings by every involved department; RCA where required; CAPA written and marked done by every involved department; submission by the HOD; Quality review with a risk score (likelihood x severity), plus a rationale for risk severity 4-5.',
  capaEffectiveness:
    'When Quality accepts an incident at review, all of its completed CAPAs are marked EFFECTIVE automatically; there is no separate, later effectiveness check recorded. A CAPA Quality is not satisfied with is sent back (reopened) with review remarks.',
  riskBands: 'Risk score = likelihood x severity (1-25): LOW 1-4, MODERATE 5-9, HIGH 10-16, EXTREME 17-25.',
  severityScale: SEVERITY_LABELS,
  significanceRanking:
    'When ranking safety concerns, use: risk band and severity, recurrence (including recurrence after closure), whether work is overdue, and how many departments are affected.',
};

export const NOT_RECORDED = [
  'How an incident was discovered (staff report vs complaint vs audit) is not recorded.',
  'Patient discharge dates are not recorded (only an optional admission date).',
  'Edits to incident details or investigation findings are not versioned; only workflow steps (assign, return, submit, review, close, etc.) are logged. Initial vs final severity is the only severity history.',
  'Closed incidents cannot be reopened in this system.',
  'Duplicate reports are not linked to an original; duplicates are only rejected, with a reason.',
  'Patient activity (inpatient-days, admissions, bed occupancy) is not recorded, so incident rates per activity cannot be calculated.',
  'Other registers (pharmacy, falls, complaints, biomedical) are not connected.',
  'Equipment identifiers and maintenance history are not recorded; equipment can only be inferred from incident titles.',
  'There is no risk register and no management-review record.',
  'Escalation beyond Quality assigning the incident is not tracked separately.',
  'Previous dashboard exports are not stored.',
];

// ---------- helpers ----------

const idOf = (v: any): string | undefined => (v ? String(v._id ?? v) : undefined);
const nameOf = (v: any): string | undefined => (v && typeof v === 'object' && 'name' in v ? v.name : undefined);
const iso = (d?: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 16).replace('T', ' ') : undefined);
const isoDay = (d?: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : undefined);
const hoursBetween = (a?: Date | string, b?: Date | string) =>
  a && b ? Math.round(((new Date(b).getTime() - new Date(a).getTime()) / HOUR) * 10) / 10 : undefined;
const daysBetween = (a?: Date | string, b?: Date | string) =>
  a && b ? Math.round(((new Date(b).getTime() - new Date(a).getTime()) / DAY) * 10) / 10 : undefined;

// Local (hospital) time for shift and weekday
const HOSPITAL_TZ = 'Asia/Kolkata';
const localParts = (d: Date) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: HOSPITAL_TZ, weekday: 'short', hour: '2-digit', hour12: false })
      .formatToParts(d)
      .map((p) => [p.type, p.value])
  );
  return { weekday: parts.weekday as string, hour: Number(parts.hour) % 24 };
};
export const shiftOf = (hour: number) => (hour >= 8 && hour < 14 ? 'Morning' : hour >= 14 && hour < 20 ? 'Evening' : 'Night');

export interface ChatSources {
  incidents: any[];
  investigations: any[];
  rcas: any[];
  rcaMeetings: any[];
  capas: any[];
  /** Departments in scope that exist (for "who reported nothing"), hospital scope only. */
  allDepartments: Array<{ id: string; name: string }>;
}

/** Builds the dataset from already-loaded documents. Pure, so it can be tested without a database. */
/** Words in the question that could be part of a patient name or a UHID / IP number. */
const identityTokens = (question?: string): string[] =>
  (question ?? '')
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
const STOP_WORDS = new Set(
  'what when where which who whom whose why how did does the and for with from that this last week month year today yesterday happened happen incident incidents patient patients about show tell give list was were has have had any all are mr mrs ms dr miss shri smt ward bed uhid number'.split(' ')
);
const normalise = (s?: string) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export interface ChatDatasetOptions {
  now: Date;
  shareCaseText: boolean;
  scope: InsightScope;
  /** The asker may see patient names, UHIDs and the incident description (insights.patient_details). */
  identify?: boolean;
  /** Latest question: incidents it names (by number, CAPA number, or patient name/UHID) decide the focus. */
  question?: string;
  /** Recent conversation (previous question and answer), used to keep a short follow-up on the same incidents. */
  followUp?: string;
}

/** At most this many incidents are sent in full when a question is about specific incidents. */
export const FOCUS_MAX_RECORDS = 25;

const pad6 = (n: string) => n.padStart(6, '0');
/** Incident and CAPA numbers written in a piece of text (tolerating a dropped leading zero). */
export const referencedNumbers = (textIn?: string) => {
  const t = textIn ?? '';
  return {
    incidents: new Set([...t.matchAll(/\bINC-?\s?(\d{4})-?(\d{1,6})\b/gi)].map((m) => `INC-${m[1]}-${pad6(m[2])}`)),
    capas: new Set([...t.matchAll(/\bCAPA-?\s?(\d{4})-?(\d{1,6})\b/gi)].map((m) => `CAPA-${m[1]}-${pad6(m[2])}`)),
  };
};
// A short follow-up that points back at what was just discussed ("who closed it?")
const FOLLOW_UP = /\b(it|its|this|that|these|those|them|they|their|he|she|him|her|same|above)\b/i;

/**
 * General questions get every record in a compact form: anything empty, zero or false is left out, and
 * a CAPA's or investigation's department/owner is left out when it is the incident's own department/HOD.
 */
const compactRecord = (r: any) => {
  const prune = (v: any): any => {
    if (Array.isArray(v)) {
      const a = v.map(prune).filter((x) => x !== undefined);
      return a.length ? a : undefined;
    }
    if (v && typeof v === 'object') {
      const o: any = {};
      for (const [k, x] of Object.entries(v)) {
        const p = prune(x);
        if (p !== undefined) o[k] = p;
      }
      return Object.keys(o).length ? o : undefined;
    }
    return v === null || v === '' || v === 0 || v === false ? undefined : v;
  };
  const out = { ...r };
  delete out.description;
  delete out.immediateAction;
  if (out.patient) out.patient = { name: out.patient.name, uhid: out.patient.uhid };
  if (out.occurredInDept === out.responsibleDept) delete out.occurredInDept;
  if (out.reportingDept === out.responsibleDept) delete out.reportingDept;
  out.investigations = out.investigations?.map((v: any) => ({
    ...v,
    dept: v.dept === r.responsibleDept ? undefined : v.dept,
    investigator: v.investigator === r.hod ? undefined : v.investigator,
  }));
  out.capas = out.capas?.map((c: any) => ({
    ...c,
    dept: c.dept === r.responsibleDept ? undefined : c.dept,
    owner: c.owner === r.hod ? undefined : c.owner,
  }));
  // Keep explicit "reported on time" (false) and "not within target" answers
  const kept = { reportedLate: r.reportedLate, withinTarget: r.closure?.withinTarget };
  const pruned = prune(out) ?? {};
  if (kept.reportedLate === false) pruned.reportedLate = false;
  if (kept.withinTarget === false && pruned.closure) pruned.closure.withinTarget = false;
  return pruned;
};

export const buildChatDataset = (src: ChatSources, opts: ChatDatasetOptions) => {
  const { now, shareCaseText, identify = false } = opts;
  const text = (value: unknown, privateNames: string[]) =>
    shareCaseText && typeof value === 'string' && value.trim() ? (identify ? value.trim() : deidentify(value.trim(), privateNames)).slice(0, 600) : undefined;

  const group = <T>(rows: T[], key: (r: T) => string | undefined) => {
    const m = new Map<string, T[]>();
    rows.forEach((r) => {
      const k = key(r);
      if (k) m.set(k, [...(m.get(k) ?? []), r]);
    });
    return m;
  };
  const invByIncident = group(src.investigations, (i) => idOf(i.incidentId));
  const capaByIncident = group(src.capas, (c) => idOf(c.incidentId));
  const rcaByIncident = new Map(src.rcas.map((r) => [idOf(r.incidentId)!, r]));
  const meetingByIncident = new Map(src.rcaMeetings.map((r) => [idOf(r.incidentId)!, r]));

  const records = src.incidents.map((i) => {
    // With patient details allowed nothing is masked; otherwise names are removed from free text
    const privateNames = identify ? [] : [i.patient?.name, i.affectedPersonDetail?.name].filter(Boolean);
    const occurred = i.incidentDateTime ? new Date(i.incidentDateTime) : undefined;
    const local = occurred ? localParts(occurred) : undefined;
    const subcategory = i.categoryId?.subcategories?.find((s: any) => s.code === i.subcategoryCode)?.name;
    const firstReviewAt = [i.assignments?.[0]?.at ?? i.assignedAt, i.infoRequests?.[0]?.askedAt, i.rejection?.at]
      .filter(Boolean)
      .map((d: any) => new Date(d))
      .sort((a: Date, b: Date) => a.getTime() - b.getTime())[0];
    const invs = invByIncident.get(String(i._id)) ?? [];
    const capas = capaByIncident.get(String(i._id)) ?? [];
    const rca = rcaByIncident.get(String(i._id));
    const meeting = meetingByIncident.get(String(i._id));
    const closedById = idOf(i.closedBy);
    const daysToClose = daysBetween(i.reportedAt, i.closedAt);

    const missing = [
      !i.incidentDateTime && 'occurrence time',
      !i.locationId && 'location',
      !(i.immediateAction || '').trim() && 'immediate action',
      (i.description || '').trim().length < 20 && 'harm/description detail',
      i.status === 'CLOSED' && !i.riskAssessment?.score && 'risk score',
    ].filter(Boolean);
    const dateIssues = [
      occurred && i.reportedAt && occurred > new Date(i.reportedAt) && 'occurred after it was reported',
      i.closedAt && i.reportedAt && new Date(i.closedAt) < new Date(i.reportedAt) && 'closed before it was reported',
      i.assignedAt && i.reportedAt && new Date(i.assignedAt) < new Date(i.reportedAt) && 'assigned before it was reported',
      occurred && occurred > now && 'occurrence date is in the future',
    ].filter(Boolean);

    return {
      no: i.incidentNumber,
      title: identify ? i.title || '' : deidentify(i.title || '', privateNames),
      status: i.status,
      occurred: occurred ? iso(occurred) : undefined,
      weekday: local?.weekday,
      shift: local ? shiftOf(local.hour) : undefined,
      reported: iso(i.reportedAt),
      reportDelayHours: hoursBetween(occurred, i.reportedAt),
      reportedLate: occurred && i.reportedAt ? (new Date(i.reportedAt).getTime() - occurred.getTime()) / HOUR > POLICY.reportingWindowHours : undefined,
      reportingDept: nameOf(i.reportingDepartmentId),
      occurredInDept: nameOf(i.occurredInDepartmentId),
      responsibleDept: nameOf(i.departmentId),
      involvedDepts: (i.notifiedDepartmentIds || []).map(nameOf).filter(Boolean),
      location: nameOf(i.locationId),
      floorZone: [i.floor, i.zone].filter(Boolean).join(' ') || undefined,
      category: nameOf(i.categoryId),
      subcategory,
      affected: i.affectedPersonType,
      ...(identify
        ? {
            patient: i.patient?.name || i.patient?.uhid
              ? {
                  name: i.patient?.name,
                  uhid: i.patient?.uhid,
                  ipNumber: i.patient?.ipNumber,
                  age: i.patient?.age,
                  gender: i.patient?.gender,
                  ward: i.patient?.ward,
                  bed: i.patient?.bed,
                }
              : undefined,
            affectedPersonName: i.affectedPersonDetail?.name,
            description: (i.description || '').trim().slice(0, 1200) || undefined,
            immediateAction: (i.immediateAction || '').trim().slice(0, 600) || undefined,
          }
        : {}),
      severityReported: i.initialSeverity ?? i.severity,
      severityFinal: i.severity,
      severityChangedBy: i.initialSeverity && i.initialSeverity !== i.severity ? nameOf(i.assignedBy) : undefined,
      severityChangeNote: i.initialSeverity && i.initialSeverity !== i.severity ? text(i.assignments?.[0]?.remarks, privateNames) : undefined,
      priority: i.priority,
      hoursToInitialReview: hoursBetween(i.reportedAt, firstReviewAt),
      assignedAt: iso(i.assignedAt),
      assignedBy: nameOf(i.assignedBy),
      hod: nameOf(i.assignedHod),
      hodDeadline: iso(i.actionDueAt),
      overdueDays:
        i.actionDueAt && HOD_WORK_STATUSES.includes(i.status) && new Date(i.actionDueAt) < now
          ? Math.max(1, Math.round((now.getTime() - new Date(i.actionDueAt).getTime()) / DAY))
          : undefined,
      unassignedHours: i.status === 'SUBMITTED' ? hoursBetween(i.reportedAt, now) : undefined,
      ageDaysIfOpen: OPEN_STATUSES.includes(i.status) ? daysBetween(i.reportedAt, now) : undefined,
      assignmentHistory: (i.assignments || []).length > 1 ? (i.assignments || []).map((a: any) => nameOf(a.departmentId)) : undefined,
      returnsByHod: (i.hodReturns || []).length || undefined,
      returnReasons: shareCaseText ? (i.hodReturns || []).map((r: any) => text(r.reason, privateNames)).filter(Boolean) : undefined,
      infoRequests: (i.infoRequests || []).length || undefined,
      interimControls: text(i.immediateAction, privateNames),
      rcaRequired: i.requiresRca || undefined,
      rca: rca ? { status: rca.status, method: rca.method, rootCause: text(rca.rootCauseSummary, privateNames) } : i.requiresRca ? { status: 'MISSING' } : undefined,
      rcaMeeting: meeting
        ? { status: meeting.status, requested: isoDay(i.rcaRequestedAt), meetingAt: iso(meeting.meetingAt), reportUploaded: isoDay(meeting.reportUploadedAt), reason: text(i.rcaRequestRemarks, privateNames) }
        : undefined,
      investigations: invs.map((v) => ({
        dept: nameOf(v.departmentId),
        investigator: nameOf(v.investigatorId),
        status: v.status,
        started: isoDay(v.startedAt),
        due: isoDay(v.dueDate),
        completed: isoDay(v.completedAt),
        overdueDays:
          v.dueDate && v.status !== 'COMPLETED' && new Date(v.dueDate) < now
            ? Math.round((now.getTime() - new Date(v.dueDate).getTime()) / DAY)
            : v.dueDate && v.completedAt && new Date(v.completedAt) > new Date(v.dueDate)
              ? Math.round((new Date(v.completedAt).getTime() - new Date(v.dueDate).getTime()) / DAY)
              : undefined,
        contributingFactors: v.contributingFactors?.length ? v.contributingFactors : undefined,
        peopleInterviewed: v.peopleInterviewed?.length || undefined,
        evidenceFiles: v.evidence?.length || 0,
        findings: text(v.findings, privateNames),
      })),
      capas: capas.map((c) => ({
        no: c.capaNumber,
        type: c.type,
        dept: nameOf(c.ownerDepartmentId),
        owner: nameOf(c.ownerUserId),
        status: c.status,
        priority: c.priority,
        target: isoDay(c.targetDate),
        completed: isoDay(c.completedAt),
        overdueDays:
          c.status === 'OPEN' && c.targetDate && new Date(c.targetDate) < now
            ? Math.round((now.getTime() - new Date(c.targetDate).getTime()) / DAY)
            : undefined,
        evidenceFiles: c.evidence?.length || 0,
        verification: c.verification?.verifiedAt
          ? { effective: c.verification.effective, at: isoDay(c.verification.verifiedAt), by: nameOf(c.verification.verifiedBy), remarks: text(c.verification.remarks, privateNames) }
          : undefined,
        action: text(c.action, privateNames),
        completionRemarks: text(c.completionRemarks, privateNames),
      })),
      reviews: (i.qualityReviews || []).map((r: any) => ({
        decision: r.decision,
        by: nameOf(r.by),
        at: isoDay(r.at),
        departmentsSentBack: r.departmentIds?.length ? r.departmentIds.map(nameOf).filter(Boolean) : undefined,
        remarks: text(r.remarks, privateNames),
      })),
      closure:
        i.status === 'CLOSED'
          ? {
              submittedForReview: isoDay(i.closureSubmission?.at),
              closed: isoDay(i.closedAt),
              closedBy: nameOf(i.closedBy),
              daysToClose,
              withinTarget: daysToClose !== undefined ? daysToClose <= (CLOSURE_TARGET_DAYS[i.severity] ?? 30) : undefined,
              closedByAlsoInvestigated: closedById ? invs.some((v) => idOf(v.investigatorId) === closedById) : undefined,
              remarks: text(i.closureRemarks, privateNames),
            }
          : undefined,
      risk: i.riskAssessment?.score
        ? { likelihood: i.riskAssessment.likelihood, severity: i.riskAssessment.severity, score: i.riskAssessment.score, band: i.riskAssessment.band, rationale: text(i.riskAssessment.rationale, privateNames) }
        : undefined,
      rejection: i.rejection ? { by: nameOf(i.rejection.by), at: isoDay(i.rejection.at), reason: text(i.rejection.reason, privateNames) } : undefined,
      missingData: missing.length ? missing : undefined,
      dateIssues: dateIssues.length ? dateIssues : undefined,
    };
  });

  // ---------- Complete aggregates (never capped) ----------
  const monthOf = (d?: Date | string) => (d ? new Date(d).toISOString().slice(0, 7) : 'unknown');
  const firstDay = (dates: Array<Date | string | undefined>): string | null => {
    const times = dates.filter(Boolean).map((d) => +new Date(d!)).filter((t) => !Number.isNaN(t));
    return times.length ? new Date(times.reduce((a, b) => Math.min(a, b))).toISOString().slice(0, 10) : null;
  };
  const quarterOf = (d?: Date | string) => {
    if (!d) return 'unknown';
    const x = new Date(d);
    return `${x.getFullYear()}-Q${Math.floor(x.getMonth() / 3) + 1}`;
  };
  const tally = (rows: any[], key: (r: any) => string | undefined) => {
    const out: Record<string, number> = {};
    rows.forEach((r) => {
      const k = key(r) ?? 'Not recorded';
      out[k] = (out[k] ?? 0) + 1;
    });
    return out;
  };
  const nested = (rows: any[], outer: (r: any) => string, inner: (r: any) => string | undefined) => {
    const out: Record<string, Record<string, number>> = {};
    rows.forEach((r) => {
      const o = outer(r);
      const k = inner(r) ?? 'Not recorded';
      out[o] = out[o] ?? {};
      out[o][k] = (out[o][k] ?? 0) + 1;
    });
    return out;
  };
  const notRejected = src.incidents.filter((i) => i.status !== 'REJECTED');
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const reportedRecently = new Set(
    src.incidents.filter((i) => i.reportedAt && new Date(i.reportedAt) >= sixMonthsAgo).map((i) => idOf(i.reportingDepartmentId)).filter(Boolean)
  );
  const reportedRecentlyNames = new Set(
    src.incidents
      .filter((i) => i.reportedAt && new Date(i.reportedAt) >= sixMonthsAgo)
      .map((i) => nameOf(i.reportingDepartmentId)?.trim().toLowerCase())
      .filter(Boolean)
  );

  const aggregates = {
    note: 'Complete counts over every incident in scope (rejected reports excluded unless stated).',
    coverage: {
      note: 'Every incident in scope since the system started, not a recent window.',
      firstReported: firstDay(src.incidents.map((i) => i.reportedAt)),
      firstOccurred: firstDay(src.incidents.map((i) => i.incidentDateTime)),
    },
    totalIncludingRejected: src.incidents.length,
    rejected: src.incidents.length - notRejected.length,
    byStatus: tally(src.incidents, (i) => i.status),
    byMonthOccurred: tally(notRejected, (i) => monthOf(i.incidentDateTime)),
    byMonthReported: tally(notRejected, (i) => monthOf(i.reportedAt)),
    byYearOccurred: tally(notRejected, (i) => (i.incidentDateTime ? monthOf(i.incidentDateTime).slice(0, 4) : undefined)),
    byYearReported: tally(notRejected, (i) => (i.reportedAt ? monthOf(i.reportedAt).slice(0, 4) : undefined)),
    byQuarterReported: tally(notRejected, (i) => quarterOf(i.reportedAt)),
    byQuarterAndCategory: nested(notRejected, (i) => quarterOf(i.reportedAt), (i) => nameOf(i.categoryId)),
    byResponsibleDepartment: tally(notRejected, (i) => nameOf(i.departmentId) ?? 'Not yet assigned'),
    byReportingDepartment: tally(notRejected, (i) => nameOf(i.reportingDepartmentId)),
    byLocation: tally(notRejected, (i) => nameOf(i.locationId)),
    bySeverityFinal: tally(notRejected, (i) => `${i.severity} ${SEVERITY_LABELS[i.severity] ?? ''}`.trim()),
    byShift: tally(notRejected, (i) => (i.incidentDateTime ? shiftOf(localParts(new Date(i.incidentDateTime)).hour) : undefined)),
    byWeekday: tally(notRejected, (i) => (i.incidentDateTime ? localParts(new Date(i.incidentDateTime)).weekday : undefined)),
    // Two departments can share a name (e.g. an old and a new "Emergency Medicine"); a name that
    // reported under either is not listed as silent, and each name is listed once.
    departmentsWithNoReportsInLast6Months:
      opts.scope.kind === 'HOSPITAL'
        ? [
            ...new Set(
              src.allDepartments
                .filter((d) => !reportedRecently.has(d.id) && !reportedRecentlyNames.has(d.name.trim().toLowerCase()))
                .map((d) => d.name)
            ),
          ]
        : undefined,
  };

  // Possible duplicates: same category and location, occurring within 2 days of each other
  const possibleDuplicates: Array<{ incidents: string[]; why: string }> = [];
  const sorted = [...notRejected].filter((i) => i.incidentDateTime).sort((a, b) => +new Date(a.incidentDateTime) - +new Date(b.incidentDateTime));
  for (let a = 0; a < sorted.length; a++) {
    for (let b = a + 1; b < sorted.length; b++) {
      const gap = (+new Date(sorted[b].incidentDateTime) - +new Date(sorted[a].incidentDateTime)) / DAY;
      if (gap > 2) break;
      if (idOf(sorted[a].categoryId) === idOf(sorted[b].categoryId) && idOf(sorted[a].locationId) && idOf(sorted[a].locationId) === idOf(sorted[b].locationId)) {
        possibleDuplicates.push({
          incidents: [sorted[a].incidentNumber, sorted[b].incidentNumber],
          why: `same category (${nameOf(sorted[a].categoryId)}) and location (${nameOf(sorted[a].locationId)}), ${Math.round(gap * 24)} hours apart`,
        });
      }
    }
  }

  // Which incidents does the text refer to: by incident/CAPA number, or (with patient details
  // allowed) by a patient name or UHID.
  const referencedBy = (textIn?: string) => {
    const nums = referencedNumbers(textIn);
    const tokens = identify ? identityTokens(textIn) : [];
    const byPatient = (r: any) => {
      if (!tokens.length) return false;
      const nameWords = `${r.patient?.name ?? ''} ${r.affectedPersonName ?? ''}`.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
      const ids = [r.patient?.uhid, r.patient?.ipNumber].map(normalise).filter(Boolean);
      return tokens.some(
        (t) => nameWords.some((w) => w.length >= 3 && (w.startsWith(t) || t.startsWith(w))) || ids.some((id) => normalise(t).length >= 4 && id.includes(normalise(t)))
      );
    };
    return records.filter((r: any) => nums.incidents.has(r.no) || (r.capas || []).some((c: any) => nums.capas.has(c.no)) || byPatient(r));
  };
  let focus = referencedBy(opts.question);
  const question = opts.question ?? '';
  if (!focus.length && opts.followUp && FOLLOW_UP.test(question) && question.split(/\s+/).length <= 14) focus = referencedBy(opts.followUp);

  const header = {
    today: isoDay(now),
    caseTextShared: shareCaseText,
    patientDetailsShared: identify,
    policy: POLICY,
    notRecordedInSystem: NOT_RECORDED,
    aggregates,
  };

  // Question about specific incidents: send just those, in full (fast: a few thousand tokens)
  if (focus.length && focus.length <= FOCUS_MAX_RECORDS) {
    return {
      ...header,
      caseList: {
        mode: 'FOCUSED',
        note: `Full details of the ${focus.length} incident(s) the question refers to. Other incidents are not listed here; use "aggregates" for overall counts.`,
        records: focus,
      },
    };
  }

  // General question: every incident, compact. Older ones beyond the cap only if named in the question.
  const recent = records.slice(0, CHAT_MAX_RECORDS);
  const named = new Set(focus.map((r: any) => r.no));
  const older = records.slice(CHAT_MAX_RECORDS).filter((r: any) => named.has(r.no));
  return {
    ...header,
    possibleDuplicates: possibleDuplicates.slice(0, 30),
    caseList: {
      mode: 'ALL',
      note:
        (records.length > CHAT_MAX_RECORDS
          ? `The ${CHAT_MAX_RECORDS} most recently reported of ${records.length} incidents${older.length ? `, plus ${older.length} older incident(s) named in the question` : ''}. Other older incidents are counted in "aggregates" but not listed; say so if a question needs them.`
          : `All ${records.length} incidents in scope.`) +
        ' Compact form: a field that is missing means none, zero or not applicable; a CAPA or investigation without "dept"/"owner"/"investigator" belongs to the incident\'s responsibleDept and hod. Descriptions are not included here; ask about a specific incident to see them.',
      records: [...recent, ...older].map(compactRecord),
    },
  };
};

// ---------- Database ----------

/** A department's chat covers incidents it is responsible for and ones it was marked as involved in. */
const scopeFilterOf = (scope: InsightScope): Record<string, any> => {
  const deptOid = scope.departmentId ? new mongoose.Types.ObjectId(scope.departmentId) : null;
  return deptOid ? { $or: [{ departmentId: deptOid }, { notifiedDepartmentIds: deptOid }] } : {};
};

/** How much Ask AI covers for a scope: every incident since the first one. */
export const chatCoverage = async (scope: InsightScope): Promise<{ incidents: number; since: string | null }> => {
  const filter = scopeFilterOf(scope);
  const [incidents, first] = await Promise.all([
    Incident.countDocuments(filter),
    Incident.findOne(filter).sort({ reportedAt: 1 }).select('reportedAt').lean(),
  ]);
  return { incidents, since: (first as any)?.reportedAt ? new Date((first as any).reportedAt).toISOString().slice(0, 10) : null };
};

/** Every incident in scope since the beginning, newest first. Independent of the Insights page period. */
export const loadChatDataset = async (scope: InsightScope, opts: { identify?: boolean; question?: string; followUp?: string; now?: Date } = {}) => {
  const now = opts.now ?? new Date();
  const incidents = await Incident.find(scopeFilterOf(scope))
    // Without patient-details permission, identifiers are never loaded; the description is loaded only
    // so its length can flag thin reports and is not put in the dataset
    .select(
      opts.identify
        ? '-witness -remarks -patient.consultant -affectedPersonDetail.contactNumber -affectedPersonDetail.employeeId -attachments'
        : '-witness -remarks -patient.uhid -patient.ipNumber -patient.bed -patient.consultant -affectedPersonDetail.contactNumber -affectedPersonDetail.employeeId -attachments'
    )
    .populate('categoryId', 'name subcategories')
    .populate('locationId', 'name')
    .populate('departmentId', 'name')
    .populate('notifiedDepartmentIds', 'name')
    .populate('reportingDepartmentId', 'name')
    .populate('occurredInDepartmentId', 'name')
    .populate('assignedBy', 'name')
    .populate('assignedHod', 'name')
    .populate('closedBy', 'name')
    .populate('assignments.departmentId', 'name')
    .populate('qualityReviews.by', 'name')
    .populate('qualityReviews.departmentIds', 'name')
    .populate('rejection.by', 'name')
    .sort({ reportedAt: -1 })
    .lean();

  const ids = incidents.map((i: any) => i._id);
  const [investigations, rcas, rcaMeetings, capas, departments] = await Promise.all([
    Investigation.find({ incidentId: { $in: ids } }).populate('departmentId', 'name').populate('investigatorId', 'name').lean(),
    RootCauseAnalysis.find({ incidentId: { $in: ids } }).lean(),
    RcaMeeting.find({ incidentId: { $in: ids } }).lean(),
    Capa.find({ incidentId: { $in: ids } })
      .populate('ownerDepartmentId', 'name')
      .populate('ownerUserId', 'name')
      .populate('verification.verifiedBy', 'name')
      .lean(),
    scope.kind === 'HOSPITAL' ? Department.find({ active: { $ne: false } }).select('name').lean() : [],
  ]);

  const idByNumber = new Map<string, string>((incidents as any[]).map((i) => [i.incidentNumber, String(i._id)]));
  const dataset = buildChatDataset(
    {
      incidents,
      investigations,
      rcas,
      rcaMeetings,
      capas,
      allDepartments: (departments as any[]).map((d) => ({ id: String(d._id), name: d.name })),
    },
    { now, shareCaseText: env.AI_SHARE_CASE_TEXT, scope, identify: opts.identify, question: opts.question, followUp: opts.followUp }
  );
  return { dataset, idByNumber };
};
