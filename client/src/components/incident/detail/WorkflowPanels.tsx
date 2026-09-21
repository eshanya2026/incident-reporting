import { useState } from 'react';
import { CheckCircle2, Circle, Clock, MessageSquare, Play, Send, Undo2 } from 'lucide-react';
import { api } from '../../../lib/api';
import { useAction } from '../../../lib/useAction';
import { statusMeta } from '../../../lib/incidentMeta';
import { Button, Card, Notice, inputClass, labelClass } from '../../ui/primitives';

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

/** Shown when the current user has nothing to do on this incident. */
export function WaitingNotice({ incident, isStaff }: { incident: any; isStaff: boolean }) {
  const meta = statusMeta(incident.status);

  if (incident.status === 'REJECTED') {
    return (
      <Notice tone="info">
        <strong>Rejected by Quality.</strong> {incident.rejection?.reason}
      </Notice>
    );
  }
  if (incident.status === 'CLOSED') {
    return (
      <Notice tone="success">
        <strong>Closed{incident.closedAt ? ` on ${new Date(incident.closedAt).toLocaleDateString()}` : ''}.</strong> {incident.closureRemarks}
      </Notice>
    );
  }
  return (
    <div className="flex items-center gap-2 p-3 rounded-xl border border-clinicalBorder bg-white text-xs text-clinicalText-secondary shadow-card">
      <Clock className="w-4 h-4 text-maroon-700" />
      <span>
        {meta.waitingOn}
        {!isStaff && incident.departmentId?.name && ['ASSIGNED', 'UNDER_INVESTIGATION', 'CAPA_IN_PROGRESS'].includes(incident.status)
          ? ` — ${incident.departmentId.name}${incident.assignedHod?.name ? `, ${incident.assignedHod.name}` : ''}`
          : ''}
        {isStaff && incident.departmentId?.name ? ` — ${incident.departmentId.name}` : ''}.
      </span>
    </div>
  );
}
