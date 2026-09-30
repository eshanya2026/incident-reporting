import { useEffect, useState } from 'react';
import { CheckSquare, Save } from 'lucide-react';
import { api } from '../../../lib/api';
import { useAction } from '../../../lib/useAction';
import { Button, Card, EditToggle, Notice, inputClass, labelClass } from '../../ui/primitives';
import { toast } from '../../../store/useToastStore';

/**
 * CAPA section: Responsible HOD fills in Corrective Action (CA) and Preventive Action (PA).
 * Editable during CAPA_IN_PROGRESS stage; shown read-only with Edit button once saved.
 */
export default function CapaSection({
  incident,
  capas,
  editable,
}: {
  incident: any;
  capas: any[];
  editable: boolean;
}) {
  const { run, busy, error } = useAction(incident._id);

  const existingCA = capas.find((c) => c.type === 'CORRECTIVE')?.action || '';
  const existingPA = capas.find((c) => c.type === 'PREVENTIVE')?.action || '';

  const [ca, setCa] = useState(existingCA);
  const [pa, setPa] = useState(existingPA);

  const hasSaved = Boolean(existingCA || existingPA);
  const [editing, setEditing] = useState(editable && !hasSaved);

  useEffect(() => {
    const loadedCA = capas.find((c) => c.type === 'CORRECTIVE')?.action || '';
    const loadedPA = capas.find((c) => c.type === 'PREVENTIVE')?.action || '';
    setCa(loadedCA);
    setPa(loadedPA);
    if (!loadedCA && !loadedPA && editable) {
      setEditing(true);
    }
  }, [capas, editable]);

  // If read-only and no CAPA has been written yet, don't display
  if (!editable && !hasSaved) return null;

  const handleSave = async () => {
    if (!ca.trim()) return;
    const ok = await run(() =>
      api.post(`/incidents/${incident._id}/capas`, {
        correctiveAction: ca.trim(),
        preventiveAction: pa.trim(),
      })
    );
    if (ok) {
      setEditing(false);
      toast.success('CAPA saved successfully');
    }
  };

  return (
    <Card
      title="Corrective & Preventive Actions (CAPA)"
      icon={CheckSquare}
      tone={editable && editing ? 'action' : 'default'}
      actions={
        <div className="flex items-center gap-2">
          {editable && !editing && <EditToggle onClick={() => setEditing(true)} />}
          <span
            className={`text-[11.5px] font-bold uppercase px-2 py-0.5 rounded-full border ${
              hasSaved
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            {hasSaved ? 'Saved' : 'Required'}
          </span>
        </div>
      }
    >
      {editable && editing ? (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Corrective Action (CA) *</label>
            <textarea
              rows={3}
              value={ca}
              onChange={(e) => setCa(e.target.value)}
              placeholder="Action taken to eliminate the direct cause and rectify the incident..."
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Preventive Action (PA)</label>
            <textarea
              rows={3}
              value={pa}
              onChange={(e) => setPa(e.target.value)}
              placeholder="Systemic action taken to prevent recurrence across the department or hospital..."
              className={inputClass}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              busy={busy}
              disabled={!ca.trim() || ca.trim().length < 3}
              onClick={handleSave}
            >
              <Save className="w-4 h-4" /> Save CAPA
            </Button>
            {hasSaved && (
              <Button
                variant="secondary"
                onClick={() => {
                  setCa(existingCA);
                  setPa(existingPA);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            )}
          </div>
          {error && <Notice tone="error">{error}</Notice>}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-clinicalBorder space-y-1">
            <div className="text-[12px] font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
              Corrective Action (CA)
            </div>
            <div className="text-xs text-clinicalText-primary whitespace-pre-wrap pl-3.5">
              {ca || '—'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-clinicalBorder space-y-1">
            <div className="text-[12px] font-bold uppercase tracking-wider text-purple-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-600 inline-block"></span>
              Preventive Action (PA)
            </div>
            <div className="text-xs text-clinicalText-primary whitespace-pre-wrap pl-3.5">
              {pa || '—'}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
