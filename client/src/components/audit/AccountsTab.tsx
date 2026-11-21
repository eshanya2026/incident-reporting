import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, UserCheck, UserX, Clock, MessageCircle, Building2, AlertTriangle, Download, Search, Loader2, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from '../../store/useToastStore';
import { EmptyState, Pagination } from '../ui/listKit';
import { SearchableSelect } from '../ui/SearchableSelect';

// Super Admin > Audit Log > Accounts: who is set up and ready (current state, not a period).

const ROLE_LABELS: Record<string, string> = {
  STAFF: 'Staff',
  HOD: 'HOD',
  QUALITY: 'Quality',
  ADMIN: 'Admin',
  RCA_HEAD: 'RCA Head',
  INTIMATION_MEMBER: 'Intimation members',
  SUPER_ADMIN: 'Super Admin',
};

type ListFilter = 'pending' | 'never' | 'noWhatsapp' | 'signedIn' | 'inactive' | 'all';
const LIST_FILTERS: Array<{ key: ListFilter; label: string }> = [
  { key: 'pending', label: 'First sign-in pending' },
  { key: 'never', label: 'Never signed in' },
  { key: 'noWhatsapp', label: 'No WhatsApp number' },
  { key: 'signedIn', label: 'First sign-in done' },
  { key: 'inactive', label: 'Inactive / locked' },
  { key: 'all', label: 'Everyone' },
];

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : 'Never';

function Tile({ label, value, hint, icon: Icon, tone, alert }: { label: string; value: React.ReactNode; hint?: string; icon: any; tone: string; alert?: boolean }) {
  return (
    <div className={`relative bg-white rounded-2xl border shadow-card p-4 pl-5 overflow-hidden ${alert ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200'}`}>
      <span className="absolute left-0 inset-y-0 w-1.5" style={{ background: tone }} />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11.5px] font-semibold text-slate-500 uppercase tracking-wide leading-tight">{label}</p>
        <Icon className="w-4 h-4 shrink-0" style={{ color: tone }} />
      </div>
      <p className="text-2xl font-extrabold mt-1.5 leading-none text-slate-900">{value}</p>
      {hint && <p className="text-xs text-slate-500 mt-1.5">{hint}</p>}
    </div>
  );
}

