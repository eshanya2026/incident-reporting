import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, X, UserCheck, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from '../../store/useToastStore';
import { errorMessage } from '../../lib/useAction';

const primaryBtn =
  'px-5 py-2 bg-gradient-to-r from-[#5C1A22] via-[#6B1F29] to-[#7A2430] hover:brightness-110 active:scale-[0.99] text-white font-semibold text-sm rounded-xl shadow-button-red transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';
const secondaryBtn =
  'px-4 py-2 bg-white hover:bg-slate-50 text-clinicalText-secondary hover:text-clinicalText-primary border border-clinicalBorder font-medium text-sm rounded-xl transition cursor-pointer';

const roleLabel = (u: any) => (u.roles || []).map((r: any) => r.name).join(', ');

/**
 * Change or remove a department's HOD. Any active staff member can be chosen: they become HOD
 * of this department, the previous HOD goes back to Staff, open incidents move to the new HOD,
 * and closed reports keep the name of the HOD who handled them.
 */
export function DepartmentHodDialog({
  department,
  mode,
  onClose,
}: {
  department: any;
  mode: 'change' | 'remove';
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const current = department.hodUserId;
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Staff of this department first when nothing is typed; otherwise search everyone
  const { data, isFetching } = useQuery({
    queryKey: ['users', 'hod-candidates', department._id, debounced],
    queryFn: () =>
      api.get('/users', {
        params: {
          status: 'ACTIVE',
          limit: 30,
          search: debounced || undefined,
          departmentId: debounced ? undefined : department._id,
        },
      }),
    enabled: mode === 'change',
  });
  const candidates = (((data as any)?.data ?? []) as any[]).filter((u) => u._id !== current?._id);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/departments/${department._id}`, { hodUserId: mode === 'remove' ? null : selected._id });
      toast.success(
        mode === 'remove' ? `HOD removed from ${department.name}` : `${selected.name} is now HOD of ${department.name}`
      );
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    } catch (err: any) {
      toast.error(errorMessage(err, mode === 'remove' ? 'Removing HOD failed' : 'Changing HOD failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-clinicalBorder flex flex-col max-h-[90vh]">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-clinicalBorder">
          <div>
            <h3 className="font-bold text-base text-clinicalText-primary">
              {mode === 'remove' ? 'Remove HOD' : current ? 'Change HOD' : 'Assign HOD'}
            </h3>
            <p className="text-sm text-clinicalText-secondary mt-0.5">{department.name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
            <X className="w-5 h-5 text-clinicalText-muted" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {current && (
            <div className="text-sm">
              <span className="text-clinicalText-muted">Current HOD: </span>
              <span className="font-semibold text-clinicalText-primary">{current.name}</span>
              {current.employeeId && <span className="text-clinicalText-muted"> · {current.employeeId}</span>}
            </div>
          )}

          {mode === 'change' && (
            <>
              <div className="relative">
                <Search className="w-4 h-4 text-clinicalText-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search staff by name, employee ID or designation"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-clinicalBorder rounded-xl text-sm focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
                />
              </div>
              <p className="text-xs text-clinicalText-muted -mt-2">
                {debounced ? 'Showing matching staff from all departments.' : `Showing staff of ${department.name}. Type to search everyone.`}
              </p>

              <ul className="border border-clinicalBorder rounded-xl divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {candidates.length === 0 && (
                  <li className="p-4 text-sm text-clinicalText-muted text-center">
                    {isFetching ? 'Searching…' : 'No active staff found.'}
                  </li>
                )}
                {candidates.map((u) => {
                  const active = selected?._id === u._id;
                  return (
                    <li key={u._id}>
                      <button
                        type="button"
                        onClick={() => setSelected(u)}
                        className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 transition cursor-pointer ${
                          active ? 'bg-[#FAF3EC]' : 'hover:bg-slate-50'
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-clinicalText-primary truncate">{u.name}</span>
                          <span className="block text-xs text-clinicalText-muted truncate">
                            {[u.employeeId, u.designation, u.departmentId?.name, roleLabel(u)].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        {active && <UserCheck className="w-5 h-5 text-maroon-700 shrink-0" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {(mode === 'remove' || selected) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 space-y-1.5">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4" /> What happens
              </div>
              <ul className="list-disc pl-5 space-y-1">
                {mode === 'change' && (
                  <>
                    <li>
                      <b>{selected.name}</b> becomes HOD of {department.name}
                      {selected.departmentId?._id !== department._id && ' and moves into this department'}.
                    </li>
                    <li>Open incidents of this department move to {selected.name}.</li>
                  </>
                )}
                {mode === 'remove' && <li>New incidents cannot be assigned to {department.name} until a new HOD is set.</li>}
                {current && (
                  <>
                    <li>{current.name} goes back to Staff and can no longer act on this department's incidents.</li>
                    <li>Closed reports keep {current.name}'s name as the HOD who handled them.</li>
                  </>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-clinicalBorder">
          <button type="button" onClick={onClose} className={secondaryBtn}>
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving || (mode === 'change' && !selected)} className={primaryBtn}>
            {saving ? 'Saving…' : mode === 'remove' ? 'Remove HOD' : 'Make HOD'}
          </button>
        </div>
      </div>
    </div>
  );
}
