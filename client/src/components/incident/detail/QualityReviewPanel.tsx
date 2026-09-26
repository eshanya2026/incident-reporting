import { useState } from 'react';
import { ClipboardCheck, CheckCircle2, Undo2 } from 'lucide-react';
import { api } from '../../../lib/api';
import { useAction } from '../../../lib/useAction';
import { Button, Card, Notice, inputClass, labelClass } from '../../ui/primitives';

type Verdict = { effective: boolean | null; remarks: string };

/**
 * Quality's final review: a verdict for every CAPA the HOD marked done, then either close
 * the incident (all effective) or send it back to the HOD.
 */
export default function QualityReviewPanel({ incident, capas }: { incident: any; capas: any[] }) {
  const { run, busy, error } = useAction(incident._id);
  const toReview = capas.filter((c) => c.status === 'DONE');
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [remarks, setRemarks] = useState('');

  const verdict = (id: string): Verdict => verdicts[id] ?? { effective: null, remarks: '' };
  const setVerdict = (id: string, patch: Partial<Verdict>) => setVerdicts({ ...verdicts, [id]: { ...verdict(id), ...patch } });

  const allDecided = toReview.every((c) => verdict(c._id).effective !== null);
  const allEffective = toReview.every((c) => verdict(c._id).effective === true);
  const capaResults = toReview.map((c) => ({
    capaId: c._id,
    effective: Boolean(verdict(c._id).effective),
    remarks: verdict(c._id).remarks || undefined,
  }));

  const submit = (decision: 'ACCEPT' | 'RETURN') =>
    run(() => api.post(`/incidents/${incident._id}/review`, { decision, remarks, capaResults }));

  return (
    <Card title="Quality review" icon={ClipboardCheck} tone="action">
      {incident.closureSubmission && (
        <Notice>
          <strong>HOD's closure summary{incident.closureSubmission.by?.name ? ` (${incident.closureSubmission.by.name})` : ''}:</strong>{' '}
          {incident.closureSubmission.summary}
        </Notice>
      )}
      <p className="text-xs text-clinicalText-secondary">Check the investigation, RCA and CAPA below, then give a verdict for each completed CAPA.</p>

      {toReview.map((c) => {
        const v = verdict(c._id);
        return (
          <div key={c._id} className="p-3 rounded-xl border border-clinicalBorder bg-white space-y-2">
            <div className="text-xs font-semibold text-clinicalText-primary">
              <span className="font-mono text-maroon-700 mr-2">{c.capaNumber}</span>
              {c.action}
            </div>
            <div className="text-[12.5px] text-clinicalText-secondary">Done: {c.completionRemarks}</div>
            <div className="flex flex-wrap gap-2">
              {[
                { value: true, label: 'Effective', on: 'bg-emerald-600 text-white border-emerald-600' },
                { value: false, label: 'Not effective', on: 'bg-red-600 text-white border-red-600' },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => setVerdict(c._id, { effective: o.value })}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border cursor-pointer transition ${
                    v.effective === o.value ? o.on : 'bg-white text-clinicalText-secondary border-clinicalBorder hover:bg-slate-50'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {v.effective === false && (
              <input
                value={v.remarks}
                onChange={(e) => setVerdict(c._id, { remarks: e.target.value })}
                placeholder="What is missing or needs to change?"
                className={inputClass}
              />
            )}
          </div>
        );
      })}
      {toReview.length === 0 && capas.length === 0 && <p className="text-xs text-clinicalText-muted">No CAPA was required for this incident.</p>}

      <div>
        <label className={labelClass}>{allEffective ? 'Closure remarks *' : 'Remarks for the HOD *'}</label>
        <textarea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} className={inputClass} />
        <p className="mt-1 text-[12.5px] text-clinicalText-secondary">
          {allEffective
            ? 'If you close the incident, these remarks are shown to the staff member who reported it.'
            : 'These remarks go to the HOD with the incident.'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="success" busy={busy} disabled={!allDecided || !allEffective || !remarks.trim()} onClick={() => submit('ACCEPT')}>
          <CheckCircle2 className="w-4 h-4" /> Close incident
        </Button>
        <Button variant="danger" busy={busy} disabled={!allDecided || !remarks.trim()} onClick={() => submit('RETURN')}>
          <Undo2 className="w-4 h-4" /> Send back to HOD
        </Button>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </Card>
  );
}