/** Thin progress bar (share of a group that is ready). */
function Bar({ value, total, color = '#10B981' }: { value: number; total: number; color?: string }) {
  const p = pct(value, total);
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
        <span className="block h-full rounded-full" style={{ width: `${p}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold text-slate-600 w-9 text-right">{p}%</span>
    </div>
  );
}

export default function AccountsTab({ onShowPerson }: { onShowPerson: (u: { _id: string; name: string }) => void }) {
  const overviewQ = useQuery({ queryKey: ['audit-accounts'], queryFn: () => api.get('/audit/accounts') });
  const d = (overviewQ.data as any)?.data;
  const t = d?.totals;

  const [filter, setFilter] = useState<ListFilter>('pending');
  const [role, setRole] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t2 = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t2);
  }, [search]);
  useEffect(() => setPage(1), [filter, role, departmentId, debounced]);

  const listParams = { filter, role: role || undefined, departmentId: departmentId || undefined, search: debounced || undefined };
  const listQ = useQuery({
    queryKey: ['audit-accounts-users', listParams, page],
    queryFn: () => api.get('/audit/accounts/users', { params: { ...listParams, page, limit: 50 } }),
  });
  const people: any[] = (listQ.data as any)?.data || [];
  const meta = (listQ.data as any)?.meta;

  const showList = (f: ListFilter, dept?: string) => {
    setFilter(f);
    if (dept !== undefined) setDepartmentId(dept);
    document.getElementById('accounts-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const exportCsv = async () => {
    try {
      const qs = new URLSearchParams(Object.entries(listParams).filter(([, v]) => v) as Array<[string, string]>).toString();
      const res = await fetch(`/api/v1/audit/accounts/users/export?${qs}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken') || ''}` },
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `accounts_${filter}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err: any) {
      toast.error(err?.message || 'Export failed');
    }
  };

  if (overviewQ.isLoading || !d) {
    return (
      <div className="py-16 flex justify-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const hc = d.hodCoverage;
  const deptOptions = [
    { value: '', label: 'All departments' },
    ...d.byDepartment.map((r: any) => ({ value: r.departmentId ?? 'none', label: r.department })),
  ];

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">How things stand right now (not limited to a date range). Click a number, role or department to see the people.</p>

      {/* Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Tile label="Active users" value={t.active} hint={`${t.inactive} inactive · ${t.locked} locked`} icon={Users} tone="#7A2430" />
        <button type="button" className="text-left cursor-pointer" onClick={() => showList('signedIn')}>
          <Tile label="First sign-in done" value={t.firstSignInDone} hint={`${pct(t.firstSignInDone, t.active)}% of active users`} icon={UserCheck} tone="#10B981" />
        </button>
        <button type="button" className="text-left cursor-pointer" onClick={() => showList('pending')}>
          <Tile label="First sign-in pending" value={t.firstSignInPending} hint="Details not confirmed yet" icon={Clock} tone="#F59E0B" alert={t.firstSignInPending > 0} />
        </button>
        <button type="button" className="text-left cursor-pointer" onClick={() => showList('never')}>
          <Tile label="Never signed in" value={t.neverSignedIn} hint={`Signed in: ${t.signedIn7d} in 7 days · ${t.signedIn30d} in 30`} icon={UserX} tone="#64748B" />
        </button>
        <button type="button" className="text-left cursor-pointer" onClick={() => showList('noWhatsapp')}>
          <Tile label="With WhatsApp" value={t.withWhatsapp} hint={`${t.withoutWhatsapp} without · ${t.withEmail} with email`} icon={MessageCircle} tone="#0284C7" />
        </button>
        <Tile
          label="Departments with HOD"
          value={`${hc.withHod} / ${hc.departments}`}
          hint={`${hc.withoutHod.length} without an HOD`}
          icon={Building2}
          tone="#7C3AED"
          alert={hc.withoutHod.length > 0}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* By role */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          <h3 className="px-4 py-3 text-sm font-bold text-slate-800 border-b border-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#7A2430]" /> By role
          </h3>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-4 py-2">Role</th>
                <th className="text-right px-3 py-2">Users</th>
                <th className="text-right px-3 py-2">Signed in</th>
                <th className="text-left px-4 py-2">First sign-in done</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {d.byRole.filter((r: any) => r.total > 0).map((r: any) => (
                <tr key={r.code} className="hover:bg-slate-50/70">
                  <td className="px-4 py-2">
                    <button type="button" onClick={() => { setRole(r.code); showList('all'); }} className="font-semibold text-slate-800 hover:text-[#7A2430] cursor-pointer">
                      {ROLE_LABELS[r.code] || r.name}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">{r.total}</td>
                  <td className="px-3 py-2 text-right">{r.everSignedIn}</td>
                  <td className="px-4 py-2"><Bar value={r.firstSignInDone} total={r.total} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* HOD coverage */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden flex flex-col">
          <h3 className="px-4 py-3 text-sm font-bold text-slate-800 border-b border-slate-100 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#7A2430]" /> HOD coverage
            <span className="ml-auto text-xs font-semibold text-slate-500">
              {hc.withHod} of {hc.departments} departments{hc.hodsNeverSignedIn ? ` · ${hc.hodsNeverSignedIn} HOD(s) never signed in` : ''}
            </span>
          </h3>
          {hc.withoutHod.length > 0 && (
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
              <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5 mb-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> {hc.withoutHod.length} departments have no HOD, so incidents can't be assigned to them
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {hc.withoutHod.map((dep: any) => (
                  <span key={dep._id} className="px-2 py-0.5 rounded-md bg-white border border-amber-200 text-[11.5px] text-amber-900">{dep.name}</span>
                ))}
              </div>
            </div>
          )}
          <div className="overflow-y-auto max-h-64">
            {hc.hods.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-400">No HODs assigned yet. Assign them in Administration → Departments.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {hc.hods.map((h: any) => (
                    <tr key={h.departmentId} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2 text-slate-600">{h.department}</td>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => onShowPerson(h.user)} className="font-semibold text-slate-800 hover:text-[#7A2430] cursor-pointer text-left">
                          {h.user.name}
                        </button>
                      </td>
                      <td className={`px-4 py-2 text-xs text-right whitespace-nowrap ${h.lastLoginAt ? 'text-slate-500' : 'text-amber-700 font-semibold'}`}>
                        {h.lastLoginAt ? `Last sign-in ${fmtDateTime(h.lastLoginAt)}` : 'Never signed in'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* By department */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <h3 className="px-4 py-3 text-sm font-bold text-slate-800 border-b border-slate-100">By department</h3>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 sticky top-0">
              <tr>
                <th className="text-left px-4 py-2">Department</th>
                <th className="text-left px-3 py-2">HOD</th>
                <th className="text-right px-3 py-2">Staff</th>
                <th className="text-left px-3 py-2">First sign-in done</th>
                <th className="text-left px-4 py-2">With WhatsApp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {d.byDepartment.map((r: any) => (
                <tr key={r.departmentId ?? 'none'} className="hover:bg-slate-50/70">
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => showList('pending', r.departmentId ?? 'none')}
                      className="font-semibold text-slate-800 hover:text-[#7A2430] cursor-pointer text-left"
                      title="Show who in this department hasn't done their first sign-in"
                    >
                      {r.department}
                    </button>
                  </td>
                  <td className={`px-3 py-2 ${r.hod ? 'text-slate-700' : 'text-amber-700 text-xs font-semibold'}`}>{r.hod || (r.departmentId ? 'No HOD' : '—')}</td>
                  <td className="px-3 py-2 text-right font-semibold">{r.staff}</td>
                  <td className="px-3 py-2"><Bar value={r.firstSignInDone} total={r.staff} /></td>
                  <td className="px-4 py-2"><Bar value={r.withWhatsapp} total={r.staff} color="#0284C7" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* People list */}
      <div id="accounts-list" className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden scroll-mt-4">
        <div className="px-4 py-3 border-b border-slate-100 space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {LIST_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1 rounded-full text-[13px] font-semibold border transition cursor-pointer ${
                  filter === f.key ? 'bg-[#5C1A22] text-white border-[#5C1A22]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
            <button
              type="button"
              onClick={exportCsv}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 cursor-pointer"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <SearchableSelect
              containerClassName="block w-full"
              value={departmentId}
              onChange={setDepartmentId}
              options={deptOptions}
              searchPlaceholder="Search departments..."
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm"
            />
            <SearchableSelect
              containerClassName="block w-full"
              value={role}
              onChange={setRole}
              options={[{ value: '', label: 'All roles' }, ...Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))]}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm"
            />
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, Employee ID, designation" className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#7A2430]" />
            </div>
          </div>
        </div>
        {listQ.isLoading ? (
          <div className="py-10 flex justify-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : people.length === 0 ? (
          <EmptyState message="No one matches." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11.5px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2.5">Person</th>
                  <th className="text-left px-3 py-2.5">Department</th>
                  <th className="text-left px-3 py-2.5">Role</th>
                  <th className="text-left px-3 py-2.5">First sign-in</th>
                  <th className="text-left px-3 py-2.5">Last sign-in</th>
                  <th className="text-left px-4 py-2.5">WhatsApp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {people.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5">
                      <button type="button" onClick={() => onShowPerson(u)} className="text-left cursor-pointer group" title="Show this person's activity">
                        <span className="block font-semibold text-slate-800 group-hover:text-[#7A2430]">{u.name}</span>
                        <span className="block text-xs text-slate-500">{[u.employeeId, u.designation].filter(Boolean).join(' · ')}</span>
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{u.department || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-600">{u.roles.map((r: string) => ROLE_LABELS[r] || r).join(', ')}</td>
                    <td className="px-3 py-2.5">
                      {u.status !== 'ACTIVE' ? (
                        <span className="text-xs font-semibold text-slate-500">{u.status}</span>
                      ) : u.firstSignInDone ? (
                        <span className="text-xs font-semibold text-emerald-700">Done</span>
                      ) : (
                        <span className="text-xs font-semibold text-amber-700">Pending</span>
                      )}
                    </td>
                    <td className={`px-3 py-2.5 text-xs whitespace-nowrap ${u.lastLoginAt ? 'text-slate-600' : 'text-slate-400'}`}>{fmtDateTime(u.lastLoginAt)}</td>
                    <td className="px-4 py-2.5 text-xs">{u.hasWhatsapp ? <span className="text-emerald-700 font-semibold">Yes</span> : <span className="text-slate-400">No</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {meta?.totalPages > 1 && (
          <div className="border-t border-slate-100">
            <Pagination page={page} totalPages={meta.totalPages} total={meta.total} onChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
