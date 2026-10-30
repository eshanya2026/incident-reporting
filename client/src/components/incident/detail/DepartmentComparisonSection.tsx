import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Columns3, Microscope, Paperclip, Undo2 } from 'lucide-react';
import { api } from '../../../lib/api';
import { useAction } from '../../../lib/useAction';
import { Button, Card, inputClass } from '../../ui/primitives';
import { openAttachment } from '../../../lib/files';
import { toast } from '../../../store/useToastStore';

const idOf = (v: any): string | undefined => (v ? (v._id ?? v).toString() : undefined);

const INVESTIGATION_STATUS_META: Record<string, { label: string; classes: string }> = {
  COMPLETED: { label: 'Completed', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  IN_PROGRESS: { label: 'In progress', classes: 'bg-sky-50 text-sky-700 border-sky-200' },
  DRAFT: { label: 'Draft', classes: 'bg-slate-100 text-slate-600 border-slate-200' },
};

/** Sends just this one department's CAPA back for rework — other departments are untouched. */
function ReturnToHodControl({ incidentId, deptId, deptName }: { incidentId: string; deptId: string; deptName: string }) {
  const { run, busy, error } = useAction(incidentId);
  const [open, setOpen] = useState(false);
  const [remarks, setRemarks] = useState('');

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-red-700 hover:text-red-900 cursor-pointer"
      >
        <Undo2 className="w-4 h-4" /> Return to HOD
      </button>
    );
  }

  return (
    <div className="space-y-2 p-2.5 rounded-lg bg-red-50/60 border border-red-200">
      <textarea
        rows={2}
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
        placeholder={`Why does ${deptName} need to rework this...`}
        className={`${inputClass} text-[13px]`}
      />
      <div className="flex items-center gap-2">
        <Button
          variant="danger"
          busy={busy}
          disabled={!remarks.trim()}
          onClick={async () => {
            const ok = await run(() =>
              api.post(`/incidents/${incidentId}/review`, { decision: 'RETURN', remarks: remarks.trim(), departmentIds: [deptId] })
            );
            if (ok) {
              setOpen(false);
              setRemarks('');
              toast.success(`Sent back to ${deptName} for rework`);
            }
          }}
          className="!px-2.5 !py-1 text-[12.5px]"
        >
          <Undo2 className="w-4 h-4" /> Send back
        </Button>
        <button type="button" onClick={() => setOpen(false)} className="text-[12.5px] font-semibold text-clinicalText-secondary hover:text-clinicalText-primary cursor-pointer">
          Cancel
        </button>
      </div>
      {error && <p className="text-[12.5px] text-red-700">{error}</p>}
    </div>
  );
}

/**
 * Quality's side-by-side view of every involved department's investigation and CAPA, once more
 * than one department is working the same incident — each writes its own, so this is the one
 * screen that compares them together instead of hunting through each department's own section.
 */
