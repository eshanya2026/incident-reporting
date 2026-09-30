import dayjs from 'dayjs';
import { FileText, MessagesSquare, Paperclip } from 'lucide-react';
import { openAttachment } from '../../../lib/files';
import { Card, Field } from '../../ui/primitives';
import { toast } from '../../../store/useToastStore';

const fmt = (d?: string) => (d ? dayjs(d).format('DD MMM YYYY HH:mm') : '');

// Matches server/src/modules/incidents/incident.model.ts AFFECTED_PERSON_TYPES
const AFFECTED_PERSON_LABELS: Record<string, string> = {
  INPATIENT: 'Inpatient',
  OUTPATIENT: 'Outpatient',
  VISITOR_FAMILY: 'Visitor/Family',
  EMPLOYEE: 'Employee',
  OTHER: 'Other',
};

/** What the reporter wrote. */
export function ReportDetails({ incident }: { incident: any }) {
  const subcategory = incident.categoryId?.subcategories?.find((s: any) => s.code === incident.subcategoryCode)?.name;
  const p = incident.patient;

  return (
    <Card title="Report" icon={FileText}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Field label="Description">{incident.description}</Field>
        </div>
        <Field label="Witness(es)">{incident.witness}</Field>
        <Field label="Immediate action taken">{incident.immediateAction}</Field>
        <Field label="Category">
          <div>
            <span>{incident.categoryId?.name}</span>
            {subcategory ? <span className="text-clinicalText-secondary"> — {subcategory}</span> : ''}
            {incident.categoryId?.domain && (
              <span className="block text-[12.5px] text-clinicalText-muted mt-0.5 font-normal">
                {incident.categoryId.domain}
              </span>
            )}
          </div>
        </Field>
        <Field label="Where it occurred">
          <div>
            <span>{incident.occurredInDepartmentId?.name}</span>
            {(incident.floor || incident.zone || incident.locationId?.floor || incident.locationId?.zone) && (
              <span className="text-clinicalText-secondary">
                {' — '}
                {incident.floor || incident.locationId?.floor}
                {(incident.floor || incident.locationId?.floor) && (incident.zone || incident.locationId?.zone) ? ', ' : ''}
                {incident.zone || incident.locationId?.zone}
              </span>
            )}
            {incident.locationId?.name && !incident.locationId.code?.startsWith('FL') ? (
              <span className="block text-[12.5px] text-clinicalText-muted mt-0.5 font-normal">
                Specific Area: {incident.locationId.name}
              </span>
            ) : null}
          </div>
        </Field>
        <Field label="When it occurred">{fmt(incident.incidentDateTime)}</Field>
        {incident.affectedPersonType && (
          <Field label="Affected Person">
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-clinicalText-primary text-[11.5px] font-semibold">
              {AFFECTED_PERSON_LABELS[incident.affectedPersonType] || incident.affectedPersonType}
            </span>
            {incident.affectedPersonType === 'OTHER' && incident.affectedOtherDetail && (
              <span className="block text-[12.5px] text-clinicalText-muted mt-1 font-normal">
                {incident.affectedOtherDetail}
              </span>
            )}
          </Field>
        )}
        {incident.affectedPersonType === 'INPATIENT' && incident.patientInvolved && (
          <div className="md:col-span-2 p-3 rounded-xl bg-slate-50 border border-slate-100 grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="Name">{p?.name}</Field>
            <Field label="IP number">{p?.ipNumber}</Field>
            <Field label="Ward">{p?.ward}</Field>
          </div>
        )}
        {incident.affectedPersonType === 'OUTPATIENT' && incident.patientInvolved && (
          <div className="md:col-span-2 p-3 rounded-xl bg-slate-50 border border-slate-100 grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="Name">{p?.name}</Field>
            <Field label="Reg No">{p?.uhid}</Field>
            <Field label="Consultant">{p?.consultant}</Field>
          </div>
        )}
        {incident.affectedPersonType === 'VISITOR_FAMILY' && incident.affectedPersonDetail && (
          <div className="md:col-span-2 p-3 rounded-xl bg-slate-50 border border-slate-100 grid grid-cols-2 gap-3">
            <Field label="Name">{incident.affectedPersonDetail.name}</Field>
            <Field label="Contact number">{incident.affectedPersonDetail.contactNumber}</Field>
          </div>
        )}
        {incident.affectedPersonType === 'EMPLOYEE' && incident.affectedPersonDetail && (
          <div className="md:col-span-2 p-3 rounded-xl bg-slate-50 border border-slate-100 grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="Name">{incident.affectedPersonDetail.name}</Field>
            <Field label="Employee number">{incident.affectedPersonDetail.employeeId}</Field>
            <Field label="Department">{incident.affectedPersonDetail.departmentId?.name}</Field>
          </div>
        )}
        {incident.affectedPersonType === 'OTHER' && incident.affectedPersonDetail && (
          <div className="md:col-span-2 p-3 rounded-xl bg-slate-50 border border-slate-100 grid grid-cols-2 gap-3">
            <Field label="Name">{incident.affectedPersonDetail.name}</Field>
            <Field label="Contact number">{incident.affectedPersonDetail.contactNumber}</Field>
          </div>
        )}
        {incident.remarks && (
          <div className="md:col-span-2">
            <Field label="Remarks">{incident.remarks}</Field>
          </div>
        )}
      </div>
      {incident.attachments?.length > 0 && (
        <div>
          <div className="text-[12.5px] font-bold uppercase tracking-wider text-clinicalText-muted mb-1">Evidence</div>
          <div className="flex flex-wrap gap-2">
            {incident.attachments.map((a: any) => (
              <button
                key={a._id}
                type="button"
                onClick={() => openAttachment(a).catch(() => toast.error('Could not open the file'))}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-clinicalBorder rounded-lg text-xs text-[#8B1E23] hover:bg-[#FFF5F5] cursor-pointer"
              >
                <Paperclip className="w-3.5 h-3.5" /> {a.originalName}
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

/**
 * Conversation and hand-overs: Quality's questions and the reporter's answers, assignments,
 * HOD returns and Quality reviews. Staff only receive the Q&A from the API.
 */
export function HistorySection({ incident }: { incident: any }) {
  type Entry = { at: string; who?: string; title: string; text?: string; tone: string };
  const entries: Entry[] = [];

  for (const r of incident.infoRequests || []) {
    entries.push({ at: r.askedAt, who: r.askedBy?.name, title: 'Quality asked', text: r.question, tone: 'border-amber-300' });
    if (r.response) entries.push({ at: r.respondedAt, title: 'Reporter answered', text: r.response, tone: 'border-amber-200' });
  }
  for (const a of incident.assignments || []) {
    const additional = a.notifiedDepartmentIds?.length
      ? ` + Involved: ${a.notifiedDepartmentIds.map((d: any) => d.name || d).join(', ')}`
      : '';
    const cc = a.intimatedUserIds?.length
      ? ` · CC: ${a.intimatedUserIds.map((u: any) => `${u.name || u}${u.designation ? ` (${u.designation})` : ''}`).join(', ')}`
      : '';
    entries.push({
      at: a.at,
      who: a.by?.name,
      title: `Assigned to ${a.departmentId?.name || 'department'}${additional}${a.hodUserId?.name ? ` (${a.hodUserId.name})` : ''} · severity ${a.severity}${cc}`,
      text: a.remarks,
      tone: 'border-violet-300',
    });
  }
  for (const r of incident.hodReturns || []) {
    entries.push({ at: r.at, who: r.by?.name, title: 'Returned to Quality by HOD', text: r.reason, tone: 'border-red-300' });
  }
  if (incident.closureSubmission) {
    // Only the latest submission is stored; earlier ones appear in the timeline
    entries.push({ at: incident.closureSubmission.at, who: incident.closureSubmission.by?.name, title: 'Submitted for review', text: incident.closureSubmission.summary, tone: 'border-indigo-300' });
  }
  for (const r of incident.qualityReviews || []) {
    entries.push({
      at: r.at,
      who: r.by?.name,
      title: r.decision === 'ACCEPTED' ? 'Quality accepted and closed' : 'Quality sent it back',
      text: r.remarks,
      tone: r.decision === 'ACCEPTED' ? 'border-emerald-300' : 'border-red-300',
    });
  }
  if (entries.length === 0) return null;
  entries.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <Card title="Notes & hand-overs" icon={MessagesSquare}>
      <div className="space-y-2">
        {entries.map((e, i) => (
          <div key={i} className={`pl-3 border-l-4 ${e.tone}`}>
            <div className="text-xs font-semibold text-clinicalText-primary">{e.title}</div>
            <div className="text-[12.5px] text-clinicalText-muted">
              {fmt(e.at)}
              {e.who ? ` · ${e.who}` : ''}
            </div>
            {e.text && <div className="text-xs text-clinicalText-secondary mt-0.5 whitespace-pre-wrap">{e.text}</div>}
          </div>
        ))}
      </div>
    </Card>
  );
}
