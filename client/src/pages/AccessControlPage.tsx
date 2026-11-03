import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Lock, RotateCcw, Loader2, Check, AlertTriangle, Info, Users } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../store/useToastStore';
import { errorMessage } from '../lib/useAction';
import { PageHeader, Notice } from '../components/ui/primitives';

interface CatalogEntry {
  key: string;
  label: string;
  description: string;
  group: 'Screens' | 'Incident details' | 'Administration' | 'Incident workflow';
  configurable: boolean;
  performedBy?: string[];
}
interface RoleRow {
  _id: string;
  name: string;
  code: string;
  permissions: string[];
  customized: boolean;
  editable: boolean;
  defaults: string[] | null;
  activeUsers: number;
}

const GROUPS: Array<{
  key: CatalogEntry['group'];
  title: string;
  hint: string;
}> = [
  {
    key: 'Screens',
    title: 'Screens',
    hint: 'Which items appear in the navbar, and the data behind them.',
  },
  {
    key: 'Incident details',
    title: 'Incident details',
    hint: 'Sections shown when opening an incident.',
  },
  {
    key: 'Administration',
    title: 'Administration',
    hint: 'Abilities inside the Administration screen.',
  },
  {
    key: 'Incident workflow',
    title: 'Incident workflow (fixed)',
    hint: 'Each step is done by a specific role (for example only Quality triages), so these follow the role and cannot be changed here.',
  },
];

const ROLE_ORDER = ['STAFF', 'HOD', 'QUALITY', 'RCA_HEAD', 'ADMIN', 'INTIMATION_MEMBER', 'SUPER_ADMIN'];
const ROLE_LABEL: Record<string, string> = {
  HOD: 'HOD',
  RCA_HEAD: 'RCA Head',
  INTIMATION_MEMBER: 'Intimation Member',
};

