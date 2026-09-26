import { useEffect, useState } from 'react';
import { Microscope, Save, CheckCircle2 } from 'lucide-react';
import { api } from '../../../lib/api';
import { useAction } from '../../../lib/useAction';
import { Button, Card, EditToggle, Field, Notice, inputClass, labelClass } from '../../ui/primitives';

const FIELDS = [
  { key: 'facts', label: 'Established facts', rows: 3 },
  { key: 'chronology', label: 'Timeline of events', rows: 3 },
  { key: 'immediateCorrections', label: 'Immediate corrections made', rows: 2 },
  { key: 'findings', label: 'Findings *', rows: 3 },
  { key: 'recommendation', label: 'Recommendation', rows: 2 },
] as const;

type FormState = Record<(typeof FIELDS)[number]['key'], string> & { contributingFactors: string };

const toForm = (inv: any): FormState => ({
  facts: inv?.facts || '',
  chronology: inv?.chronology || '',
  immediateCorrections: inv?.immediateCorrections || '',
  findings: inv?.findings || '',
  recommendation: inv?.recommendation || '',
  contributingFactors: (inv?.contributingFactors || []).join(', '),
});


/**
 * Investigation record: editable by the responsible HOD while investigating; in the CAPA stage it is
 * shown read-only with an Edit button. Read-only for everyone else.
 */
export default function InvestigationSection({
  incident,
  investigation,
  rca,
  editable,
}: {
  incident: any;
  investigation: any;
  rca: any;
  editable: boolean;
}) {
  const { run, busy, error } = useAction(incident._id);
  const [form, setForm] = useState<FormState>(toForm(investigation));
  const [editing, setEditing] = useState(incident.status === 'UNDER_INVESTIGATION');
  useEffect(() => setEditing(incident.status === 'UNDER_INVESTIGATION'), [incident.status]);
  useEffect(() => setForm(toForm(investigation)), [investigation?._id, investigation?.updatedAt]);

  if (!investigation) return null;

  const payload = () => ({
    ...Object.fromEntries(FIELDS.map((f) => [f.key, form[f.key]])),
    contributingFactors: form.contributingFactors
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  });
  const completed = investigation.status === 'COMPLETED';
  const rcaMissing = incident.requiresRca && rca?.status !== 'COMPLETED';
  const canComplete = editable && incident.status === 'UNDER_INVESTIGATION' && !completed;

  return (
    <Card
      title="Investigation"
      icon={Microscope}
      tone={canComplete ? 'action' : 'default'}
      actions={
        <div className="flex items-center gap-2">
          {editable && !editing && <EditToggle onClick={() => setEditing(true)} />}
          <span className={`text-[11.5px] font-bold uppercase px-2 py-0.5 rounded-full border ${completed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-sky-50 text-sky-700 border-sky-200'}`}>
            {completed ? 'Completed' : 'In progress'}
          </span>
        </div>
      }
    >
      {editable && editing ? (
        <div className="space-y-3">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className={labelClass}>{f.label}</label>
              <textarea rows={f.rows} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} className={inputClass} />
            </div>
          ))}
          <div>
            <label className={labelClass}>Contributing factors (comma separated)</label>
            <input
              value={form.contributingFactors}
              onChange={(e) => setForm({ ...form, contributingFactors: e.target.value })}
              placeholder="e.g. Staffing, Handover, Labelling"
              className={inputClass}
            />
          </div>
          {canComplete && rcaMissing && <Notice tone="warning">Complete the RCA below before completing the investigation (required for severity 4 and 5).</Notice>}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              busy={busy}
              onClick={async () => {
                const ok = await run(() => api.patch(`/investigations/${investigation._id}`, payload()));
                if (ok && incident.status !== 'UNDER_INVESTIGATION') setEditing(false);
              }}
            >
              <Save className="w-4 h-4" /> {incident.status === 'UNDER_INVESTIGATION' ? 'Save draft' : 'Save changes'}
            </Button>
            {incident.status !== 'UNDER_INVESTIGATION' && (
              <Button variant="secondary" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
            {canComplete && (
              <Button
                variant="success"
                busy={busy}
                disabled={!form.findings.trim() || rcaMissing}
                onClick={() => run(() => api.post(`/investigations/${investigation._id}/complete`, payload()))}
              >
                <CheckCircle2 className="w-4 h-4" />
                {incident.requiresCapa ? 'Complete investigation and move to CAPA' : 'Complete investigation'}
              </Button>
            )}
          </div>
          {error && <Notice tone="error">{error}</Notice>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FIELDS.map((f) => (
            <Field key={f.key} label={f.label.replace(' *', '')}>
              {investigation[f.key]}
            </Field>
          ))}
          <Field label="Contributing factors">{(investigation.contributingFactors || []).join(', ')}</Field>
          <Field label="Investigator">{investigation.investigatorId?.name}</Field>
        </div>
      )}
    </Card>
  );
}
