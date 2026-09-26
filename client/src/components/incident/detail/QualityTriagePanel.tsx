import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Send, UserCheck, HelpCircle, XCircle } from 'lucide-react';
import { api } from '../../../lib/api';
import { useAction } from '../../../lib/useAction';
import { SEVERITY_META, idOf, severityNeeds } from '../../../lib/incidentMeta';
import { Button, Card, Notice, inputClass, labelClass } from '../../ui/primitives';
import { departmentOptions } from '../../ui/DepartmentOptions';
import { SearchableSelect } from '../../ui/SearchableSelect';

type Mode = 'assign' | 'ask' | 'reject';

/** Quality, on a new report: assign the responsible department's HOD, ask the reporter, or reject. */
export default function QualityTriagePanel({ incident }: { incident: any }) {
  const { run, busy, error, setError } = useAction(incident._id);
  const [mode, setMode] = useState<Mode>('assign');
  const [departmentId, setDepartmentId] = useState(idOf(incident.occurredInDepartmentId) || '');
  const [severity, setSeverity] = useState<number>(incident.initialSeverity || incident.severity || 1);
  const [remarks, setRemarks] = useState('');
  const [question, setQuestion] = useState('');
  const [reason, setReason] = useState('');

  const { data } = useQuery({ queryKey: ['departments'], queryFn: () => api.get('/departments') });
  const departments: any[] = (data as any)?.data || [];
  const selected = departments.find((d) => d._id === departmentId);
  const hod = selected?.hodUserId?.status === 'ACTIVE' ? selected.hodUserId : null;
  const needs = severityNeeds(severity);
  const lastReturn = incident.hodReturns?.[incident.hodReturns.length - 1];

  const modes: Array<{ key: Mode; label: string; icon: any }> = [
    { key: 'assign', label: 'Assign to HOD', icon: UserCheck },
    { key: 'ask', label: 'Ask reporter', icon: HelpCircle },
    { key: 'reject', label: 'Reject', icon: XCircle },
  ];

  return (
    <Card title="Triage this report" icon={Send} tone="action">
      {lastReturn && (
        <Notice tone="warning">
          <strong>Returned by {lastReturn.by?.name || 'the HOD'}:</strong> {lastReturn.reason}
        </Notice>
      )}

      <div className="flex flex-wrap gap-2">
        {modes.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setMode(key);
              setError('');
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
              mode === key ? 'bg-[#8B1E23] text-white border-[#8B1E23]' : 'bg-white text-clinicalText-secondary border-clinicalBorder hover:bg-slate-50'
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {mode === 'assign' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Responsible department *</label>
              <SearchableSelect
                value={departmentId}
                onChange={setDepartmentId}
                options={[
                  { value: '', label: '-- Choose department --' },
                  ...departmentOptions(
                    departments,
                    (d) =>
                      `${d.name}${d._id === idOf(incident.occurredInDepartmentId) ? ' (where it occurred)' : ''}${
                        d.hodUserId?.status === 'ACTIVE' ? '' : ' — no HOD'
                      }`
                  ),
                ]}
                searchPlaceholder="Search departments..."
                className={inputClass}
              />
              {selected && (
                <p className={`mt-1 text-[12.5px] ${hod ? 'text-clinicalText-secondary' : 'text-red-700 font-semibold'}`}>
                  {hod ? `HOD: ${hod.name}` : 'This department has no active HOD. Ask Admin to set one before assigning.'}
                </p>
              )}
            </div>
            <div>
              <label className={labelClass}>Confirmed severity *</label>
              <SearchableSelect
                value={String(severity)}
                onChange={(v) => setSeverity(Number(v))}
                options={[1, 2, 3, 4, 5].map((s) => ({
                  value: String(s),
                  label: `${SEVERITY_META[s].label}${s === incident.initialSeverity ? ' (as reported)' : ''}`,
                }))}
                searchPlaceholder="Search severities..."
                className={inputClass}
              />
              <p className="mt-1 text-[12.5px] text-clinicalText-secondary">
                {needs.rca ? 'RCA and CAPA required.' : needs.capa ? 'CAPA required.' : 'Investigation only; no CAPA required.'}
              </p>
            </div>
          </div>
          <div>
            <label className={labelClass}>Remarks for the HOD (optional)</label>
            <textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} className={inputClass} />
          </div>
          <Button
            busy={busy}
            disabled={!departmentId || !hod}
            onClick={() => run(() => api.post(`/incidents/${incident._id}/assign`, { departmentId, severity, remarks: remarks || undefined }))}
          >
            <UserCheck className="w-4 h-4" /> Assign to {hod?.name || 'HOD'}
          </Button>
        </div>
      )}

      {mode === 'ask' && (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Question for the reporter *</label>
            <textarea
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Please confirm the exact time and who else was present."
              className={inputClass}
            />
          </div>
          <Button busy={busy} disabled={!question.trim()} onClick={() => run(() => api.post(`/incidents/${incident._id}/request-info`, { question }))}>
            <HelpCircle className="w-4 h-4" /> Send question
          </Button>
        </div>
      )}

      {mode === 'reject' && (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Reason for rejecting *</label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Duplicate of INC-2026-000012."
              className={inputClass}
            />
            <p className="mt-1 text-[12.5px] text-clinicalText-secondary">The reporter sees this reason. A rejected report cannot be reopened.</p>
          </div>
          <Button variant="danger" busy={busy} disabled={!reason.trim()} onClick={() => run(() => api.post(`/incidents/${incident._id}/reject`, { reason }))}>
            <XCircle className="w-4 h-4" /> Reject report
          </Button>
        </div>
      )}

      {error && <Notice tone="error">{error}</Notice>}
    </Card>
  );
}