export default function AccessControlPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['access-control'],
    queryFn: () => api.get('/roles/access-control'),
  });
  const matrix = (data as any)?.data as { catalog: CatalogEntry[]; roles: RoleRow[] } | undefined;

  // Unsaved edits: role id -> its full set of permissions after the edit
  const [draft, setDraft] = useState<Record<string, Set<string>>>({});
  const [saving, setSaving] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);

  const roles = useMemo(
    () =>
      [...(matrix?.roles ?? [])].sort((a, b) => {
        const ia = ROLE_ORDER.indexOf(a.code);
        const ib = ROLE_ORDER.indexOf(b.code);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.name.localeCompare(b.name);
      }),
    [matrix]
  );
  const catalog = matrix?.catalog ?? [];

  const effective = (role: RoleRow) => draft[role._id] ?? new Set(role.permissions);
  const isChanged = (role: RoleRow, key: string) => draft[role._id] && draft[role._id].has(key) !== role.permissions.includes(key);

  const toggle = (role: RoleRow, key: string) => {
    const next = new Set(effective(role));
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setDraft((d) => {
      const copy = { ...d };
      const same = next.size === role.permissions.length && role.permissions.every((p) => next.has(p));
      if (same) delete copy[role._id];
      else copy[role._id] = next;
      return copy;
    });
  };

  const changedRoles = roles.filter((r) => draft[r._id]);
  const changeCount = changedRoles.reduce((n, r) => n + catalog.filter((c) => isChanged(r, c.key)).length, 0);

  const save = async () => {
    setSaving(true);
    try {
      for (const role of changedRoles) {
        await api.put(`/roles/${role._id}/permissions`, {
          permissions: [...draft[role._id]],
        });
      }
      toast.success(`Access updated for ${changedRoles.map((r) => r.name).join(', ')}`);
      setDraft({});
      await queryClient.invalidateQueries({ queryKey: ['access-control'] });
    } catch (err: any) {
      toast.error(errorMessage(err, 'Could not save the changes'));
      await queryClient.invalidateQueries({ queryKey: ['access-control'] });
    } finally {
      setSaving(false);
    }
  };

  const reset = async (role: RoleRow) => {
    if (!window.confirm(`Reset ${role.name} to its default access? Your changes to this role will be lost.`)) return;
    setResettingId(role._id);
    try {
      await api.post(`/roles/${role._id}/reset`);
      setDraft((d) => {
        const copy = { ...d };
        delete copy[role._id];
        return copy;
      });
      toast.success(`${role.name} reset to default`);
      await queryClient.invalidateQueries({ queryKey: ['access-control'] });
    } catch (err: any) {
      toast.error(errorMessage(err, 'Could not reset the role'));
    } finally {
      setResettingId(null);
    }
  };

  const screenKeys = catalog.filter((c) => c.group === 'Screens').map((c) => c.key);
  const hasNoScreens = (role: RoleRow) => !screenKeys.some((k) => effective(role).has(k));

  return (
    <div className="space-y-6 pb-24 text-clinicalText-primary">
      <PageHeader
        icon={ShieldCheck}
        title="Access Control"
        description="Choose which screens each role can see. Changes apply to everyone with that role the next time their page loads."
      />

      {isLoading && <div className="h-96 rounded-2xl bg-white border border-slate-200 animate-pulse" aria-label="Loading" />}
      {error && <Notice tone="error">{errorMessage(error, 'Could not load access settings')}</Notice>}

      {matrix && (
        <>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12.5px] text-clinicalText-secondary">
            <span className="inline-flex items-center gap-2">
              <CellBox checked /> Has access
            </span>
            <span className="inline-flex items-center gap-2">
              <CellBox checked={false} /> No access
            </span>
            <span className="inline-flex items-center gap-2">
              <CellBox checked changed /> Changed, not saved yet
            </span>
            <span className="inline-flex items-center gap-2">
              <CellBox checked locked /> Fixed
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-[#FBF6EE] border-b border-[#E9D3BC]">
                    <th className="sticky left-0 z-20 bg-[#FBF6EE] text-left px-4 py-3 min-w-[17rem] w-[22rem] font-bold text-[12px] uppercase tracking-wider text-[#5C1A22]">
                      Screen / ability
                    </th>
                    {roles.map((role) => (
                      <th key={role._id} className="px-2 py-3 align-bottom min-w-[7.5rem]">
                        <div className="flex flex-col items-center gap-1 text-center">
                          <span className="font-bold text-[13px] text-clinicalText-primary leading-tight">
                            {ROLE_LABEL[role.code] ?? role.name}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-normal">
                            <Users className="w-3 h-3" /> {role.activeUsers}
                          </span>
                          {!role.editable ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#5C1A22] text-white text-[10px] font-bold">
                              <Lock className="w-2.5 h-2.5" /> Full access
                            </span>
                          ) : role.customized ? (
                            <span className="flex flex-col items-center gap-1">
                              <span className="px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-300 text-amber-800 text-[10px] font-bold">
                                Customised
                              </span>
                              {role.defaults && (
                                <button
                                  type="button"
                                  onClick={() => reset(role)}
                                  disabled={resettingId === role._id || saving}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#5C1A22] hover:underline cursor-pointer disabled:opacity-50"
                                >
                                  {resettingId === role._id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <RotateCcw className="w-3 h-3" />
                                  )}
                                  Reset
                                </button>
                              )}
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-semibold">
                              Default
                            </span>
                          )}
                          {role.editable && hasNoScreens(role) && (
                            <span
                              className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-red-700"
                              title="Users with only this role would have no screens"
                            >
                              <AlertTriangle className="w-3 h-3" /> No screens
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {GROUPS.map((group) => {
                    const rows = catalog.filter((c) => c.group === group.key);
                    if (!rows.length) return null;
                    return [
                      <tr key={`g-${group.key}`} className="bg-slate-50/80 border-y border-slate-200">
                        <td colSpan={roles.length + 1} className="sticky left-0 px-4 py-2.5">
                          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                            <span className="text-[12px] font-bold uppercase tracking-wider text-[#5C1A22] flex items-center gap-1.5">
                              {group.key === 'Incident workflow' && <Lock className="w-3.5 h-3.5" />}
                              {group.title}
                            </span>
                            <span className="text-[12px] text-slate-500">{group.hint}</span>
                          </div>
                        </td>
                      </tr>,
                      ...rows.map((entry) => (
                        <tr key={entry.key} className="border-b border-slate-100 hover:bg-[#FFFBF6] transition-colors">
                          <td className="sticky left-0 z-10 bg-white px-4 py-2.5 min-w-[17rem]">
                            <div className="font-semibold text-clinicalText-primary">{entry.label}</div>
                            <div className="text-[12px] text-slate-500 leading-snug">{entry.description}</div>
                          </td>
                          {roles.map((role) => {
                            const has = effective(role).has(entry.key);
                            const interactive = role.editable && entry.configurable;
                            return (
                              <td key={role._id} className="px-2 py-2.5 text-center">
                                {interactive ? (
                                  <button
                                    type="button"
                                    onClick={() => toggle(role, entry.key)}
                                    disabled={saving}
                                    aria-pressed={has}
                                    aria-label={`${entry.label} for ${role.name}: ${has ? 'allowed' : 'not allowed'}`}
                                    className="inline-flex cursor-pointer disabled:cursor-wait rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7A2430]"
                                  >
                                    <CellBox checked={has} changed={Boolean(isChanged(role, entry.key))} />
                                  </button>
                                ) : (
                                  <span
                                    className="inline-flex"
                                    title={
                                      !role.editable
                                        ? 'Super Admin always has full access'
                                        : entry.performedBy
                                          ? `Done by: ${entry.performedBy.map((c) => ROLE_LABEL[c] ?? c.charAt(0) + c.slice(1).toLowerCase()).join(', ')}`
                                          : 'Fixed'
                                    }
                                  >
                                    <CellBox checked={has} locked />
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      )),
                    ];
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[12.5px] text-slate-500 flex items-start gap-1.5 max-w-[80ch]">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            The Super Admin role always has full access and is the only role that can open this screen. Only a Super Admin can give someone
            the Super Admin role or change a Super Admin's account. Every change here is recorded in the audit log.
          </p>
        </>
      )}

      {/* Save bar */}
      {changeCount > 0 && (
        <div
          className="fixed z-40 inset-x-3 sm:inset-x-auto sm:right-6 bottom-6 sm:w-auto"
          style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="flex flex-wrap items-center gap-3 bg-[#2E0B11] text-white rounded-2xl pl-5 pr-3 py-3 shadow-[0_18px_40px_-10px_rgba(46,11,17,0.6)]">
            <span className="text-[13px] font-semibold">
              {changeCount} unsaved change{changeCount === 1 ? '' : 's'} ·{' '}
              {changedRoles.map((r) => ROLE_LABEL[r.code] ?? r.name).join(', ')}
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => setDraft({})}
                disabled={saving}
                className="px-3 py-2 rounded-xl text-[12.5px] font-semibold text-white/80 hover:text-white hover:bg-white/10 cursor-pointer disabled:opacity-50"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-[#5C1A22] text-[12.5px] font-bold hover:bg-[#FAF3EC] cursor-pointer disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CellBox({ checked, changed, locked }: { checked: boolean; changed?: boolean; locked?: boolean }) {
  const base = 'w-6 h-6 rounded-md border-2 flex items-center justify-center transition';
  const tone = locked
    ? checked
      ? 'bg-slate-200 border-slate-300 text-slate-500'
      : 'bg-slate-50 border-slate-200'
    : checked
      ? 'bg-[#7A2430] border-[#7A2430] text-white'
      : 'bg-white border-slate-300 hover:border-[#B5484F]';
  return (
    <span className={`${base} ${tone} ${changed ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`} aria-hidden="true">
      {checked && (locked ? <Lock className="w-3 h-3" /> : <Check className="w-4 h-4" strokeWidth={3} />)}
    </span>
  );
}