export default function DepartmentComparisonSection({ incident, capas }: { incident: any; capas: any[] }) {
  const investigationsQuery = useQuery({
    queryKey: ['investigations', incident._id],
    queryFn: () => api.get(`/incidents/${incident._id}/investigations`),
  });
  const investigations: any[] = (investigationsQuery.data as any)?.data || [];

  if (!investigations.length && !capas.length) return null;

  const leadDeptId = idOf(incident.departmentId);
  const departments = [
    ...(incident.departmentId ? [incident.departmentId] : []),
    ...(incident.notifiedDepartmentIds || []),
  ];
  // Fall back to whatever departments actually wrote something, in case the roster above is incomplete.
  for (const inv of investigations) {
    if (inv.departmentId && !departments.some((d: any) => idOf(d) === idOf(inv.departmentId))) {
      departments.push(inv.departmentId);
    }
  }
  for (const c of capas) {
    if (c.ownerDepartmentId && !departments.some((d: any) => idOf(d) === idOf(c.ownerDepartmentId))) {
      departments.push(c.ownerDepartmentId);
    }
  }

  if (departments.length < 2) return null;

  return (
    <Card title="Department comparison — Investigation & CAPA" icon={Columns3}>
      <p className="text-[13px] text-clinicalText-secondary -mt-2">
        {departments.length} departments are working this incident. Each writes its own investigation and CAPA, compared here.
      </p>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {departments.map((dept: any) => {
          const deptId = idOf(dept);
          const inv = investigations.find((i) => idOf(i.departmentId) === deptId);
          const deptCapas = capas.filter((c) => idOf(c.ownerDepartmentId) === deptId);
          const ca = deptCapas.find((c) => c.type === 'CORRECTIVE');
          const pa = deptCapas.find((c) => c.type === 'PREVENTIVE');
          const evidence = [...(inv?.evidence || []), ...(ca?.evidence || []), ...(pa?.evidence || [])];
          const statusMeta = inv ? INVESTIGATION_STATUS_META[inv.status] || INVESTIGATION_STATUS_META.DRAFT : null;
          const needsRework = ca?.status === 'OPEN' || pa?.status === 'OPEN';
          const lastReturn = needsRework
            ? [...(incident.qualityReviews || [])]
                .filter((r: any) => r.decision === 'RETURNED' && (!r.departmentIds?.length || r.departmentIds.some((d: any) => idOf(d) === deptId)))
                .sort((a: any, b: any) => new Date(b.at).getTime() - new Date(a.at).getTime())[0]
            : undefined;

          return (
            <div key={deptId} className="min-w-0 rounded-xl border border-clinicalBorder bg-slate-50/60 p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13.5px] font-bold text-clinicalText-primary">{dept.name || 'Department'}</span>
                {deptId === leadDeptId ? (
                  <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#5C1A22] text-white">Lead</span>
                ) : (
                  <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">Involved</span>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-[12px]">
                <Microscope className="w-3.5 h-3.5 text-clinicalText-muted shrink-0" />
                {statusMeta ? (
                  <span className={`px-2 py-0.5 rounded-full border font-semibold ${statusMeta.classes}`}>{statusMeta.label}</span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full border bg-slate-100 text-slate-500 border-slate-200 font-semibold">Not started</span>
                )}
                {inv?.investigatorId?.name && <span className="text-clinicalText-muted truncate">by {inv.investigatorId.name}</span>}
              </div>

              {inv?.facts && (
                <div>
                  <div className="text-[11.5px] font-bold uppercase tracking-wider text-clinicalText-muted mb-0.5">Established facts</div>
                  <p className="text-[13px] text-clinicalText-primary whitespace-pre-wrap">{inv.facts}</p>
                </div>
              )}

              {inv?.chronology && (
                <div>
                  <div className="text-[11.5px] font-bold uppercase tracking-wider text-clinicalText-muted mb-0.5">Timeline of events</div>
                  <p className="text-[13px] text-clinicalText-primary whitespace-pre-wrap">{inv.chronology}</p>
                </div>
              )}

              {inv?.findings && (
                <div>
                  <div className="text-[11.5px] font-bold uppercase tracking-wider text-clinicalText-muted mb-0.5">Findings</div>
                  <p className="text-[13px] text-clinicalText-primary whitespace-pre-wrap">{inv.findings}</p>
                </div>
              )}

              {(inv?.contributingFactors || []).length > 0 && (
                <div>
                  <div className="text-[11.5px] font-bold uppercase tracking-wider text-clinicalText-muted mb-0.5">Contributing factors</div>
                  <div className="flex flex-wrap gap-1">
                    {inv.contributingFactors.map((f: string) => (
                      <span key={f} className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(inv?.peopleInterviewed || []).length > 0 && (
                <div>
                  <div className="text-[11.5px] font-bold uppercase tracking-wider text-clinicalText-muted mb-0.5">People interviewed</div>
                  <ul className="text-[13px] text-clinicalText-primary space-y-0.5">
                    {inv.peopleInterviewed.map((p: any, idx: number) => (
                      <li key={idx}>
                        <span className="font-semibold">{p.name}</span>
                        {p.designation && <span className="text-clinicalText-muted"> — {p.designation}</span>}
                        {p.statement && <div className="text-clinicalText-muted italic">“{p.statement}”</div>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(inv?.startedAt || inv?.completedAt) && (
                <div className="text-[12px] text-clinicalText-muted">
                  {inv?.startedAt && <div>Started {new Date(inv.startedAt).toLocaleString()}</div>}
                  {inv?.completedAt && <div>Completed {new Date(inv.completedAt).toLocaleString()}</div>}
                </div>
              )}

              <div className="space-y-2">
                <div className="p-2.5 rounded-lg bg-white border border-clinicalBorder">
                  <div className="text-[11.5px] font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1 mb-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block" /> Corrective Action
                  </div>
                  <p className="text-[13px] text-clinicalText-primary whitespace-pre-wrap">{ca?.action || '—'}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-clinicalBorder">
                  <div className="text-[11.5px] font-bold uppercase tracking-wider text-purple-800 flex items-center gap-1 mb-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-600 inline-block" /> Preventive Action
                  </div>
                  <p className="text-[13px] text-clinicalText-primary whitespace-pre-wrap">{pa?.action || '—'}</p>
                </div>
              </div>

              {lastReturn && (
                <div className="p-2.5 rounded-lg bg-red-50/80 border border-red-200 text-[12.5px] text-red-950">
                  <div className="flex items-center gap-1.5 font-bold text-red-800">
                    <Undo2 className="w-4 h-4 shrink-0" />
                    Sent back by {lastReturn.by?.name || 'Quality'}
                    {lastReturn.at ? ` · ${new Date(lastReturn.at).toLocaleString()}` : ''}
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap">{lastReturn.remarks}</p>
                </div>
              )}

              {deptId && incident.availableActions?.includes('REVIEW_RETURN') && (
                <ReturnToHodControl incidentId={incident._id} deptId={deptId} deptName={dept.name || 'this department'} />
              )}

              {evidence.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {evidence.map((f: any) => (
                    <button
                      key={f._id}
                      type="button"
                      onClick={() => openAttachment(f).catch(() => toast.error('Could not open the file'))}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-clinicalBorder rounded-md text-[12px] text-[#5C1A22] hover:bg-[#FAF3EC] cursor-pointer"
                    >
                      <Paperclip className="w-3.5 h-3.5" /> {f.originalName}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
