import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Send, UserCheck, HelpCircle, XCircle, X } from 'lucide-react';
import { api } from '../../../lib/api';
import { useAction } from '../../../lib/useAction';
import { INCIDENT_PRIORITIES, PRIORITY_COLOR, PRIORITY_META, SEVERITY_META, idOf, severityNeeds } from '../../../lib/incidentMeta';
import { Button, Card, Notice, inputClass, labelClass } from '../../ui/primitives';
import { departmentOptions } from '../../ui/DepartmentOptions';
import { SearchableSelect } from '../../ui/SearchableSelect';

type Mode = 'assign' | 'ask' | 'reject';
type CloseReasonType = 'NOT_AN_INCIDENT' | 'DUPLICATE' | 'OTHER';

const CLOSE_REASON_TYPES: Array<{ key: CloseReasonType; label: string }> = [
  { key: 'NOT_AN_INCIDENT', label: 'No incident' },
  { key: 'DUPLICATE', label: 'Duplicate incident' },
  { key: 'OTHER', label: 'Other' },
];

/** Quality, on a new report: assign the responsible department's HOD, ask the reporter, or close it out. */
export default function QualityTriagePanel({ incident }: { incident: any }) {
  const { run, busy, error, setError } = useAction(incident._id);
  const [mode, setMode] = useState<Mode>('assign');
  const [departmentId, setDepartmentId] = useState(idOf(incident.occurredInDepartmentId) || '');
  const [notifiedDepartmentIds, setNotifiedDepartmentIds] = useState<string[]>(
    (incident.notifiedDepartmentIds || []).map((d: any) => idOf(d)).filter(Boolean)
  );
  const [intimatedUserIds, setIntimatedUserIds] = useState<string[]>(
    (incident.intimatedUserIds || []).map((u: any) => idOf(u)).filter(Boolean)
  );
  const [severity, setSeverity] = useState<number>(incident.initialSeverity || incident.severity || 1);
  const [priority, setPriority] = useState<string>(incident.priority || 'MEDIUM');
  const [remarks, setRemarks] = useState('');
  const [question, setQuestion] = useState('');
  const [closeReasonType, setCloseReasonType] = useState<CloseReasonType>('NOT_AN_INCIDENT');
  const [duplicateOf, setDuplicateOf] = useState('');
  const [reason, setReason] = useState('');

  const closeReasonLabel = CLOSE_REASON_TYPES.find((r) => r.key === closeReasonType)?.label || '';
  const fullReason =
    closeReasonType === 'DUPLICATE' && duplicateOf.trim()
      ? `Duplicate of ${duplicateOf.trim()}. ${reason}`.trim()
      : closeReasonType === 'OTHER'
        ? reason
        : `${closeReasonLabel}. ${reason}`.trim();

  const { data } = useQuery({ queryKey: ['departments'], queryFn: () => api.get('/departments') });
  const departments: any[] = (data as any)?.data || [];
  const selected = departments.find((d) => d._id === departmentId);
  const hod = selected?.hodUserId?.status === 'ACTIVE' ? selected.hodUserId : null;
  const needs = severityNeeds(severity);
  const lastReturn = incident.hodReturns?.[incident.hodReturns.length - 1];

  const { data: usersData } = useQuery({
    queryKey: ['users', 'active'],
    queryFn: () => api.get('/users?status=ACTIVE&limit=200'),
  });
  const usersList: any[] = (usersData as any)?.data || [];

  const availableAdditional = departments.filter(
    (d) => d._id !== departmentId && !notifiedDepartmentIds.includes(d._id)
  );

  const availableIntimateUsers = usersList.filter(
    (u) => !intimatedUserIds.includes(u._id)
  );

  const modes: Array<{ key: Mode; label: string; icon: any }> = [
    { key: 'assign', label: 'Assign to HOD', icon: UserCheck },
    { key: 'ask', label: 'Ask reporter', icon: HelpCircle },
    { key: 'reject', label: 'Close incident', icon: XCircle },
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
        <div className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3.5">
            <div>
              <label className={labelClass}>Lead / Responsible Department *</label>
              <SearchableSelect
                containerClassName="block w-full"
                value={departmentId}
                onChange={(newId) => {
                  setDepartmentId(newId);
                  setNotifiedDepartmentIds((prev) => prev.filter((dId) => dId !== newId));
                }}
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
                  {hod ? `Lead HOD: ${hod.name}` : 'This department has no active HOD. Ask Admin to set one before assigning.'}
                </p>
              )}
            </div>

            <div>
              <label className={labelClass}>Confirmed severity *</label>
              <SearchableSelect
                containerClassName="block w-full"
                value={String(severity)}
                onChange={(v) => setSeverity(Number(v))}
                options={[1, 2, 3, 4].map((s) => ({
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

            <div>
              <label className={labelClass}>Priority</label>
              <div role="radiogroup" aria-label="Priority" className="flex flex-wrap gap-1.5">
                {INCIDENT_PRIORITIES.map((p) => {
                  const active = priority === p;
                  const color = PRIORITY_COLOR[p];
                  return (
                    <button
                      key={p}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setPriority(p)}
                      style={
                        active
                          ? { background: color, borderColor: color, boxShadow: `0 0 0 3px ${color}33` }
                          : { borderColor: color }
                      }
                      className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                        active ? 'text-white' : 'bg-white text-clinicalText-secondary hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: active ? '#FFFFFF' : color }}
                      />
                      {PRIORITY_META[p].label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className={labelClass}>Involved departments</label>
              <SearchableSelect
                containerClassName="block w-full"
                value=""
                onChange={(addedId) => {
                  if (addedId && !notifiedDepartmentIds.includes(addedId)) {
                    setNotifiedDepartmentIds((prev) => [...prev, addedId]);
                  }
                }}
                options={[
                  { value: '', label: 'Add department...' },
                  ...departmentOptions(availableAdditional),
                ]}
                searchPlaceholder="Search departments..."
                className={inputClass}
              />
              {notifiedDepartmentIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {notifiedDepartmentIds.map((dId) => {
                    const dept = departments.find((d) => d._id === dId);
                    return (
                      <span
                        key={dId}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-slate-100 text-slate-800"
                      >
                        {dept?.name || 'Department'}
                        <button
                          type="button"
                          onClick={() => setNotifiedDepartmentIds((prev) => prev.filter((id) => id !== dId))}
                          className="text-slate-400 hover:text-red-600 cursor-pointer"
                          title="Remove department"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label className={labelClass}>Intimate to</label>
              <SearchableSelect
                containerClassName="block w-full"
                value=""
                onChange={(addedId) => {
                  if (addedId && !intimatedUserIds.includes(addedId)) {
                    setIntimatedUserIds((prev) => [...prev, addedId]);
                  }
                }}
                options={[
                  { value: '', label: 'Add personnel...' },
                  ...availableIntimateUsers.map((u) => ({
                    value: u._id,
                    label: `${u.name}${u.departmentId?.name ? ` (${u.departmentId.name})` : ''}`,
                    group: u.departmentId?.name || u.roles?.[0]?.name || 'General',
                  })),
                ]}
                searchPlaceholder="Search personnel..."
                className={inputClass}
              />

              {intimatedUserIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {intimatedUserIds.map((uId) => {
                    const userObj = usersList.find((u) => u._id === uId);
                    return (
                      <span
                        key={uId}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-slate-100 text-slate-800"
                      >
                        {userObj?.name || 'User'}
                        <button
                          type="button"
                          onClick={() => setIntimatedUserIds((prev) => prev.filter((id) => id !== uId))}
                          className="text-slate-400 hover:text-red-600 cursor-pointer"
                          title="Remove"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className={labelClass}>Remarks for the HOD (optional)</label>
            <textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} className={inputClass} />
          </div>
          <Button
            busy={busy}
            disabled={!departmentId || !hod}
            onClick={() =>
              run(() =>
                api.post(`/incidents/${incident._id}/assign`, {
                  departmentId,
                  notifiedDepartmentIds,
                  intimatedUserIds,
                  severity,
                  priority,
                  remarks: remarks || undefined,
                })
              )
            }
          >
            <UserCheck className="w-4 h-4" /> Assign to {hod?.name || 'HOD'}
            {notifiedDepartmentIds.length > 0
              ? ` (+${notifiedDepartmentIds.length} dept${notifiedDepartmentIds.length > 1 ? 's' : ''})`
              : ''}
            {intimatedUserIds.length > 0 ? ` (+${intimatedUserIds.length} intimated)` : ''}
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
            <label className={labelClass}>Why is this being closed? *</label>
            <div className="flex flex-wrap gap-2">
              {CLOSE_REASON_TYPES.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCloseReasonType(key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
                    closeReasonType === key
                      ? 'bg-[#8B1E23] text-white border-[#8B1E23]'
                      : 'bg-white text-clinicalText-secondary border-clinicalBorder hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {closeReasonType === 'DUPLICATE' && (
            <div>
              <label className={labelClass}>Duplicate of (incident number)</label>
              <input
                type="text"
                value={duplicateOf}
                onChange={(e) => setDuplicateOf(e.target.value)}
                placeholder="e.g. INC-2026-000012"
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label className={labelClass}>{closeReasonType === 'OTHER' ? 'Reason *' : 'Remarks (optional)'}</label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={closeReasonType === 'OTHER' ? 'Explain why this incident is being closed...' : 'Any additional detail for the reporter...'}
              className={inputClass}
            />
            <p className="mt-1 text-[12.5px] text-clinicalText-secondary">The reporter sees this reason. A closed report cannot be reopened.</p>
          </div>

          <Button
            variant="danger"
            busy={busy}
            disabled={!fullReason.trim()}
            onClick={() => run(() => api.post(`/incidents/${incident._id}/reject`, { reason: fullReason }))}
          >
            <XCircle className="w-4 h-4" /> Close incident
          </Button>
        </div>
      )}

      {error && <Notice tone="error">{error}</Notice>}
    </Card>
  );
}
