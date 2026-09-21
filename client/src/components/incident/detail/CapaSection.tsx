import { useState } from 'react';
import dayjs from 'dayjs';
import { CheckSquare, Plus, CheckCircle2, Paperclip, X } from 'lucide-react';
import { api } from '../../../lib/api';
import { useAction } from '../../../lib/useAction';
import { openAttachment, uploadFile } from '../../../lib/files';
import { CapaStatusBadge } from '../Badges';
import { Button, Card, Notice, inputClass, labelClass } from '../../ui/primitives';
import { toast } from '../../../store/useToastStore';
import { SearchableSelect } from '../../ui/SearchableSelect';

const today = () => dayjs().format('YYYY-MM-DD');

function AttachmentLinks({ files }: { files: any[] }) {
  if (!files?.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {files.map((f: any) => (
        <button
          key={f._id}
          type="button"
          onClick={() => openAttachment(f).catch(() => toast.error('Could not open the file'))}
          className="inline-flex items-center gap-1 text-[11px] text-[#8B1E23] hover:underline cursor-pointer"
        >
          <Paperclip className="w-3 h-3" /> {f.originalName || 'Evidence'}
        </button>
      ))}
    </div>
  );
}

/** HOD marks one CAPA done, with remarks and optional evidence files. */
function MarkDoneForm({ incidentId, capa, onDone }: { incidentId: string; capa: any; onDone: () => void }) {
  const { run, busy, error, setError } = useAction(incidentId);
  const [remarks, setRemarks] = useState('');
  const [files, setFiles] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    setUploading(true);
    try {
      for (const f of Array.from(list)) {
        const uploaded = await uploadFile(f, 'CAPA');
        setFiles((prev) => [...prev, uploaded]);
      }
    } catch (err: any) {
      setError(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-clinicalBorder space-y-2">
      <label className={labelClass}>What was done? *</label>
      <textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} className={inputClass} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1 text-xs font-semibold text-[#8B1E23] cursor-pointer">
          <Paperclip className="w-3.5 h-3.5" /> {uploading ? 'Uploading…' : 'Attach evidence'}
          <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" className="hidden" onChange={(e) => addFiles(e.target.files)} />
        </label>
        {files.map((f) => (
          <span key={f._id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-clinicalBorder rounded text-[11px]">
            {f.originalName}
            <button type="button" onClick={() => setFiles(files.filter((x) => x._id !== f._id))} className="cursor-pointer">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <Button
        variant="success"
        busy={busy}
        disabled={remarks.trim().length < 3 || uploading}
        onClick={async () => {
          const ok = await run(() => api.post(`/capas/${capa._id}/done`, { completionRemarks: remarks, evidence: files.map((f) => f._id) }));
          if (ok) onDone();
        }}
      >
        <CheckCircle2 className="w-4 h-4" /> Mark done
      </Button>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}

function AddCapaForm({ incidentId }: { incidentId: string }) {
  const { run, busy, error } = useAction(incidentId);
  const [type, setType] = useState<'CORRECTIVE' | 'PREVENTIVE'>('CORRECTIVE');
  const [action, setAction] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [targetDate, setTargetDate] = useState('');

  return (
    <div className="p-4 rounded-xl border border-dashed border-[#8B1E23]/40 bg-[#FFFBFB] space-y-3">
      <div className="text-xs font-bold text-clinicalText-primary">Add a CAPA action</div>
      <div>
        <label className={labelClass}>Action *</label>
        <textarea rows={2} value={action} onChange={(e) => setAction(e.target.value)} placeholder="e.g. Introduce a two-nurse check for IV antibiotics" className={inputClass} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>Type</label>
          <SearchableSelect
            value={type}
            onChange={(v) => setType(v as any)}
            options={[
              { value: 'CORRECTIVE', label: 'Corrective' },
              { value: 'PREVENTIVE', label: 'Preventive' },
            ]}
            searchPlaceholder="Search..."
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Priority</label>
          <SearchableSelect
            value={priority}
            onChange={setPriority}
            options={['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((p) => ({ value: p, label: p.charAt(0) + p.slice(1).toLowerCase() }))}
            searchPlaceholder="Search..."
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Target date *</label>
          <input type="date" min={today()} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className={inputClass} />
        </div>
      </div>
      <Button
        busy={busy}
        disabled={action.trim().length < 3 || !targetDate}
        onClick={async () => {
          const ok = await run(() => api.post(`/incidents/${incidentId}/capas`, { type, action, priority, targetDate }));
          if (ok) {
            setAction('');
            setTargetDate('');
          }
        }}
      >
        <Plus className="w-4 h-4" /> Add CAPA
      </Button>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}

/** CAPA actions for an incident: the responsible HOD adds and completes them; others read. */
export default function CapaSection({ incident, capas, editable }: { incident: any; capas: any[]; editable: boolean }) {
  const [doneFormFor, setDoneFormFor] = useState<string | null>(null);

  if (!editable && capas.length === 0) return null;

  return (
    <Card title={`CAPA Actions (${capas.length})`} icon={CheckSquare} tone={editable ? 'action' : 'default'}>
      {capas.length === 0 && <p className="text-xs text-clinicalText-muted">No CAPA actions yet.</p>}
      <div className="space-y-3">
        {capas.map((c) => {
          const overdue = c.status === 'OPEN' && dayjs().isAfter(dayjs(c.targetDate), 'day');
          const sentBack = c.status === 'OPEN' && c.verification && c.verification.effective === false;
          return (
            <div key={c._id} className="p-4 rounded-xl border border-clinicalBorder bg-white">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-clinicalText-primary">
                    <span className="font-mono text-maroon-700 mr-2">{c.capaNumber}</span>
                    {c.action}
                  </div>
                  <div className="text-[11px] text-clinicalText-muted mt-1">
                    {c.type === 'CORRECTIVE' ? 'Corrective' : 'Preventive'} · {c.priority} priority · Target {dayjs(c.targetDate).format('DD MMM YYYY')}
                    {overdue && <span className="ml-1 font-bold text-red-700">· Overdue</span>}
                  </div>
                </div>
                <CapaStatusBadge status={c.status} />
              </div>
              {sentBack && (
                <Notice tone="warning">
                  <strong>Quality found this not effective:</strong> {c.verification.remarks}
                </Notice>
              )}
              {c.completionRemarks && c.status !== 'OPEN' && (
                <div className="mt-2 text-xs text-clinicalText-secondary">
                  <strong>Done:</strong> {c.completionRemarks}
                  <AttachmentLinks files={c.evidence} />
                </div>
              )}
              {c.status === 'EFFECTIVE' && c.verification?.remarks && (
                <div className="mt-1 text-xs text-emerald-700">
                  <strong>Quality:</strong> {c.verification.remarks}
                </div>
              )}
              {editable && c.status === 'OPEN' && (
                doneFormFor === c._id ? (
                  <MarkDoneForm incidentId={incident._id} capa={c} onDone={() => setDoneFormFor(null)} />
                ) : (
                  <Button variant="secondary" className="mt-3" onClick={() => setDoneFormFor(c._id)}>
                    <CheckCircle2 className="w-4 h-4" /> Mark done…
                  </Button>
                )
              )}
            </div>
          );
        })}
      </div>
      {editable && <AddCapaForm incidentId={incident._id} />}
    </Card>
  );
}
