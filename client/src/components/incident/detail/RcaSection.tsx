import { useEffect, useState } from 'react';
import { GitBranch, Save, CheckCircle2 } from 'lucide-react';
import { api } from '../../../lib/api';
import { useAction } from '../../../lib/useAction';
import { Button, Card, EditToggle, Field, Notice, inputClass, labelClass } from '../../ui/primitives';

const DEFAULT_QUESTIONS = [
  'Why did the event occur?',
  'Why did that happen?',
  'Why was that condition present?',
  'Why was it not prevented?',
  'What is the underlying system cause?',
];

const toRows = (rca: any) =>
  DEFAULT_QUESTIONS.map((q, i) => ({
    question: rca?.fiveWhy?.[i]?.question || q,
    answer: rca?.fiveWhy?.[i]?.answer || '',
  }));


/**
 * 5-Why root cause analysis, written by the responsible HOD (required for severity 4 and 5).
 * Once completed and past the investigation stage it is shown read-only with an Edit button.
 */
export default function RcaSection({ incident, rca, editable }: { incident: any; rca: any; editable: boolean }) {
  const { run, busy, error } = useAction(incident._id);
  const [rows, setRows] = useState(toRows(rca));
  const [summary, setSummary] = useState(rca?.rootCauseSummary || '');
  const startEditing = () => !rca || rca.status !== 'COMPLETED' || incident.status === 'UNDER_INVESTIGATION';
  const [editing, setEditing] = useState(startEditing());
  useEffect(() => setEditing(startEditing()), [incident.status, rca?.status]);
  useEffect(() => {
    setRows(toRows(rca));
    setSummary(rca?.rootCauseSummary || '');
  }, [rca?._id, rca?.updatedAt]);

  if (!rca && !editable) return null;

  const save = (status: 'DRAFT' | 'COMPLETED') =>
    run(() =>
      api.post(`/incidents/${incident._id}/rca`, {
        method: 'FIVE_WHY',
        fiveWhy: rows
          .map((r, i) => ({ sequence: i + 1, question: r.question, answer: r.answer.trim() }))
          .filter((r) => r.answer),
        rootCauseSummary: summary,
        status,
      })
    );

  return (
    <Card
      title={`Root Cause Analysis (5-Why)${incident.requiresRca ? ' — required' : ''}`}
      icon={GitBranch}
      actions={
        <div className="flex items-center gap-2">
          {editable && !editing && <EditToggle onClick={() => setEditing(true)} />}
          {rca && (
            <span className={`text-[11.5px] font-bold uppercase px-2 py-0.5 rounded-full border ${rca.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
              {rca.status === 'COMPLETED' ? 'Completed' : 'Draft'}
            </span>
          )}
        </div>
      }
    >
      {editable && editing ? (
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-start">
              <label className="md:col-span-2 text-xs font-semibold text-clinicalText-secondary pt-2">
                {i + 1}. {r.question}
              </label>
              <input
                value={r.answer}
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))}
                className={`${inputClass} md:col-span-3`}
              />
            </div>
          ))}
          <div>
            <label className={labelClass}>Root cause summary *</label>
            <textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} className={inputClass} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" busy={busy} disabled={summary.trim().length < 3} onClick={() => save('DRAFT')}>
              <Save className="w-4 h-4" /> Save draft
            </Button>
            <Button variant="success" busy={busy} disabled={summary.trim().length < 3} onClick={() => save('COMPLETED')}>
              <CheckCircle2 className="w-4 h-4" /> Save as completed
            </Button>
          </div>
          {error && <Notice tone="error">{error}</Notice>}
        </div>
      ) : (
        <div className="space-y-2">
          {(rca.fiveWhy || []).map((w: any) => (
            <div key={w.sequence} className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs">
              <div className="font-semibold text-clinicalText-secondary">
                {w.sequence}. {w.question}
              </div>
              <div className="text-clinicalText-primary mt-0.5">{w.answer}</div>
            </div>
          ))}
          <Field label="Root cause summary">{rca.rootCauseSummary}</Field>
        </div>
      )}
    </Card>
  );
}
