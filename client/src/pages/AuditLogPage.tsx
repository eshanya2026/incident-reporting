import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  History,
  Users,
  Monitor,
  Clock,
  Moon,
  EyeOff,
  MessageCircle,
  FileText,
  Sparkles,
  ShieldAlert,
  Download,
  ChevronDown,
  ChevronRight,
  X,
  Search,
  Activity,
  LogOut,
  Loader2,
  ClipboardList,
} from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../store/useToastStore';
import { errorMessage } from '../lib/useAction';
import { PageHeader } from '../components/ui/primitives';
import { EmptyState, TabBar } from '../components/ui/listKit';

// ---------- Time (IST) ----------

const IST_OFFSET = 330 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const startOfIstDay = (d: Date) => new Date(Math.floor((d.getTime() + IST_OFFSET) / DAY) * DAY - IST_OFFSET);
const istDateInput = (d: Date) => new Date(d.getTime() + IST_OFFSET).toISOString().slice(0, 10);
const fromDateInput = (v: string) => new Date(new Date(`${v}T00:00:00Z`).getTime() - IST_OFFSET);

const fmt = (d: string | Date, opts: Intl.DateTimeFormatOptions) =>
  new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', ...opts });
const fmtTime = (d: string | Date) => fmt(d, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
const fmtDateTime = (d?: string | Date) => (d ? fmt(d, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—');
const fmtDayHeading = (d: Date) => {
  const day = startOfIstDay(d).getTime();
  const today = startOfIstDay(new Date()).getTime();
  const label = fmt(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return day === today ? `Today · ${label}` : day === today - DAY ? `Yesterday · ${label}` : label;
};
const fmtDuration = (ms?: number) => {
  if (!ms || ms < 1000) return '0m';
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m) return `${m}m`;
  return `${s}s`;
};

// ---------- Categories ----------

const CATEGORIES = [
  { key: 'auth', label: 'Sign-in', color: '#2563EB' },
  { key: 'screen', label: 'Screens', color: '#94A3B8' },
  { key: 'incident', label: 'Incidents', color: '#7A2430' },
  { key: 'report', label: 'Reports & files', color: '#16A34A' },
  { key: 'whatsapp', label: 'WhatsApp', color: '#10B981' },
  { key: 'export', label: 'Downloads', color: '#7C3AED' },
  { key: 'ai', label: 'Ask AI', color: '#EC4899' },
  { key: 'settings', label: 'Settings', color: '#F97316' },
  { key: 'users', label: 'Users', color: '#92400E' },
  { key: 'audit', label: 'Audit', color: '#0EA5E9' },
] as const;
const PRESENCE = { key: 'presence', label: 'Presence', color: '#9CA3AF' };
const catMeta = (key: string) => CATEGORIES.find((c) => c.key === key) ?? (key === 'presence' ? PRESENCE : { key, label: key, color: '#64748B' });

type Preset = 'today' | 'yesterday' | '7d' | '30d' | 'custom';
const PRESETS: Array<{ key: Preset; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'custom', label: 'Custom' },
];

type Tab = 'timeline' | 'people' | 'departments' | 'sessions' | 'ai';
type Person = { _id: string; name: string; username?: string; department?: string };

const SESSION_END_LABEL: Record<string, string> = {
  logout: 'signed out',
  forced: 'ended by Super Admin',
  expired: 'inactive / expired',
  password_changed: 'password changed',
  profile_completed: 'first-login details saved',
};

// ---------- Small pieces ----------

function SplitBar({ active, idle, away }: { active: number; idle: number; away: number }) {
  const total = active + idle + away;
  if (!total) return <div className="h-2 rounded-full bg-slate-100 w-full min-w-[90px]" />;
  const pct = (v: number) => `${(v / total) * 100}%`;
  return (
    <div className="h-2 rounded-full bg-slate-100 w-full min-w-[90px] flex overflow-hidden" title={`Active ${fmtDuration(active)} · Idle ${fmtDuration(idle)} · Away ${fmtDuration(away)}`}>
      <span style={{ width: pct(active), background: '#10B981' }} />
      <span style={{ width: pct(idle), background: '#F59E0B' }} />
      <span style={{ width: pct(away), background: '#94A3B8' }} />
    </div>
  );
}

function TimeSplit({ active, idle, away }: { active: number; idle: number; away: number }) {
  return (
    <div className="space-y-1 min-w-[150px]">
      <SplitBar active={active} idle={idle} away={away} />
      <div className="flex gap-2 text-[11.5px] text-slate-500 whitespace-nowrap">
        <span><b className="text-emerald-700">{fmtDuration(active)}</b> active</span>
        <span><b className="text-amber-700">{fmtDuration(idle)}</b> idle</span>
        <span><b className="text-slate-600">{fmtDuration(away)}</b> away</span>
      </div>
    </div>
  );
}

function Kpi({ label, value, hint, icon: Icon, tone = '#7A2430', alert }: { label: string; value: React.ReactNode; hint?: string; icon: any; tone?: string; alert?: boolean }) {
  return (
    <div className={`relative bg-white rounded-2xl border shadow-card p-4 pl-5 overflow-hidden ${alert ? 'border-red-300 bg-red-50/60' : 'border-slate-200'}`}>
      <span className="absolute left-0 inset-y-0 w-1.5" style={{ background: alert ? '#DC2626' : tone }} />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11.5px] font-semibold text-slate-500 uppercase tracking-wide leading-tight">{label}</p>
        <Icon className="w-4 h-4 shrink-0" style={{ color: alert ? '#DC2626' : tone }} />
      </div>
      <p className={`text-2xl font-extrabold mt-1.5 leading-none ${alert ? 'text-red-700' : 'text-slate-900'}`}>{value}</p>
      {hint && <p className="text-xs text-slate-500 mt-1.5">{hint}</p>}
    </div>
  );
}

function UserPill({ user, onClick }: { user: any; onClick?: () => void }) {
  if (!user) return <span className="text-xs text-slate-400">System</span>;
  const initials = (user.name || '?').split(/\s+/).map((p: string) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      title="Show only this person"
      className="inline-flex items-center gap-1.5 pl-0.5 pr-2.5 py-0.5 rounded-full bg-slate-100 hover:bg-[#F4E6D7] text-xs font-semibold text-slate-700 max-w-[220px] cursor-pointer"
    >
      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-[#5C1A22] to-[#9C3A42] text-white text-[9.5px] flex items-center justify-center shrink-0">{initials}</span>
      <span className="truncate">{user.name}</span>
    </button>
  );
}

const Badge = ({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'maroon' | 'blue' | 'amber' }) => {
  const cls = {
    slate: 'bg-slate-100 text-slate-600 border-slate-200',
    maroon: 'bg-[#FAF3EC] text-[#5C1A22] border-[#E9D3BC]',
    blue: 'bg-sky-50 text-sky-700 border-sky-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
  }[tone];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold whitespace-nowrap ${cls}`}>{children}</span>;
};

/** Person filter: searches all users on the server (name, username, employee ID). */
function PersonPicker({ value, onChange }: { value: Person | null; onChange: (p: Person | null) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const { data, isFetching } = useQuery({
    queryKey: ['audit-person-search', debounced],
    queryFn: () => api.get('/users', { params: { search: debounced || undefined, limit: 25 } }),
    enabled: open,
  });
  const users: any[] = (data as any)?.data || [];
  return (
    <div ref={ref} className="relative w-full sm:w-72">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-left cursor-pointer hover:border-slate-300"
      >
        <span className={`truncate ${value ? 'text-slate-800 font-semibold' : 'text-slate-500'}`}>{value ? value.name : 'All people'}</span>
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full sm:w-96 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, username or employee ID" className="w-full pl-8 pr-2 py-1.5 text-sm bg-slate-50 rounded-lg border border-slate-200 focus:outline-none focus:border-[#7A2430]" />
          </div>
          <ul className="max-h-72 overflow-y-auto divide-y divide-slate-50">
            <li>
              <button type="button" onClick={() => { onChange(null); setOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer text-slate-600">
                All people
              </button>
            </li>
            {users.map((u) => (
              <li key={u._id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange({ _id: u._id, name: u.name, username: u.username, department: u.departmentId?.name });
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 cursor-pointer"
                >
                  <span className="block text-sm font-semibold text-slate-800 truncate">{u.name}</span>
                  <span className="block text-xs text-slate-500 truncate">{[u.username, u.departmentId?.name].filter(Boolean).join(' · ')}</span>
                </button>
              </li>
            ))}
            {!users.length && <li className="px-3 py-3 text-sm text-slate-400">{isFetching ? 'Searching…' : 'No one found'}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------- Page ----------

export default function AuditLogPage() {
  const queryClient = useQueryClient();
  const [preset, setPreset] = useState<Preset>('today');
  const [customFrom, setCustomFrom] = useState(istDateInput(new Date(Date.now() - 6 * DAY)));
  const [customTo, setCustomTo] = useState(istDateInput(new Date()));
  const [person, setPerson] = useState<Person | null>(null);
  const [department, setDepartment] = useState<{ id: string; name: string } | null>(null);
  const [session, setSession] = useState<{ id: string; label: string } | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [presence, setPresence] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tab, setTab] = useState<Tab>('timeline');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [openChats, setOpenChats] = useState<Set<string>>(new Set());
  const openedLogged = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // The window, recomputed each minute so "Today" keeps moving
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 60 * 1000);
    return () => clearInterval(t);
  }, []);
  const range = useMemo(() => {
    const now = new Date(nowTick);
    const today = startOfIstDay(now);
    switch (preset) {
      case 'today':
        return { from: today, to: now };
      case 'yesterday':
        return { from: new Date(today.getTime() - DAY), to: new Date(today.getTime() - 1) };
      case '7d':
        return { from: new Date(today.getTime() - 6 * DAY), to: now };
      case '30d':
        return { from: new Date(today.getTime() - 29 * DAY), to: now };
      default: {
        const from = fromDateInput(customFrom);
        const to = new Date(fromDateInput(customTo).getTime() + DAY - 1);
        return { from, to: to > now ? now : to };
      }
    }
  }, [preset, customFrom, customTo, nowTick]);

  const params = {
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    userId: person?._id,
    departmentId: department?.id,
    sessionId: session?.id,
    categories: categories.join(',') || undefined,
    presence: presence ? 'true' : undefined,
    search: debouncedSearch || undefined,
  };
  // Minute-level key so "Today" refreshes without refetching on every render
  const keyParams = { ...params, from: params.from.slice(0, 16), to: params.to.slice(0, 16) };

  const summaryQ = useQuery({
    queryKey: ['audit-summary', keyParams],
    queryFn: () => {
      const opened = !openedLogged.current;
      openedLogged.current = true;
      return api.get('/audit/summary', { params: { ...params, opened: opened ? 1 : undefined } });
    },
    refetchInterval: 60 * 1000,
  });
  const summary = (summaryQ.data as any)?.data;

  const eventsQ = useInfiniteQuery({
    queryKey: ['audit-events', keyParams],
    queryFn: ({ pageParam }) => api.get('/audit/events', { params: { ...params, limit: 100, before: pageParam || undefined } }),
    initialPageParam: '' as string,
    getNextPageParam: (last: any) => last?.data?.nextCursor || undefined,
    enabled: tab === 'timeline',
  });
  const events: any[] = (eventsQ.data?.pages || []).flatMap((p: any) => p?.data?.items || []);

  const peopleQ = useQuery({ queryKey: ['audit-people', keyParams], queryFn: () => api.get('/audit/people', { params }), enabled: tab === 'people' });
  const deptQ = useQuery({ queryKey: ['audit-depts', keyParams], queryFn: () => api.get('/audit/departments', { params }), enabled: tab === 'departments' });
  const sessionsQ = useQuery({ queryKey: ['audit-sessions', keyParams], queryFn: () => api.get('/audit/sessions', { params }), enabled: tab === 'sessions', refetchInterval: 60 * 1000 });
  const chatsQ = useQuery({ queryKey: ['audit-ai', keyParams], queryFn: () => api.get('/audit/ai-chats', { params }), enabled: tab === 'ai' });

  const people: any[] = (peopleQ.data as any)?.data || [];
  const depts: any[] = (deptQ.data as any)?.data || [];
  const sessions: any[] = (sessionsQ.data as any)?.data || [];
  const chats: any[] = (chatsQ.data as any)?.data || [];

  const groupedEvents = useMemo(() => {
    const groups: Array<{ day: number; heading: string; items: any[] }> = [];
    for (const e of events) {
      const day = startOfIstDay(new Date(e.at)).getTime();
      let g = groups[groups.length - 1];
      if (!g || g.day !== day) {
        g = { day, heading: fmtDayHeading(new Date(e.at)), items: [] };
        groups.push(g);
      }
      g.items.push(e);
    }
    return groups;
  }, [events]);

  const toggleCategory = (key: string) => setCategories((c) => (c.includes(key) ? c.filter((x) => x !== key) : [...c, key]));
  const showPerson = (u: any) => {
    if (!u) return;
    setPerson({ _id: u._id, name: u.name, username: u.username, department: u.department });
    setTab('timeline');
  };
  const clearAll = () => {
    setPerson(null);
    setDepartment(null);
    setSession(null);
    setCategories([]);
    setPresence(false);
    setSearch('');
  };
  const hasFilters = Boolean(person || department || session || categories.length || presence || search);

  const exportCsv = async () => {
    try {
      const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as Array<[string, string]>).toString();
      const res = await fetch(`/api/v1/audit/events/export?${qs}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken') || ''}` },
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `audit_log_${istDateInput(new Date())}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      void queryClient.invalidateQueries({ queryKey: ['audit-events'] });
    } catch (err: any) {
      toast.error(err?.message || 'Export failed');
    }
  };

  const endSession = async (s: any) => {
    if (!window.confirm(`Sign ${s.user?.name || 'this user'} out now? They will have to sign in again.`)) return;
    try {
      await api.post(`/audit/sessions/${s._id}/end`);
      toast.success(`${s.user?.name || 'Session'} has been signed out`);
      void queryClient.invalidateQueries({ queryKey: ['audit-sessions'] });
      void queryClient.invalidateQueries({ queryKey: ['audit-summary'] });
    } catch (err: any) {
      toast.error(errorMessage(err, 'Could not end the session'));
    }
  };

  const tabs = [
    { key: 'timeline' as Tab, label: 'Timeline' },
    { key: 'people' as Tab, label: 'People' },
    { key: 'departments' as Tab, label: 'Departments' },
    { key: 'sessions' as Tab, label: 'Sessions' },
    { key: 'ai' as Tab, label: 'AI Chats' },
  ];

  const loadingSpinner = (
    <div className="py-10 flex justify-center text-slate-400">
      <Loader2 className="w-6 h-6 animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader icon={History} title="Audit Log" description="Who did what, when and from where, and how long people were active. Times are in IST.">
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold border border-white/20 cursor-pointer"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </PageHeader>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPreset(p.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition cursor-pointer ${
                preset === p.key ? 'bg-[#5C1A22] text-white border-[#5C1A22]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {p.label}
            </button>
          ))}
          {preset === 'custom' && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-semibold text-slate-500">From</label>
              <input type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm" />
              <label className="text-xs font-semibold text-slate-500">To</label>
              <input type="date" value={customTo} min={customFrom} max={istDateInput(new Date())} onChange={(e) => setCustomTo(e.target.value)} className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm" />
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <PersonPicker value={person} onChange={setPerson} />
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search descriptions or incident no." className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#7A2430]" />
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none sm:ml-auto">
            <input type="checkbox" checked={presence} onChange={(e) => setPresence(e.target.checked)} className="accent-[#7A2430] w-4 h-4" />
            Show presence (tab switches, idle, window closed)
          </label>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => {
            const on = categories.includes(c.key);
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => toggleCategory(c.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-semibold border transition cursor-pointer ${
                  on ? 'text-white' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
                style={on ? { background: c.color, borderColor: c.color } : undefined}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: on ? '#fff' : c.color }} />
                {c.label}
              </button>
            );
          })}
        </div>

        {hasFilters && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-500 mr-1">Filters:</span>
            {person && <FilterTag label={`Person: ${person.name}`} onClear={() => setPerson(null)} />}
            {department && <FilterTag label={`Department: ${department.name}`} onClear={() => setDepartment(null)} />}
            {session && <FilterTag label={`Session: ${session.label}`} onClear={() => setSession(null)} />}
            {categories.map((c) => <FilterTag key={c} label={catMeta(c).label} onClear={() => toggleCategory(c)} />)}
            {presence && <FilterTag label="Presence shown" onClear={() => setPresence(false)} />}
            {search && <FilterTag label={`"${search}"`} onClear={() => setSearch('')} />}
            <button type="button" onClick={clearAll} className="text-xs font-semibold text-[#7A2430] hover:underline ml-1 cursor-pointer">
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Metric tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Kpi label="People active" value={summary?.peopleActive ?? '—'} icon={Users} tone="#7A2430" />
        <Kpi label="Sessions" value={summary?.sessions ?? '—'} hint={summary ? `${summary.onlineNow} online now` : undefined} icon={Monitor} tone="#2563EB" />
        <Kpi label="Active time" value={summary ? fmtDuration(summary.activeMs) : '—'} hint="Mouse / keyboard in use" icon={Activity} tone="#10B981" />
        <Kpi label="Idle time" value={summary ? fmtDuration(summary.idleMs) : '—'} hint="Open, 5+ min without input" icon={Moon} tone="#F59E0B" />
        <Kpi label="Away from tab" value={summary ? fmtDuration(summary.awayMs) : '—'} hint="Tab hidden or minimised" icon={EyeOff} tone="#64748B" />
        <Kpi label="Incident actions" value={summary?.incidentActions ?? '—'} hint="Reported, assigned, reviewed…" icon={ClipboardList} tone="#7A2430" />
        <Kpi label="WhatsApp sent" value={summary?.whatsappSent ?? '—'} hint={summary ? `${summary.whatsappFailed} failed` : undefined} icon={MessageCircle} tone="#10B981" alert={Boolean(summary?.whatsappFailed) && !summary?.whatsappSent} />
        <Kpi label="PDFs opened" value={summary?.pdfsOpened ?? '—'} hint={summary ? `${summary.downloads} downloads in all` : undefined} icon={FileText} tone="#7C3AED" />
        <Kpi label="Ask AI questions" value={summary?.aiQuestions ?? '—'} icon={Sparkles} tone="#EC4899" />
        <Kpi label="Failed sign-ins" value={summary?.failedSignIns ?? '—'} hint="Wrong password, unknown user, locked" icon={ShieldAlert} tone="#2563EB" alert={(summary?.failedSignIns ?? 0) > 0} />
      </div>

      <TabBar tabs={tabs} active={tab} onChange={(k) => setTab(k)} />

      {/* Timeline */}
      {tab === 'timeline' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          {eventsQ.isLoading ? (
            loadingSpinner
          ) : events.length === 0 ? (
            <EmptyState message="Nothing recorded for these filters." />
          ) : (
            <div>
              {groupedEvents.map((g) => (
                <div key={g.day}>
                  <div className="sticky top-0 z-10 px-4 py-2 bg-slate-50/95 backdrop-blur border-y border-slate-100 text-xs font-bold text-slate-600 uppercase tracking-wide">
                    {g.heading}
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {g.items.map((e) => {
                      const c = catMeta(e.category);
                      const open = expanded === e._id;
                      return (
                        <li key={e._id}>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setExpanded(open ? null : e._id)}
                            onKeyDown={(k) => k.key === 'Enter' && setExpanded(open ? null : e._id)}
                            className={`px-4 py-2.5 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 cursor-pointer ${open ? 'bg-[#FBF6EE]' : 'hover:bg-slate-50'}`}
                          >
                            <div className="flex items-center gap-2.5 shrink-0">
                              {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-300" />}
                              <span className="text-xs font-mono text-slate-500 w-[86px]">{fmtTime(e.at)}</span>
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} title={c.label} />
                            </div>
                            <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5">
                              <span className="text-sm text-slate-800 break-words">{e.description}</span>
                              {e.incidentNumber && <Badge tone="maroon">{e.incidentNumber}</Badge>}
                              {e.uhid && <Badge tone="blue">UHID {e.uhid}</Badge>}
                              {e.durationMs ? <Badge>{fmtDuration(e.durationMs)}</Badge> : null}
                            </div>
                            <div className="shrink-0 pl-6 sm:pl-0">
                              <UserPill user={e.user} onClick={() => showPerson(e.user)} />
                            </div>
                          </div>
                          {open && <EventDetail e={e} onSession={() => { setSession({ id: e.sessionId, label: `${e.user?.name || ''} ${fmtDateTime(e.at)}` }); setExpanded(null); }} />}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              {eventsQ.hasNextPage && (
                <div className="p-4 flex justify-center border-t border-slate-100">
                  <button
                    type="button"
                    disabled={eventsQ.isFetchingNextPage}
                    onClick={() => void eventsQ.fetchNextPage()}
                    className="px-5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 disabled:opacity-60 cursor-pointer"
                  >
                    {eventsQ.isFetchingNextPage ? 'Loading…' : 'Show 100 more'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* People */}
      {tab === 'people' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-x-auto">
          {peopleQ.isLoading ? (
            loadingSpinner
          ) : people.length === 0 ? (
            <EmptyState message="No one was active in this window." />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11.5px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2.5">Person</th>
                  <th className="text-right px-3 py-2.5">Sessions</th>
                  <th className="text-left px-3 py-2.5">First sign-in</th>
                  <th className="text-left px-3 py-2.5">Last seen</th>
                  <th className="text-left px-3 py-2.5">Time</th>
                  <th className="text-right px-3 py-2.5">Actions</th>
                  <th className="text-right px-3 py-2.5">Incident steps</th>
                  <th className="text-right px-3 py-2.5">WhatsApp sent / failed</th>
                  <th className="text-right px-3 py-2.5">PDFs</th>
                  <th className="text-right px-3 py-2.5">AI</th>
                  <th className="text-right px-4 py-2.5">Failed sign-ins</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {people.map((p) => (
                  <tr key={p.user._id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5">
                      <button type="button" onClick={() => showPerson(p.user)} className="text-left cursor-pointer group">
                        <span className="font-semibold text-slate-800 group-hover:text-[#7A2430] flex items-center gap-1.5">
                          {p.online && <span className="w-2 h-2 rounded-full bg-emerald-500" title="Online now" />}
                          {p.user.name}
                        </span>
                        <span className="block text-xs text-slate-500">{[p.user.username, p.user.roles?.join(', '), p.user.department].filter(Boolean).join(' · ')}</span>
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold">{p.sessions}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">{fmtDateTime(p.firstSignIn)}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">{fmtDateTime(p.lastSeen)}</td>
                    <td className="px-3 py-2.5"><TimeSplit active={p.activeMs} idle={p.idleMs} away={p.awayMs} /></td>
                    <td className="px-3 py-2.5 text-right font-semibold">{p.actions}</td>
                    <td className="px-3 py-2.5 text-right">{p.incidentActions}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">{p.whatsappSent} / <span className={p.whatsappFailed ? 'text-red-600 font-semibold' : ''}>{p.whatsappFailed}</span></td>
                    <td className="px-3 py-2.5 text-right">{p.pdfs}</td>
                    <td className="px-3 py-2.5 text-right">{p.aiQuestions}</td>
                    <td className={`px-4 py-2.5 text-right ${p.failedSignIns ? 'text-red-600 font-bold' : ''}`}>{p.failedSignIns}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Departments */}
      {tab === 'departments' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-x-auto">
          {deptQ.isLoading ? (
            loadingSpinner
          ) : depts.length === 0 ? (
            <EmptyState message="No activity in this window." />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11.5px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2.5">Department</th>
                  <th className="text-right px-3 py-2.5">People</th>
                  <th className="text-right px-3 py-2.5">Sessions</th>
                  <th className="text-left px-3 py-2.5">Active vs idle</th>
                  <th className="text-right px-3 py-2.5">Actions</th>
                  <th className="text-right px-3 py-2.5">Incident steps</th>
                  <th className="text-right px-3 py-2.5">WhatsApp sent / failed</th>
                  <th className="text-right px-3 py-2.5">PDFs</th>
                  <th className="text-right px-4 py-2.5">AI questions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {depts.map((d) => (
                  <tr key={d.departmentId ?? 'none'} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5">
                      {d.departmentId ? (
                        <button
                          type="button"
                          onClick={() => {
                            setDepartment({ id: d.departmentId, name: d.department });
                            setTab('people');
                          }}
                          className="font-semibold text-slate-800 hover:text-[#7A2430] text-left cursor-pointer"
                          title="Show this department's people"
                        >
                          {d.department}
                        </button>
                      ) : (
                        <span className="font-semibold text-slate-500">{d.department}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">{d.people}</td>
                    <td className="px-3 py-2.5 text-right">{d.sessions}</td>
                    <td className="px-3 py-2.5"><TimeSplit active={d.activeMs} idle={d.idleMs} away={d.awayMs} /></td>
                    <td className="px-3 py-2.5 text-right font-semibold">{d.actions}</td>
                    <td className="px-3 py-2.5 text-right">{d.incidentActions}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">{d.whatsappSent} / <span className={d.whatsappFailed ? 'text-red-600 font-semibold' : ''}>{d.whatsappFailed}</span></td>
                    <td className="px-3 py-2.5 text-right">{d.pdfs}</td>
                    <td className="px-4 py-2.5 text-right">{d.aiQuestions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Sessions */}
      {tab === 'sessions' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-x-auto">
          {sessionsQ.isLoading ? (
            loadingSpinner
          ) : sessions.length === 0 ? (
            <EmptyState message="No sessions in this window." />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11.5px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2.5">Person</th>
                  <th className="text-left px-3 py-2.5">Signed in</th>
                  <th className="text-left px-3 py-2.5">Status</th>
                  <th className="text-right px-3 py-2.5">Length</th>
                  <th className="text-left px-3 py-2.5">Presence</th>
                  <th className="text-left px-3 py-2.5">Device &amp; IP</th>
                  <th className="text-right px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.map((s) => (
                  <tr key={s._id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5">
                      <UserPill user={s.user} onClick={() => showPerson(s.user)} />
                      {s.current && <span className="block text-[11px] text-slate-400 mt-0.5 pl-1">This is you</span>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">{fmtDateTime(s.startedAt)}</td>
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                      {s.status === 'online' ? (
                        <span className="text-emerald-700 font-semibold">● Online now <span className="font-normal text-slate-500">({s.state})</span></span>
                      ) : s.status === 'inactive' ? (
                        <span className="text-amber-700 font-semibold">Inactive · last seen {fmtTime(s.lastSeenAt)}</span>
                      ) : (
                        <span className="text-slate-600">
                          {fmtDateTime(s.endedAt)} <span className="text-slate-400">· {SESSION_END_LABEL[s.endReason] || s.endReason}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">{fmtDuration(s.lengthMs)}</td>
                    <td className="px-3 py-2.5"><TimeSplit active={s.activeMs} idle={s.idleMs} away={s.awayMs} /></td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">
                      <span className="block font-semibold text-slate-700">{s.device}</span>
                      <span className="font-mono">{s.ipAddress || '—'}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setSession({ id: s._id, label: `${s.user?.name || ''} ${fmtDateTime(s.startedAt)}` });
                          setTab('timeline');
                        }}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer mr-1.5"
                      >
                        Timeline
                      </button>
                      {s.status !== 'ended' && !s.current && (
                        <button
                          type="button"
                          onClick={() => endSession(s)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-700 cursor-pointer"
                          title="Sign this person out now"
                        >
                          <LogOut className="w-3.5 h-3.5" /> Sign out
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* AI Chats */}
      {tab === 'ai' && (
        <div className="space-y-2">
          {chatsQ.isLoading ? (
            loadingSpinner
          ) : chats.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200"><EmptyState message="No Ask AI conversations in this window." /></div>
          ) : (
            chats.map((t, idx) => {
              const key = `${t.threadId ?? 'single'}-${idx}`;
              const open = openChats.has(key);
              return (
                <div key={key} className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenChats((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; })}
                    className="w-full text-left px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 hover:bg-slate-50 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {open ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />}
                      <Sparkles className="w-4 h-4 text-pink-500 shrink-0" />
                      <span className="text-sm font-semibold text-slate-800 truncate">{t.openingQuestion}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 pl-6 sm:pl-0">
                      <Badge>{t.turnCount} {t.turnCount === 1 ? 'question' : 'questions'}</Badge>
                      <span className="text-xs text-slate-500 whitespace-nowrap">{fmtDateTime(t.startedAt)}</span>
                      <UserPill user={t.user} onClick={() => showPerson(t.user)} />
                    </div>
                  </button>
                  {open && (
                    <div className="border-t border-slate-100 px-4 py-3 space-y-3 bg-slate-50/50">
                      {t.turns.map((turn: any, i: number) => (
                        <div key={i} className="space-y-2">
                          <div className="flex justify-end">
                            <div className="max-w-[90%] bg-[#5C1A22] text-white rounded-2xl rounded-tr-sm px-3.5 py-2 text-sm">
                              <div className="whitespace-pre-wrap break-words">{turn.question}</div>
                              <div className="text-[11px] text-white/70 mt-1 text-right">{fmtDateTime(turn.at)}</div>
                            </div>
                          </div>
                          <div className="max-w-[95%] bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm">
                            {turn.ok ? (
                              <div className="whitespace-pre-wrap break-words text-slate-800">{turn.answer || <span className="text-slate-400 italic">Answer not stored (asked before chats were recorded)</span>}</div>
                            ) : (
                              <div className="text-red-700">The AI could not answer: {turn.error || 'unknown error'}</div>
                            )}
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {(turn.lookups || []).map((l: string, j: number) => <Badge key={j} tone="blue">{l}</Badge>)}
                              {turn.model && <Badge>{turn.model}</Badge>}
                              {turn.usedFallback && <Badge tone="amber">Fallback model answered</Badge>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function FilterTag({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-[#FAF3EC] border border-[#E9D3BC] text-xs font-semibold text-[#5C1A22]">
      {label}
      <button type="button" onClick={onClear} aria-label={`Remove ${label}`} className="p-0.5 rounded-full hover:bg-[#F4E6D7] cursor-pointer">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

function EventDetail({ e, onSession }: { e: any; onSession: () => void }) {
  const aiAnswer = e.details?.meta?.answer;
  const rows: Array<[string, React.ReactNode]> = [
    ['Time (IST)', fmt(e.at, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })],
    ['Action code', <span className="font-mono">{e.action}</span>],
    ['Category', catMeta(e.category).label],
    ['Person', e.user ? `${e.user.name} (${[e.user.username, e.user.employeeId].filter(Boolean).join(' · ')})` : 'System'],
    ['Role & designation', e.user ? [e.user.roles?.join(', '), e.user.designation, e.user.department].filter(Boolean).join(' · ') || '—' : '—'],
    [
      'Incident',
      e.incidentNumber ? (
        e.incidentId ? <Link to={`/incidents/${e.incidentId}`} className="text-[#7A2430] font-semibold hover:underline">{e.incidentNumber}</Link> : e.incidentNumber
      ) : (
        '—'
      ),
    ],
    ['Patient UHID', e.uhid || '—'],
    ['Screen', e.screen || '—'],
    ['IP address', <span className="font-mono">{e.ipAddress || '—'}</span>],
    ['Device / browser', <span className="break-all">{e.userAgent || '—'}</span>],
  ];
  return (
    <div className="px-4 sm:pl-12 pb-4 pt-1 bg-[#FBF6EE] border-t border-[#F1E4D3]">
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-2 min-w-0">
            <dt className="text-slate-500 w-36 shrink-0">{k}</dt>
            <dd className="text-slate-800 min-w-0">{v}</dd>
          </div>
        ))}
      </dl>
      {e.sessionId && (
        <button type="button" onClick={onSession} className="mt-2 text-sm font-semibold text-[#7A2430] hover:underline cursor-pointer">
          Show this session →
        </button>
      )}
      {aiAnswer && (
        <div className="mt-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">AI's complete answer</p>
          <div className="whitespace-pre-wrap text-sm bg-white border border-slate-200 rounded-xl p-3 max-h-80 overflow-y-auto">{aiAnswer}</div>
        </div>
      )}
      <details className="mt-3">
        <summary className="text-xs font-bold text-slate-500 uppercase tracking-wide cursor-pointer">Full details (JSON)</summary>
        <pre className="mt-1 text-xs bg-white border border-slate-200 rounded-xl p-3 overflow-x-auto max-h-80">{JSON.stringify(e.details, null, 2)}</pre>
      </details>
    </div>
  );
}
