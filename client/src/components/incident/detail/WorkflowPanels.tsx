import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, Clock, MessageSquare, Paperclip, Play, Send, Undo2, GitBranch, Calendar, BarChart3, Gauge, Upload } from 'lucide-react';
import { api } from '../../../lib/api';
import { useAction, errorMessage } from '../../../lib/useAction';
import { statusMeta, scoreBand, LIKELIHOOD_LABELS, RISK_SEVERITY_LABELS, RISK_BAND_META } from '../../../lib/incidentMeta';
import { Button, Card, Notice, inputClass, labelClass } from '../../ui/primitives';
import { openAttachment, uploadFile } from '../../../lib/files';
import { toast } from '../../../store/useToastStore';
import { useAuthStore } from '../../../store/useAuthStore';

/** GET that returns null on 404 (record not created yet). */
const getOrNull = async (url: string) => {
  try {
    const res: any = await api.get(url);
    return res.data;
  } catch (err: any) {
    if (err?.code === 'NOT_FOUND' || err?.response?.status === 404) return null;
    throw err;
  }
};

/** The final analytics score Quality's review produced, shown once the incident is closed. */
function QualityScoreSummary({ score }: { score: { timeliness: number; capaQuality: number; rework: number; overall: number } }) {
  return (
    <div className="p-3.5 rounded-xl border border-clinicalBorder bg-white shadow-card space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-clinicalText-primary flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4 text-maroon-700" /> Review &amp; analytics score
        </span>
        <span className={`px-2 py-0.5 rounded-full text-[11.5px] font-bold border ${scoreBand(score.overall).classes}`}>
          {score.overall}/100 · {scoreBand(score.overall).label}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'Timeliness', value: score.timeliness },
          { label: 'CAPA quality', value: score.capaQuality },
          { label: 'Rework', value: score.rework },
        ].map((s) => (
          <div key={s.label} className="p-2 rounded-lg bg-slate-50 border border-clinicalBorder">
            <div className="text-sm font-bold text-clinicalText-primary">{s.value}</div>
            <div className="text-[10.5px] uppercase tracking-wide text-clinicalText-muted">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The likelihood × severity risk rating Quality recorded before closing (see QualityReviewPanel.tsx). */
function RiskAssessmentSummary({
  risk,
}: {
  risk: { likelihood: number; severity: number; score: number; band: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME'; rationale?: string; assessedBy?: any; assessedAt?: string };
}) {
  return (
    <div className="p-3.5 rounded-xl border border-clinicalBorder bg-white shadow-card space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-clinicalText-primary flex items-center gap-1.5">
          <Gauge className="w-4 h-4 text-maroon-700" /> Risk rating
        </span>
        <span className={`px-2 py-0.5 rounded-full text-[11.5px] border ${RISK_BAND_META[risk.band].classes}`}>
          {risk.score}/25 · {RISK_BAND_META[risk.band].label}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="p-2 rounded-lg bg-slate-50 border border-clinicalBorder">
          <div className="text-sm font-bold text-clinicalText-primary">{risk.likelihood} — {LIKELIHOOD_LABELS[risk.likelihood]}</div>
          <div className="text-[10.5px] uppercase tracking-wide text-clinicalText-muted">Likelihood</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-50 border border-clinicalBorder">
          <div className="text-sm font-bold text-clinicalText-primary">{risk.severity} — {RISK_SEVERITY_LABELS[risk.severity]}</div>
          <div className="text-[10.5px] uppercase tracking-wide text-clinicalText-muted">Severity</div>
        </div>
      </div>
      {risk.rationale && <p className="text-[12px] text-clinicalText-secondary whitespace-pre-wrap">{risk.rationale}</p>}
      {(risk.assessedBy?.name || risk.assessedAt) && (
        <p className="text-[11px] text-clinicalText-muted">
          Assessed{risk.assessedBy?.name ? ` by ${risk.assessedBy.name}` : ''}
          {risk.assessedAt ? ` on ${new Date(risk.assessedAt).toLocaleDateString()}` : ''}
        </p>
      )}
    </div>
  );
}

/** Reporter answers Quality's open question. */
export function StaffResponsePanel({ incident }: { incident: any }) {
  const { run, busy, error } = useAction(incident._id);
  const [response, setResponse] = useState('');
  const open = [...(incident.infoRequests || [])].reverse().find((r: any) => !r.response);

  return (
    <Card title="Quality needs more information" icon={MessageSquare} tone="action">
      {open && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 whitespace-pre-wrap">
          <strong>Question:</strong> {open.question}
        </div>
      )}
      <div>
        <label className={labelClass}>Your answer *</label>
        <textarea rows={3} value={response} onChange={(e) => setResponse(e.target.value)} className={inputClass} />
      </div>
      <Button busy={busy} disabled={!response.trim()} onClick={() => run(() => api.post(`/incidents/${incident._id}/respond`, { response }))}>
        <Send className="w-4 h-4" /> Send answer to Quality
      </Button>
      {error && <Notice tone="error">{error}</Notice>}
    </Card>
  );
}

/** HOD, on a newly assigned incident: start the investigation, or return it to Quality. */
export function HodAssignedPanel({ incident }: { incident: any }) {
  const { run, busy, error } = useAction(incident._id);
  const [returning, setReturning] = useState(false);
  const [reason, setReason] = useState('');
  const assignment = incident.assignments?.[incident.assignments.length - 1];

  return (
    <Card title="Assigned to your department" icon={Play} tone="action">
      <p className="text-xs text-clinicalText-secondary">
        Quality assigned this incident to you{assignment?.by?.name ? ` (${assignment.by.name})` : ''}.
        {incident.requiresRca ? ' An RCA and CAPA are required.' : incident.requiresCapa ? ' CAPA is required.' : ' No CAPA is required.'}
      </p>
      {assignment?.notifiedDepartmentIds?.length > 0 && (
        <div className="text-xs text-clinicalText-muted">
          <strong className="text-clinicalText-secondary">Also involved:</strong> {assignment.notifiedDepartmentIds.map((d: any) => d.name || d).join(', ')}
        </div>
      )}
      {assignment?.intimatedUserIds?.length > 0 && (
        <div className="text-xs text-clinicalText-muted">
          <strong className="text-clinicalText-secondary">Intimated to (CC):</strong> {assignment.intimatedUserIds.map((u: any) => `${u.name || u}${u.designation ? ` (${u.designation})` : ''}`).join(', ')}
        </div>
      )}
      {assignment?.remarks && <Notice>Quality's remarks: {assignment.remarks}</Notice>}

      {!returning ? (
        <div className="flex flex-wrap gap-2">
          <Button busy={busy} onClick={() => run(() => api.post(`/incidents/${incident._id}/investigation`))}>
            <Play className="w-4 h-4" /> Start investigation
          </Button>
          <Button variant="secondary" onClick={() => setReturning(true)}>
            <Undo2 className="w-4 h-4" /> Not our department
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Why should Quality reassign it? *</label>
            <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" busy={busy} disabled={!reason.trim()} onClick={() => run(() => api.post(`/incidents/${incident._id}/return-to-quality`, { reason }))}>
              <Undo2 className="w-4 h-4" /> Return to Quality
            </Button>
            <Button variant="secondary" onClick={() => setReturning(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </Card>
  );
}

/** HOD submits the finished work for Quality review; shows what is still missing. */
export function SubmitClosurePanel({
  incident,
  investigation,
  rca,
  capas,
}: {
  incident: any;
  investigation: any;
  rca: any;
  capas: any[];
}) {
  const { run, busy, error } = useAction(incident._id);
  const [summary, setSummary] = useState('');

  const checks = [
    { label: 'Investigation completed', ok: investigation?.status === 'COMPLETED' },
    ...(incident.requiresRca ? [{ label: 'RCA completed', ok: rca?.status === 'COMPLETED' }] : []),
    ...(incident.requiresCapa
      ? [
          { label: 'At least one CAPA action', ok: capas.length > 0 },
          { label: 'Every CAPA action marked done', ok: capas.length > 0 && capas.every((c) => c.status !== 'OPEN') },
        ]
      : []),
  ];
  const ready = checks.every((c) => c.ok);
  const lastReturn = incident.qualityReviews?.filter((r: any) => r.decision === 'RETURNED').slice(-1)[0];

  return (
    <Card title="Submit for Quality review" icon={Send} tone="action">
      {lastReturn && (
        <Notice tone="warning">
          <strong>Quality sent this back:</strong> {lastReturn.remarks}
        </Notice>
      )}
      <ul className="space-y-1">
        {checks.map((c) => (
          <li key={c.label} className={`flex items-center gap-2 text-xs ${c.ok ? 'text-emerald-700' : 'text-clinicalText-secondary'}`}>
            {c.ok ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />} {c.label}
          </li>
        ))}
      </ul>
      <div>
        <label className={labelClass}>Closure summary for Quality *</label>
        <textarea
          rows={3}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="What was found, what was changed, and how you know it worked."
          className={inputClass}
        />
      </div>
      <Button busy={busy} disabled={!ready || !summary.trim()} onClick={() => run(() => api.post(`/incidents/${incident._id}/submit-closure`, { summary }))}>
        <Send className="w-4 h-4" /> Submit for review
      </Button>
      {error && <Notice tone="error">{error}</Notice>}
    </Card>
  );
}

/**
 * Once Quality requests an RCA, they've already scheduled the meeting and assigned an RCA Head.
 * Everyone sees the meeting details here. The RCA Head investigates and hands their findings to
 * Quality outside the system — only Quality uploads the report (below) and then closes the
 * incident the normal way, via QualityReviewPanel's Satisfied/Return decision.
 */
export function RcaMeetingPanel({ incident }: { incident: any }) {
  const user = useAuthStore((s) => s.user);
  const isQuality = (user?.roles || []).includes('QUALITY');
  const { run, busy, error } = useAction(incident._id);
  const meetingQuery = useQuery({
    queryKey: ['rca-meeting', incident._id],
    queryFn: () => getOrNull(`/incidents/${incident._id}/rca-meeting`),
  });
  const meeting = meetingQuery.data;

  const [summary, setSummary] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    setUploading(true);
    try {
      for (const file of files) {
        const uploaded = await uploadFile(file, 'RCA');
        setEvidenceFiles((prev) => [...prev, uploaded]);
      }
    } catch (err: any) {
      toast.error(errorMessage(err, 'File upload failed'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const submitReport = () =>
    run(() =>
      api.post(`/incidents/${incident._id}/rca-meeting/report`, {
        summary: summary.trim() || undefined,
        evidence: evidenceFiles.map((f) => f._id),
      })
    );

  const isCompleted = meeting?.status === 'COMPLETED';

  return (
    <Card title={isCompleted ? 'RCA Meeting' : 'RCA Requested by Quality'} icon={GitBranch} tone={isCompleted ? 'default' : 'action'}>
      <div className="p-3.5 rounded-xl bg-purple-50/80 border border-purple-200 text-xs text-purple-950 space-y-2">
        <div className="flex items-center gap-2 font-bold text-purple-900">
          <GitBranch className="w-4 h-4 text-purple-600 shrink-0" />
          <span>Quality requested a Root Cause Analysis (RCA) meeting</span>
        </div>
        {incident.rcaRequestRemarks && (
          <p className="text-[12.5px] text-purple-900/90 whitespace-pre-wrap">
            <strong>Quality's reason / instructions:</strong> {incident.rcaRequestRemarks}
          </p>
        )}
        <div className="text-[11.5px] text-purple-800 flex flex-wrap gap-x-4 gap-y-1 pt-1 border-t border-purple-200/60">
          {incident.rcaRequestedBy?.name && (
            <span>
              <strong>Requested by:</strong> {incident.rcaRequestedBy.name}
            </span>
          )}
          {incident.rcaHeadId?.name && (
            <span>
              <strong>Assigned to:</strong> {incident.rcaHeadId.name}
            </span>
          )}
          {incident.rcaRequestedAt && (
            <span>
              <strong>Requested at:</strong> {new Date(incident.rcaRequestedAt).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {!meeting ? (
        <Notice tone="warning">Meeting details aren't available yet.</Notice>
      ) : (
        <div className="space-y-3">
          <div className="p-3 rounded-xl border border-clinicalBorder bg-white space-y-1.5 text-xs">
            <div className="flex items-center gap-2 font-semibold text-clinicalText-primary">
              <Calendar className="w-4 h-4 text-purple-700 shrink-0" />
              {new Date(meeting.meetingAt).toLocaleString()} — {meeting.location}
            </div>
            {meeting.notes && <p className="text-clinicalText-secondary whitespace-pre-wrap">{meeting.notes}</p>}
            {meeting.attendeeIds?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {meeting.attendeeIds.map((a: any) => (
                  <span key={a._id} className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-clinicalText-primary text-[11.5px] font-medium">
                    {a.name}
                    {a.designation ? ` — ${a.designation}` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>

          {meeting.status === 'COMPLETED' ? (
            <div className="space-y-2">
              <Notice tone="success">
                Report uploaded{meeting.reportUploadedBy?.name ? ` by ${meeting.reportUploadedBy.name}` : ''}
                {meeting.reportUploadedAt ? ` on ${new Date(meeting.reportUploadedAt).toLocaleString()}` : ''}.
              </Notice>
              {meeting.reportSummary && (
                <div className="p-3 rounded-xl border border-clinicalBorder bg-white text-xs">
                  <div className="text-[10.5px] font-bold uppercase tracking-wider text-clinicalText-muted mb-0.5">Summary</div>
                  <p className="text-clinicalText-primary whitespace-pre-wrap">{meeting.reportSummary}</p>
                </div>
              )}
              {meeting.evidence?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {meeting.evidence.map((f: any) => (
                    <button
                      key={f._id}
                      type="button"
                      onClick={() => openAttachment(f).catch(() => toast.error('Could not open the file'))}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-clinicalBorder rounded-lg text-xs text-[#5C1A22] hover:bg-[#FAF3EC] cursor-pointer"
                    >
                      <Paperclip className="w-3.5 h-3.5" /> {f.originalName}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : !isQuality ? (
            <Notice tone="info">Investigate during the meeting, then hand your findings to Quality — they'll upload the report and close the incident.</Notice>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-clinicalText-secondary font-medium">Once the RCA Head hands you their findings, upload the report here.</p>
              <div>
                <label className={labelClass}>Summary (optional)</label>
                <textarea
                  rows={3}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Root cause findings and recommendations from the meeting..."
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Meeting report *</label>
                <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-dashed border-clinicalBorder rounded-lg text-xs text-clinicalText-secondary hover:bg-slate-100 cursor-pointer transition w-fit">
                  <Upload className="w-3.5 h-3.5" />
                  {uploading ? 'Uploading...' : 'Upload report (PDF, DOCX, PNG, JPG up to 10MB)'}
                  <input type="file" multiple onChange={handleFileUpload} disabled={uploading} className="hidden" />
                </label>
                {evidenceFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {evidenceFiles.map((f) => (
                      <button
                        key={f._id}
                        type="button"
                        onClick={() => openAttachment(f).catch(() => toast.error('Could not open the file'))}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-clinicalBorder rounded-lg text-xs text-[#5C1A22] hover:bg-[#FAF3EC] cursor-pointer"
                      >
                        <Paperclip className="w-3.5 h-3.5" /> {f.originalName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button
                variant="primary"
                busy={busy}
                disabled={evidenceFiles.length === 0}
                onClick={submitReport}
                className="bg-purple-700 hover:bg-purple-800 text-white"
              >
                <Send className="w-4 h-4" /> Submit
              </Button>
            </div>
          )}
        </div>
      )}

      {error && <Notice tone="error">{error}</Notice>}
    </Card>
  );
}

/** Shown when the current user has nothing to do on this incident. */
export function WaitingNotice({ incident, isStaff }: { incident: any; isStaff: boolean }) {
  const meta = statusMeta(incident.status);

  if (incident.status === 'REJECTED') {
    return (
      <Notice tone="info">
        <strong>Closed by Quality.</strong> {incident.rejection?.reason}
      </Notice>
    );
  }
  if (incident.status === 'CLOSED') {
    return (
      <div className="space-y-2">
        <Notice tone="success">
          <strong>Closed{incident.closedAt ? ` on ${new Date(incident.closedAt).toLocaleDateString()}` : ''}.</strong>{' '}
          {incident.closureRemarks}
        </Notice>
        {incident.qualityScore && <QualityScoreSummary score={incident.qualityScore} />}
        {incident.riskAssessment && <RiskAssessmentSummary risk={incident.riskAssessment} />}
      </div>
    );
  }
  const additionalDepts = incident.notifiedDepartmentIds?.length
    ? ` (Involved: ${incident.notifiedDepartmentIds.map((d: any) => d.name || d).join(', ')})`
    : '';

  return (
    <div className="flex items-center gap-2 p-3 rounded-xl border border-clinicalBorder bg-white text-xs text-clinicalText-secondary shadow-card">
      <Clock className="w-4 h-4 text-maroon-700" />
      <span>
        {meta.waitingOn}
        {!isStaff && incident.departmentId?.name && ['ASSIGNED', 'UNDER_INVESTIGATION', 'CAPA_IN_PROGRESS'].includes(incident.status)
          ? ` — ${incident.departmentId.name}${incident.assignedHod?.name ? `, ${incident.assignedHod.name}` : ''}${additionalDepts ? ` · ${additionalDepts}` : ''}`
          : ''}
        {isStaff && incident.departmentId?.name ? ` — ${incident.departmentId.name}${additionalDepts ? ` · ${additionalDepts}` : ''}` : ''}.
      </span>
    </div>
  );
}
