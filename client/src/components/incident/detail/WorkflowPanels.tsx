import { useState } from 'react';
import { CheckCircle2, Circle, Clock, MessageSquare, Play, Send, Undo2, GitBranch, BarChart3 } from 'lucide-react';
import { api } from '../../../lib/api';
import { useAction } from '../../../lib/useAction';
import { statusMeta, scoreBand } from '../../../lib/incidentMeta';
import { Button, Card, Notice, inputClass, labelClass } from '../../ui/primitives';

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

/** Quality Member: conduct RCA and report back to Quality */
export function QualityMemberRcaPanel({ incident, rca }: { incident: any; rca: any }) {
  const { run, busy, error } = useAction(incident._id);
  const [remarks, setRemarks] = useState('');
  const rcaReady = rca?.status === 'COMPLETED' && Boolean(rca?.rootCauseSummary?.trim());

  return (
    <Card title="RCA Requested by Quality" icon={GitBranch} tone="action">
      <div className="p-3.5 rounded-xl bg-purple-50/80 border border-purple-200 text-xs text-purple-950 space-y-2">
        <div className="flex items-center gap-2 font-bold text-purple-900">
          <GitBranch className="w-4 h-4 text-purple-600 shrink-0" />
          <span>Quality requested a Root Cause Analysis (RCA)</span>
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
          {incident.assignedQualityMemberId?.name && (
            <span>
              <strong>Assigned to:</strong> {incident.assignedQualityMemberId.name}
            </span>
          )}
          {incident.rcaRequestedAt && (
            <span>
              <strong>Requested at:</strong> {new Date(incident.rcaRequestedAt).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2 text-xs">
        <p className="text-clinicalText-secondary font-medium">
          Investigate the root causes, complete the 5-Why analysis in the RCA section below, and report your findings back to Quality.
        </p>
        <div className="flex items-center gap-2 p-2.5 rounded-lg border border-clinicalBorder bg-white">
          {rcaReady ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <Circle className="w-4 h-4 text-slate-400 shrink-0" />
          )}
          <span className={`text-[12.5px] ${rcaReady ? 'text-emerald-800 font-semibold' : 'text-slate-600'}`}>
            {rcaReady
              ? 'Root Cause Analysis completed with summary'
              : 'Complete and save the 5-Why RCA below as "Completed"'}
          </span>
        </div>
      </div>

      <div>
        <label className={labelClass}>Reporting remarks for Quality (optional)</label>
        <textarea
          rows={3}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Summarize your RCA findings, identified system vulnerabilities, or recommendations for Quality..."
          className={inputClass}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          busy={busy}
          disabled={!rcaReady}
          onClick={() => run(() => api.post(`/incidents/${incident._id}/submit-rca`, { remarks }))}
          className="bg-purple-700 hover:bg-purple-800 text-white"
        >
          <Send className="w-4 h-4" /> Report RCA to Quality
        </Button>
        {!rcaReady && (
          <span className="text-[11.5px] text-amber-700 font-medium">
            Save the 5-Why RCA section below first to enable reporting.
          </span>
        )}
      </div>

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
