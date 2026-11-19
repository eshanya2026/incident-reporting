import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  MessageCircle,
  Send,
  CheckCheck,
  Eye,
  XCircle,
  UserX,
  Clock,
  Download,
  Search,
  RotateCcw,
  AlertTriangle,
  Copy,
  Loader2,
} from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../store/useToastStore';
import { errorMessage } from '../lib/useAction';
import { PageHeader } from '../components/ui/primitives';
import { EmptyState, Pagination } from '../components/ui/listKit';
import { SearchableSelect } from '../components/ui/SearchableSelect';

// ---------- Time (IST) ----------

const IST_OFFSET = 330 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const startOfIstDay = (d: Date) => new Date(Math.floor((d.getTime() + IST_OFFSET) / DAY) * DAY - IST_OFFSET);
const istDateInput = (d: Date) => new Date(d.getTime() + IST_OFFSET).toISOString().slice(0, 10);
const fromDateInput = (v: string) => new Date(new Date(`${v}T00:00:00Z`).getTime() - IST_OFFSET);
const fmt = (d: string | Date, o: Intl.DateTimeFormatOptions) => new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', ...o });
const fmtDateTime = (d?: string) => (d ? fmt(d, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }) : '');
const fmtTime = (d?: string) => (d ? fmt(d, { hour: '2-digit', minute: '2-digit', hour12: true }) : '');
const fmtDuration = (ms?: number | null) => {
  if (ms === null || ms === undefined) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

// ---------- Labels and colours ----------

export const NOTIFICATION_LABELS: Record<string, string> = {
  HOD_ASSIGNED: 'Assigned to HOD',
  REPORTER_INFO_REQUEST: 'Question to reporter',
  INVOLVED_DEPARTMENT: 'Involved department',
  INTIMATED: 'Intimated (CC)',
  RCA_MEETING_SCHEDULED: 'RCA meeting scheduled',
  TEST: 'Test send',
  OTHER: 'Other',
};
const ROLE_LABELS: Record<string, string> = {
  STAFF: 'Staff',
  QUALITY: 'Quality',
  HOD: 'HOD',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super Admin',
  RCA_HEAD: 'RCA Head',
  INTIMATION_MEMBER: 'Intimation member',
  NONE: 'No role',
};

// Validated palette (dataviz validator, light surface): stacked bottom-to-top in this order
const SERIES = [
  { key: 'failed', label: 'Failed', color: '#DC2626' },
  { key: 'readOnly', label: 'Read', color: '#047857' },
  { key: 'deliveredOnly', label: 'Delivered (not read yet)', color: '#0284C7' },
  { key: 'awaiting', label: 'Sent, awaiting update', color: '#7C3AED' },
  { key: 'skipped', label: 'Not sent', color: '#D97706' },
] as const;

const STATUS_META: Record<string, { label: string; cls: string }> = {
  SKIPPED: { label: 'Not sent', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  PENDING: { label: 'Sending', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  SENT: { label: 'Sent', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  DELIVERED: { label: 'Delivered', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  READ: { label: 'Read', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REPLIED: { label: 'Replied', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  FAILED: { label: 'Failed', cls: 'bg-red-50 text-red-700 border-red-200' },
};
const STATUS_FILTERS = ['FAILED', 'SKIPPED', 'SENT', 'DELIVERED', 'READ', 'REPLIED'];

type Preset = 'today' | '7d' | '30d' | '90d' | 'custom';
const PRESETS: Array<{ key: Preset; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
  { key: 'custom', label: 'Custom' },
];

const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v}%`);
const rateOf = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');

function Kpi({ label, value, hint, icon: Icon, tone, alert }: { label: string; value: React.ReactNode; hint?: string; icon: any; tone: string; alert?: boolean }) {
  return (
    <div className={`relative bg-white rounded-2xl border shadow-card p-4 pl-5 overflow-hidden ${alert ? 'border-red-300 bg-red-50/50' : 'border-slate-200'}`}>
      <span className="absolute left-0 inset-y-0 w-1.5" style={{ background: tone }} />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11.5px] font-semibold text-slate-500 uppercase tracking-wide leading-tight">{label}</p>
        <Icon className="w-4 h-4 shrink-0" style={{ color: tone }} />
      </div>
      <p className={`text-2xl font-extrabold mt-1.5 leading-none ${alert ? 'text-red-700' : 'text-slate-900'}`}>{value}</p>
      {hint && <p className="text-xs text-slate-500 mt-1.5">{hint}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600 border-slate-200' };
  return <span className={`inline-flex px-2 py-0.5 rounded-full border text-[11.5px] font-bold whitespace-nowrap ${m.cls}`}>{m.label}</span>;
}

/** Breakdown table (by notification, role or department). */
function Breakdown({ title, rows, labelOf, onPick }: { title: string; rows: any[]; labelOf: (r: any) => string; onPick?: (r: any) => void }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
      <h3 className="px-4 py-3 text-sm font-bold text-slate-800 border-b border-slate-100">{title}</h3>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-400">No messages</p>
      ) : (
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 sticky top-0">
              <tr>
                <th className="text-left px-4 py-2"></th>
                <th className="text-right px-2 py-2">Total</th>
                <th className="text-right px-2 py-2">Sent</th>
                <th className="text-right px-2 py-2">Delivered</th>
                <th className="text-right px-2 py-2">Read</th>
                <th className="text-right px-2 py-2">Failed</th>
                <th className="text-right px-2 py-2">Not sent</th>
                <th className="text-right px-4 py-2">Delivery %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50/70">
                  <td className="px-4 py-2">
                    {onPick ? (
                      <button type="button" onClick={() => onPick(r)} className="font-semibold text-slate-800 hover:text-[#7A2430] text-left cursor-pointer">
                        {labelOf(r)}
                      </button>
                    ) : (
                      <span className="font-semibold text-slate-800">{labelOf(r)}</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right font-semibold">{r.total}</td>
                  <td className="px-2 py-2 text-right">{r.sent}</td>
                  <td className="px-2 py-2 text-right">{r.delivered}</td>
                  <td className="px-2 py-2 text-right">{r.read}</td>
                  <td className={`px-2 py-2 text-right ${r.failed ? 'text-red-600 font-semibold' : ''}`}>{r.failed}</td>
                  <td className={`px-2 py-2 text-right ${r.skipped ? 'text-amber-700 font-semibold' : ''}`}>{r.skipped}</td>
                  <td className="px-4 py-2 text-right">{rateOf(r.delivered, r.sent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function WhatsappDeliveryPage() {
  const queryClient = useQueryClient();
  const [preset, setPreset] = useState<Preset>('30d');
  const [customFrom, setCustomFrom] = useState(istDateInput(new Date(Date.now() - 29 * DAY)));
  const [customTo, setCustomTo] = useState(istDateInput(new Date()));
  const [statuses, setStatuses] = useState<string[]>([]);
  const [notificationKey, setNotificationKey] = useState('');
  const [role, setRole] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [preset, customFrom, customTo, statuses, notificationKey, role, departmentId, debouncedSearch]);

  const range = useMemo(() => {
    const now = new Date();
    const today = startOfIstDay(now);
    if (preset === 'today') return { from: today, to: now };
    if (preset === '7d') return { from: new Date(today.getTime() - 6 * DAY), to: now };
    if (preset === '30d') return { from: new Date(today.getTime() - 29 * DAY), to: now };
    if (preset === '90d') return { from: new Date(today.getTime() - 89 * DAY), to: now };
    const to = new Date(fromDateInput(customTo).getTime() + DAY - 1);
    return { from: fromDateInput(customFrom), to: to > now ? now : to };
  }, [preset, customFrom, customTo]);

  const params = {
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    status: statuses.join(',') || undefined,
    notificationKey: notificationKey || undefined,
    role: role || undefined,
    departmentId: departmentId || undefined,
    search: debouncedSearch || undefined,
  };
  const key = { ...params, from: params.from.slice(0, 13), to: params.to.slice(0, 13) };

  const summaryQ = useQuery({ queryKey: ['wa-summary', key], queryFn: () => api.get('/whatsapp-delivery/summary', { params }), refetchInterval: 60 * 1000 });
  const messagesQ = useQuery({
    queryKey: ['wa-messages', key, page],
    queryFn: () => api.get('/whatsapp-delivery/messages', { params: { ...params, page, limit: 50 } }),
    refetchInterval: 60 * 1000,
  });
  const s = (summaryQ.data as any)?.data;
  const t = s?.totals;
  const messages: any[] = (messagesQ.data as any)?.data || [];
  const meta = (messagesQ.data as any)?.meta || (messagesQ.data as any)?.pagination;

  const daily = useMemo(
    () =>
      (s?.daily || []).map((d: any) => ({
        day: fmt(`${d.day}T12:00:00+05:30`, { day: '2-digit', month: 'short' }),
        failed: d.failed,
        readOnly: d.read,
        deliveredOnly: d.delivered - d.read,
        awaiting: d.sent - d.delivered,
        skipped: d.skipped,
      })),
    [s]
  );

  const toggleStatus = (st: string) => setStatuses((c) => (c.includes(st) ? c.filter((x) => x !== st) : [...c, st]));

  const exportCsv = async () => {
    try {
      const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as Array<[string, string]>).toString();
      const res = await fetch(`/api/v1/whatsapp-delivery/messages/export?${qs}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken') || ''}` },
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `whatsapp_delivery_${istDateInput(new Date())}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err: any) {
      toast.error(err?.message || 'Export failed');
    }
  };

  const resend = async (m: any) => {
    try {
      const res: any = await api.post(`/whatsapp-delivery/messages/${m._id}/resend`);
      toast.success(res?.message || 'Sent again');
      void queryClient.invalidateQueries({ queryKey: ['wa-messages'] });
      void queryClient.invalidateQueries({ queryKey: ['wa-summary'] });
    } catch (err: any) {
      toast.error(errorMessage(err, 'Could not send again'));
    }
  };

  const setup = s?.setup;
  const needsWebhook = setup && (!setup.webhookSecretConfigured || !setup.lastWebhookAt);
  const departments: any[] = s?.byDepartment || [];
  const hasFilters = Boolean(statuses.length || notificationKey || role || departmentId || search);

  return (
    <div className="space-y-5">
      <PageHeader icon={MessageCircle} title="WhatsApp Delivery" description="Every WhatsApp notification: who it went to, whether it was delivered and read, and why any failed. Times in IST.">
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold border border-white/20 cursor-pointer"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </PageHeader>

      {setup && !setup.sendingEnabled && (
        <div className="flex gap-2 p-3.5 rounded-xl border border-amber-300 bg-amber-50 text-sm text-amber-900">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          WhatsApp sending is switched off on this server (WHATSAPP_NOTIFICATIONS / WATI settings), so no new messages will appear here.
        </div>
      )}
      {needsWebhook && (
        <div className="p-4 rounded-xl border border-sky-200 bg-sky-50 text-sm text-sky-900 space-y-2">
          <p className="font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Delivered / read / failed need WATI's webhook
          </p>
          {!setup.webhookSecretConfigured ? (
            <p>
              Set <code className="px-1 bg-white rounded">WATI_WEBHOOK_SECRET</code> (a random value of 16+ characters) in the server's .env and redeploy. The
              webhook address to give WATI will then appear here.
            </p>
          ) : (
            <>
              <p>
                In WATI: <b>Connector → Webhooks → Add Webhook</b>, paste this URL, set it to <b>Enabled</b> and tick <b>Template Message Sent, Delivered,
                Read, Replied</b> and <b>Failed</b>. No updates have arrived yet.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 truncate px-2 py-1.5 bg-white border border-sky-200 rounded-lg text-xs">{setup.webhookUrl}</code>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(setup.webhookUrl);
                    toast.success('Webhook URL copied');
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-sky-200 text-xs font-semibold cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy
                </button>
              </div>
            </>
          )}
          <p className="text-xs text-sky-800">Until then, messages show as "Sent" (accepted by WATI) or "Failed" (refused by WATI).</p>
        </div>
      )}

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <SearchableSelect
            containerClassName="block w-full"
            value={notificationKey}
            onChange={setNotificationKey}
            options={[{ value: '', label: 'All notifications' }, ...Object.entries(NOTIFICATION_LABELS).map(([value, label]) => ({ value, label }))]}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm"
          />
          <SearchableSelect
            containerClassName="block w-full"
            value={role}
            onChange={setRole}
            options={[{ value: '', label: 'All roles' }, ...Object.entries(ROLE_LABELS).filter(([k]) => k !== 'NONE').map(([value, label]) => ({ value, label }))]}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm"
          />
          <SearchableSelect
            containerClassName="block w-full"
            value={departmentId}
            onChange={setDepartmentId}
            options={[
              { value: '', label: 'All departments' },
              ...departments.filter((d) => d.departmentId).map((d) => ({ value: d.departmentId, label: d.department })),
              ...(departmentId && !departments.some((d) => d.departmentId === departmentId) ? [{ value: departmentId, label: 'Selected department' }] : []),
            ]}
            searchPlaceholder="Search departments..."
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm"
          />
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, number, incident, reason" className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#7A2430]" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTERS.map((st) => {
            const on = statuses.includes(st);
            return (
              <button
                key={st}
                type="button"
                onClick={() => toggleStatus(st)}
                className={`px-3 py-1 rounded-full text-[13px] font-semibold border transition cursor-pointer ${on ? 'bg-[#5C1A22] text-white border-[#5C1A22]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >
                {STATUS_META[st].label}
              </button>
            );
          })}
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setStatuses([]);
                setNotificationKey('');
                setRole('');
                setDepartmentId('');
                setSearch('');
              }}
              className="text-xs font-semibold text-[#7A2430] hover:underline ml-2 cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Notifications" value={t?.total ?? '—'} hint="Sent or attempted" icon={MessageCircle} tone="#7A2430" />
        <Kpi label="Sent" value={t?.sent ?? '—'} hint="Accepted by WATI" icon={Send} tone="#7C3AED" />
        <Kpi label="Delivered" value={t?.delivered ?? '—'} hint={t ? `${pct(t.deliveryRate)} of sent · avg ${fmtDuration(s?.avgTimeToDeliverMs)}` : undefined} icon={CheckCheck} tone="#0284C7" />
        <Kpi label="Read" value={t?.read ?? '—'} hint={t ? `${pct(t.readRate)} of delivered · avg ${fmtDuration(s?.avgTimeToReadMs)}` : undefined} icon={Eye} tone="#047857" />
        <Kpi label="Failed" value={t?.failed ?? '—'} hint={t ? `${pct(t.failureRate)} of attempts` : undefined} icon={XCircle} tone="#DC2626" alert={(t?.failed ?? 0) > 0} />
        <Kpi label="Not sent" value={t?.skipped ?? '—'} hint="No WhatsApp number on profile" icon={UserX} tone="#D97706" />
      </div>

      {/* Trend */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-4">
        <h3 className="text-sm font-bold text-slate-800 mb-3">Messages per day by outcome</h3>
        {summaryQ.isLoading ? (
          <div className="h-64 flex items-center justify-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : daily.length === 0 ? (
          <EmptyState message="No WhatsApp messages in this period." />
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barCategoryGap="25%">
                <CartesianGrid vertical={false} stroke="#EEF2F6" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'rgba(15,23,42,0.04)' }} contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
                {SERIES.map((ser, i) => (
                  <Bar
                    key={ser.key}
                    dataKey={ser.key}
                    name={ser.label}
                    stackId="a"
                    fill={ser.color}
                    stroke="#fff"
                    strokeWidth={1}
                    radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : 0}
                    maxBarSize={36}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Breakdown title="By notification" rows={s?.byType || []} labelOf={(r) => NOTIFICATION_LABELS[r.key] || r.key} onPick={(r) => setNotificationKey(r.key)} />
        <Breakdown title="By recipient role" rows={s?.byRole || []} labelOf={(r) => ROLE_LABELS[r.role] || r.role} onPick={(r) => r.role !== 'NONE' && setRole(r.role)} />
        <Breakdown title="By recipient department" rows={departments} labelOf={(r) => r.department} onPick={(r) => setDepartmentId(r.departmentId || 'none')} />
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
          <h3 className="px-4 py-3 text-sm font-bold text-slate-800 border-b border-slate-100">Why messages failed or were not sent</h3>
          {(s?.failureReasons || []).length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-400">No failures in this period.</p>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {s.failureReasons.map((r: any, i: number) => (
                <li key={i} className="px-4 py-2.5 flex items-start gap-3">
                  <span className={`mt-0.5 shrink-0 w-8 text-right font-extrabold ${r.status === 'SKIPPED' ? 'text-amber-700' : 'text-red-600'}`}>{r.count}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">
                      {r.reason}
                      {r.code && <span className="ml-1.5 text-xs font-mono text-slate-400">#{r.code}</span>}
                    </p>
                    {r.hint && <p className="text-xs text-slate-500 mt-0.5">{r.hint}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <h3 className="px-4 py-3 text-sm font-bold text-slate-800 border-b border-slate-100">Messages</h3>
        {messagesQ.isLoading ? (
          <div className="py-10 flex justify-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : messages.length === 0 ? (
          <EmptyState message="No messages match these filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11.5px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2.5">When</th>
                  <th className="text-left px-3 py-2.5">Recipient</th>
                  <th className="text-left px-3 py-2.5">Notification</th>
                  <th className="text-left px-3 py-2.5">Status</th>
                  <th className="text-left px-3 py-2.5">Progress</th>
                  <th className="text-left px-3 py-2.5">Reason</th>
                  <th className="text-left px-3 py-2.5">Triggered by</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {messages.map((m) => (
                  <React.Fragment key={m._id}>
                    <tr className="hover:bg-slate-50/70 align-top cursor-pointer" onClick={() => setExpanded(expanded === m._id ? null : m._id)}>
                      <td className="px-4 py-2.5 text-xs text-slate-600 whitespace-nowrap">{fmtDateTime(m.createdAt)}</td>
                      <td className="px-3 py-2.5">
                        <span className="block font-semibold text-slate-800">{m.recipient.name || '—'}</span>
                        <span className="block text-xs text-slate-500">
                          {[(m.recipient.roles || []).map((r: string) => ROLE_LABELS[r] || r).join(', '), m.recipient.department].filter(Boolean).join(' · ') || '—'}
                        </span>
                        {m.to && <span className="block text-xs font-mono text-slate-400">+{m.to}</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="block text-slate-700">{NOTIFICATION_LABELS[m.notificationKey] || m.notificationKey}</span>
                        {m.incidentNumber &&
                          (m.incidentId ? (
                            <Link to={`/incidents/${m.incidentId}`} onClick={(e) => e.stopPropagation()} className="text-xs font-semibold text-[#7A2430] hover:underline">
                              {m.incidentNumber}
                            </Link>
                          ) : (
                            <span className="text-xs text-slate-500">{m.incidentNumber}</span>
                          ))}
                      </td>
                      <td className="px-3 py-2.5"><StatusBadge status={m.status} /></td>
                      <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                        {m.sentAt && <span className="block">Sent {fmtTime(m.sentAt)}</span>}
                        {m.deliveredAt && <span className="block text-sky-700">Delivered {fmtTime(m.deliveredAt)}</span>}
                        {m.readAt && <span className="block text-emerald-700">Read {fmtTime(m.readAt)}</span>}
                        {m.repliedAt && <span className="block text-emerald-800">Replied {fmtTime(m.repliedAt)}</span>}
                        {m.failedAt && <span className="block text-red-600">Failed {fmtTime(m.failedAt)}</span>}
                        {!m.sentAt && !m.failedAt && m.status === 'PENDING' && <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> Sending</span>}
                      </td>
                      <td className="px-3 py-2.5 max-w-[260px]">
                        {m.failureReason ? (
                          <>
                            <span className={`block text-sm ${m.status === 'SKIPPED' ? 'text-amber-800' : 'text-red-700'}`}>
                              {m.failureReason}
                              {m.failedCode && <span className="ml-1 text-xs font-mono text-slate-400">#{m.failedCode}</span>}
                            </span>
                            {m.failureHint && <span className="block text-xs text-slate-500 mt-0.5">{m.failureHint}</span>}
                          </>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{m.triggeredBy?.name || 'System'}</td>
                      <td className="px-4 py-2.5 text-right">
                        {m.canResend && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void resend(m);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer whitespace-nowrap"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Send again
                          </button>
                        )}
                      </td>
                    </tr>
                    {expanded === m._id && (
                      <tr className="bg-[#FBF6EE]">
                        <td colSpan={8} className="px-4 py-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Message</p>
                              <pre className="whitespace-pre-wrap font-sans text-slate-800 bg-white border border-slate-200 rounded-xl p-3 max-h-60 overflow-y-auto">{m.preview || '—'}</pre>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Status history</p>
                              <ul className="space-y-1">
                                {(m.history || []).map((h: any, i: number) => (
                                  <li key={i} className="flex items-center gap-2">
                                    <StatusBadge status={h.status} />
                                    <span className="text-xs text-slate-600">{fmt(h.at, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span>
                                    {h.detail && <span className="text-xs text-slate-500">· {h.detail}</span>}
                                  </li>
                                ))}
                              </ul>
                              {m.resendOf && <p className="text-xs text-slate-500 mt-2">This is a resend of an earlier failed message.</p>}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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
