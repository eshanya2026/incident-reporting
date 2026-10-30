import { useEffect, useState } from 'react';
import { CheckSquare, Paperclip, Save, Upload, X } from 'lucide-react';
import { api } from '../../../lib/api';
import { useAction } from '../../../lib/useAction';
import { Button, Card, EditToggle, Notice, inputClass, labelClass } from '../../ui/primitives';
import { toast } from '../../../store/useToastStore';
import { openAttachment, uploadFile } from '../../../lib/files';
import { errorMessage } from '../../../lib/useAction';
import { useAuthStore } from '../../../store/useAuthStore';

const idOf = (v: any): string | undefined => (v ? (v._id ?? v).toString() : undefined);

/** Evidence files from both CA and PA records, deduplicated — they're attached as one shared list. */
const evidenceOf = (capas: any[]): any[] => {
  const seen = new Map<string, any>();
  for (const c of capas) {
    for (const f of c.evidence || []) {
      if (f?._id) seen.set(f._id, f);
    }
  }
  return [...seen.values()];
};

/**
 * CAPA section: each involved department's HOD fills in their own Corrective Action (CA) and
 * Preventive Action (PA) — other departments' CAPAs are left for Quality's comparison view.
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
  const user = useAuthStore((state) => state.user);
  const myCapas = capas.filter((c) => idOf(c.ownerDepartmentId) === idOf(user?.departmentId));
  const multiDept = (incident.notifiedDepartmentIds?.length || 0) > 0;
  const myDeptName =
    idOf(incident.departmentId) === idOf(user?.departmentId)
      ? incident.departmentId?.name
      : incident.notifiedDepartmentIds?.find((d: any) => idOf(d) === idOf(user?.departmentId))?.name;

  const existingCA = myCapas.find((c) => c.type === 'CORRECTIVE')?.action || '';
  const existingPA = myCapas.find((c) => c.type === 'PREVENTIVE')?.action || '';

  const [ca, setCa] = useState(existingCA);
  const [pa, setPa] = useState(existingPA);
  const [evidenceFiles, setEvidenceFiles] = useState<any[]>(evidenceOf(myCapas));
  const [uploading, setUploading] = useState(false);

  const hasSaved = Boolean(existingCA || existingPA);
  const [editing, setEditing] = useState(editable && !hasSaved);

  useEffect(() => {
    const loadedCA = myCapas.find((c) => c.type === 'CORRECTIVE')?.action || '';
    const loadedPA = myCapas.find((c) => c.type === 'PREVENTIVE')?.action || '';
    setCa(loadedCA);
    setPa(loadedPA);
    setEvidenceFiles(evidenceOf(myCapas));
    if (!loadedCA && !loadedPA && editable) {
      setEditing(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capas, editable]);

  // If read-only and no CAPA has been written yet, don't display
  if (!editable && !hasSaved) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    setUploading(true);
    try {
      for (const file of files) {
        const uploaded = await uploadFile(file, 'CAPA');
        setEvidenceFiles((prev) => [...prev, uploaded]);
      }
    } catch (err: any) {
      toast.error(errorMessage(err, 'File upload failed'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSave = async () => {
    if (!ca.trim()) return;
    const ok = await run(() =>
      api.post(`/incidents/${incident._id}/capas`, {
        correctiveAction: ca.trim(),
        preventiveAction: pa.trim(),
        evidence: evidenceFiles.map((f) => f._id),
      })
    );
    if (ok) {
      setEditing(false);
      toast.success('CAPA saved successfully');
    }
  };

  return (
    <Card
      title={`Corrective & Preventive Actions (CAPA)${multiDept && myDeptName ? ` — ${myDeptName}` : ''}`}
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

          <div>
            <label className={labelClass}>Attach files (optional)</label>
            <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-dashed border-clinicalBorder rounded-lg text-xs text-clinicalText-secondary hover:bg-slate-100 cursor-pointer transition w-fit">
              <Upload className="w-3.5 h-3.5" />
              {uploading ? 'Uploading...' : 'Upload evidence (PDF, PNG, JPG, DOCX up to 10MB)'}
              <input type="file" multiple onChange={handleFileUpload} disabled={uploading} className="hidden" />
            </label>
            {evidenceFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {evidenceFiles.map((f) => (
                  <span
                    key={f._id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-clinicalBorder rounded-lg text-xs text-[#5C1A22]"
                  >
                    <Paperclip className="w-3.5 h-3.5" /> {f.originalName}
                    <button
                      type="button"
                      onClick={() => setEvidenceFiles((prev) => prev.filter((x) => x._id !== f._id))}
                      className="text-slate-400 hover:text-red-600 cursor-pointer"
                      aria-label={`Remove ${f.originalName}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
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

          {evidenceFiles.length > 0 && (
            <div>
              <div className="text-[12px] font-bold uppercase tracking-wider text-clinicalText-muted mb-1">Evidence</div>
              <div className="flex flex-wrap gap-2">
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
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
