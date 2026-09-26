import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ShieldAlert,
  BarChart2,
  RotateCw,
  TrendingUp,
  Building2,
  Inbox,
  ClipboardCheck,
  Layers,
  FileCheck,
  PlusCircle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { api } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { hasPermission } from '../lib/rbac';

dayjs.extend(relativeTime);

/**
 * A Recharts axis tick that truncates long labels instead of letting them collide with the
 * chart edge or a neighboring bar. The full label is still reachable: as a native title
 * tooltip on the tick text, and (for the bar itself) via the chart's own hover tooltip.
 */
const truncatedTick =
  (maxChars: number, opts: { angle?: number; textAnchor?: 'end' | 'middle' | 'start' } = {}) =>
  ({ x, y, payload }: any) => {
    const label = String(payload.value ?? '');
    const short = label.length > maxChars ? `${label.slice(0, maxChars - 1)}…` : label;
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          dy={opts.angle ? 12 : 4}
          dx={opts.textAnchor === 'end' && !opts.angle ? -6 : 0}
          textAnchor={opts.textAnchor ?? 'middle'}
          transform={opts.angle ? `rotate(${opts.angle})` : undefined}
          fontSize={opts.textAnchor === 'end' && !opts.angle ? 12 : 11}
          fill={opts.textAnchor === 'end' && !opts.angle ? '#475569' : '#64748B'}
        >
          {short}
          {short !== label && <title>{label}</title>}
        </text>
      </g>
    );
  };

/**
 * Minimal KPI tile: one flat, solid-color icon badge carries the card's identity; the number
 * stays neutral dark ink unless it's genuinely alert-worthy (valueColor), keeping color reserved
 * for meaning rather than decoration.
 */
function KpiCard({
  to,
  icon: Icon,
  badgeColor,
  label,
  value,
  valueColor = '#1E293B',
  caption,
  captionColor = '#94A3B8',
}: {
  to?: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeColor: string;
  label: string;
  value: React.ReactNode;
  valueColor?: string;
  caption: React.ReactNode;
  captionColor?: string;
}) {
  const className =
    'bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group block';
  const content = (
    <>
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-105 transition"
        style={{ backgroundColor: badgeColor }}
      >
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="text-[28px] font-bold leading-none mt-2 tracking-tight" style={{ color: valueColor }}>
        {value}
      </div>
      <div className="text-[12.5px] mt-2 font-medium truncate" style={{ color: captionColor }}>
        {caption}
      </div>
    </>
  );
  return to ? (
    <Link to={to} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

const SEVERITY_CONFIG: Record<number, { color: string; label: string; short: string }> = {
  1: { color: '#10B981', label: 'Severity 1 – Near Miss / No Harm', short: 'Near Miss' },
  2: { color: '#0284C7', label: 'Severity 2 – Minor Harm', short: 'Minor' },
  3: { color: '#EA580C', label: 'Severity 3 – Moderate Harm', short: 'Moderate' },
  4: { color: '#DC2626', label: 'Severity 4 – Major Harm', short: 'Major' },
  5: { color: '#6B1418', label: 'Severity 5 – Sentinel / Critical', short: 'Sentinel' },
};

const PERIOD_OPTIONS: Array<{ key: '3m' | '6m' | '12m' | 'all'; label: string }> = [
  { key: '3m', label: '3 Months' },
  { key: '6m', label: '6 Months' },
  { key: '12m', label: '12 Months' },
  { key: 'all', label: 'All Time' },
];

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const [period, setPeriod] = useState<'3m' | '6m' | '12m' | 'all'>('12m');

  const isHospitalWide = hasPermission(user, 'incident.read_all');
  const isHod = hasPermission(user, 'incident.read_assigned') && !isHospitalWide;
  const canReport = hasPermission(user, 'incident.create');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['dashboard-overview', period],
    queryFn: () => api.get(`/dashboard/overview?period=${period}`),
    staleTime: 30_000,
  });

  const overview = (data as any)?.data;
  const nowStats = overview?.now || {
    byStatus: {},
    open: 0,
    oldestAwaitingTriage: null,
    oldestAwaitingReview: null,
    activeRework: 0,
    capa: { OPEN: 0, DONE: 0, EFFECTIVE: 0, overdue: 0 },
  };
  const inPeriod = overview?.inPeriod || {
    reported: 0,
    rejected: 0,
    closed: 0,
    turnaroundDays: { reportToAssign: null, assignToSubmit: null, submitToClose: null, reportToClose: null },
    rework: { closed: 0, sentBack: 0, rate: null, activeRework: 0 },
    severity: [],
    categories: [],
    departments: [],
    monthly: [],
  };

  // Severity Chart Data
  const severityChartData = [1, 2, 3, 4, 5].map((lvl) => {
    const found = inPeriod.severity?.find((s: any) => s.severity === lvl);
    const conf = SEVERITY_CONFIG[lvl];
    return {
      severity: lvl,
      name: conf.short,
      fullName: conf.label,
      value: found?.count || 0,
      color: conf.color,
    };
  });
  const totalSeverityCount = severityChartData.reduce((acc, cur) => acc + cur.value, 0);

  // Monthly Trend Data
  const monthlyChartData = (inPeriod.monthly || []).map((m: any) => ({
    month: m.month,
    Reported: m.reported,
    Closed: m.closed,
  }));

  // Departments Chart Data (Top 8 for clarity)
  const departmentChartData = (inPeriod.departments || []).slice(0, 8);

  // Categories Chart Data (Top 8)
  const categoryChartData = (inPeriod.categories || []).slice(0, 8);

  const formatAge = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'None waiting';
    return `Oldest: ${dayjs(dateStr).fromNow()}`;
  };

  return (
    <div className="space-y-7 text-[#172033]">
      {/* Hero Banner with Role-Specific Title and Period Controls - dark theme */}
      <div className="hero-banner rounded-2xl p-6 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Editorial Content */}
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[#F5A5A8] text-[12.5px] font-bold tracking-wide uppercase mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F06B70]"></span>
            <span>
              {isHod
                ? `${overview?.department?.name || 'Department'} Incident Tracking`
                : 'Hospital-Wide Safety & Compliance Overview'}
            </span>
          </div>
          <h2 className="text-2xl sm:text-[28px] font-bold tracking-tight text-white leading-tight">
            {isHod ? `${overview?.department?.name || 'Department'} Safety Dashboard` : 'Quality & Incident Analytics Dashboard'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300/80 mt-1.5 leading-relaxed">
            {isHod
              ? 'Real-time investigation progress, root cause analysis, and CAPA resolution for incidents assigned to your department.'
              : 'Continuous monitoring of hospital incidents across triage, investigation, RCA, CAPA closure, and NABH compliance.'}
          </p>
        </div>

        {/* Right Controls: Period Selector & Refresh */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
          <div className="inline-flex p-1 bg-black/25 border border-white/15 rounded-xl backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setPeriod(opt.key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition duration-150 cursor-pointer ${
                  period === opt.key
                    ? 'bg-gradient-to-b from-[#EF5350] to-[#B71C1C] text-white shadow-[0_4px_10px_-2px_rgba(229,57,53,0.6),inset_0_1px_0_rgba(255,255,255,0.35)]'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2.5 rounded-xl bg-black/25 border border-white/15 text-slate-300 hover:text-white hover:bg-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition duration-180 cursor-pointer disabled:opacity-50"
            title="Refresh dashboard metrics"
          >
            <RotateCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-white' : ''}`} />
          </button>

          {canReport && (
            <Link
              to="/incidents/new"
              className="px-4 py-2.5 bg-gradient-to-r from-[#8B1E23] via-[#C62828] to-[#E53935] hover:brightness-110 active:scale-[0.99] text-white font-semibold text-xs rounded-xl shadow-button-red transition duration-180 flex items-center space-x-2 shrink-0 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-white" />
              <span>Report Incident</span>
            </Link>
          )}
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 animate-pulse h-32">
              <div className="h-4 bg-slate-200 rounded w-24 mb-3"></div>
              <div className="h-8 bg-slate-200 rounded w-16 mb-2"></div>
              <div className="h-3 bg-slate-100 rounded w-20"></div>
            </div>
          ))}
        </div>
      )}

      {/* Main KPI Grid - Role-Tailored */}
      {!isLoading && (
        <>
          {isHospitalWide ? (
            /* Quality & Admin KPI Cards */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 sm:gap-5">
              <KpiCard
                to="/triage"
                icon={Inbox}
                badgeColor="#8B1E23"
                label="Awaiting Triage"
                value={nowStats.byStatus?.SUBMITTED || 0}
                caption={formatAge(nowStats.oldestAwaitingTriage)}
              />
              <KpiCard
                to="/review"
                icon={ClipboardCheck}
                badgeColor="#D97706"
                label="Awaiting Review"
                value={nowStats.byStatus?.PENDING_QUALITY_REVIEW || 0}
                caption={formatAge(nowStats.oldestAwaitingReview)}
              />
              <KpiCard
                to="/incidents"
                icon={Activity}
                badgeColor="#2563EB"
                label="Active Incidents"
                value={nowStats.open || 0}
                caption="Hospital-wide pipeline"
              />
              <KpiCard
                to="/capas"
                icon={AlertTriangle}
                badgeColor="#DC2626"
                label="Overdue CAPA"
                value={nowStats.capa?.overdue || 0}
                valueColor="#DC2626"
                caption={`${nowStats.capa?.OPEN || 0} open actions`}
                captionColor="#DC2626"
              />
              <KpiCard
                icon={Layers}
                badgeColor="#7C3AED"
                label="Rework Rate"
                value={inPeriod.rework?.rate !== null ? `${inPeriod.rework.rate}%` : '0%'}
                caption={`${inPeriod.rework?.sentBack || 0} sent back of ${inPeriod.rework?.closed || 0}`}
              />
              <KpiCard
                icon={CheckCircle2}
                badgeColor="#059669"
                label="Closed in Period"
                value={inPeriod.closed || 0}
                valueColor="#059669"
                caption={
                  inPeriod.reported ? `${Math.round(((inPeriod.closed || 0) / inPeriod.reported) * 100)}% resolution` : 'Completed'
                }
                captionColor="#059669"
              />
            </div>
          ) : (
            /* HOD Role-Specific KPI Cards */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 sm:gap-5">
              <KpiCard
                to="/my-department"
                icon={Building2}
                badgeColor="#8B1E23"
                label="Assigned to Dept"
                value={nowStats.open || 0}
                caption="Active department load"
              />
              <KpiCard
                icon={Clock}
                badgeColor="#2563EB"
                label="Investigation / RCA"
                value={(nowStats.byStatus?.ASSIGNED || 0) + (nowStats.byStatus?.UNDER_INVESTIGATION || 0)}
                caption={`${nowStats.byStatus?.ASSIGNED || 0} new, ${nowStats.byStatus?.UNDER_INVESTIGATION || 0} investigating`}
              />
              <KpiCard
                icon={Layers}
                badgeColor="#D97706"
                label="CAPA in Progress"
                value={nowStats.byStatus?.CAPA_IN_PROGRESS || 0}
                caption="Corrective actions ongoing"
              />
              <KpiCard
                icon={ClipboardCheck}
                badgeColor="#0D9488"
                label="Quality Review"
                value={nowStats.byStatus?.PENDING_QUALITY_REVIEW || 0}
                caption="Submitted for closure"
              />
              <KpiCard
                to="/capas"
                icon={AlertTriangle}
                badgeColor="#DC2626"
                label="Dept Overdue CAPA"
                value={nowStats.capa?.overdue || 0}
                valueColor="#DC2626"
                caption={`${nowStats.capa?.OPEN || 0} open CAPAs`}
                captionColor="#DC2626"
              />
              <KpiCard
                icon={FileCheck}
                badgeColor="#7C3AED"
                label="Quality Returns"
                value={inPeriod.rework?.sentBack || 0}
                caption={inPeriod.rework?.rate !== null ? `${inPeriod.rework.rate}% rework rate` : 'Zero returns'}
              />
            </div>
          )}

          {/* Turnaround Time Metric Strip (NABH Turnaround Benchmarks) */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F1F5F9] pb-3 mb-4">
              <div className="flex items-center space-x-2">
                <Clock className="w-4.5 h-4.5 text-[#8B1E23]" />
                <h3 className="font-bold text-sm text-[#172033]">
                  Workflow Turnaround Times (Median Days over Closed Incidents)
                </h3>
              </div>
              <span className="text-xs text-[#64748B] font-medium">
                Hospital Benchmark: Total Cycle &lt; 14 Days
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col justify-between">
                <span className="text-[12.5px] font-semibold text-[#64748B] uppercase tracking-wider">
                  1. Staff Report → Quality Assign
                </span>
                <div className="text-2xl font-bold text-[#172033] mt-2">
                  {inPeriod.turnaroundDays?.reportToAssign !== null
                    ? `${inPeriod.turnaroundDays.reportToAssign} days`
                    : '—'}
                </div>
                <span className="text-[11.5px] text-[#94A3B8] mt-1">Triage & HOD routing</span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col justify-between">
                <span className="text-[12.5px] font-semibold text-[#64748B] uppercase tracking-wider">
                  2. HOD Assign → Submit for Review
                </span>
                <div className="text-2xl font-bold text-[#172033] mt-2">
                  {inPeriod.turnaroundDays?.assignToSubmit !== null
                    ? `${inPeriod.turnaroundDays.assignToSubmit} days`
                    : '—'}
                </div>
                <span className="text-[11.5px] text-[#94A3B8] mt-1">Investigation, RCA & CAPA completion</span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col justify-between">
                <span className="text-[12.5px] font-semibold text-[#64748B] uppercase tracking-wider">
                  3. Quality Review → Final Closure
                </span>
                <div className="text-2xl font-bold text-[#172033] mt-2">
                  {inPeriod.turnaroundDays?.submitToClose !== null
                    ? `${inPeriod.turnaroundDays.submitToClose} days`
                    : '—'}
                </div>
                <span className="text-[11.5px] text-[#94A3B8] mt-1">Effectiveness audit & sign-off</span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#FFF5F5] border border-[#FCDADA] flex flex-col justify-between">
                <span className="text-[12.5px] font-semibold text-[#8B1E23] uppercase tracking-wider">
                  Total End-to-End Cycle
                </span>
                <div className="text-2xl font-bold text-[#8B1E23] mt-2">
                  {inPeriod.turnaroundDays?.reportToClose !== null
                    ? `${inPeriod.turnaroundDays.reportToClose} days`
                    : '—'}
                </div>
                <span className="text-[11.5px] text-[#C62828] mt-1">Report submission to closure</span>
              </div>
            </div>
          </div>

          {/* Analytics Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Trend: Reported vs Closed */}
            <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-card flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-[#172033] text-sm flex items-center space-x-2">
                  <TrendingUp className="w-4.5 h-4.5 text-[#8B1E23]" />
                  <span>Monthly Trend — Reported vs Closed</span>
                </h3>
                <span className="text-xs font-medium text-[#64748B] bg-[#F8FAFC] px-2.5 py-1 rounded-lg border border-[#E2E8F0]">
                  {period.toUpperCase()} View
                </span>
              </div>

              <div className="h-72">
                {monthlyChartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-[#94A3B8]">
                    No monthly incident history in this period
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={{ stroke: '#E2E8F0' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#64748B' }} allowDecimals={false} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#FFFFFF',
                          borderRadius: '10px',
                          border: '1px solid #E2E8F0',
                          boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
                          fontSize: '13px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                      <Bar dataKey="Reported" fill="#8B1E23" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Closed" fill="#10B981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Severity Breakdown Donut Chart */}
            <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-card flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-[#172033] text-sm flex items-center space-x-2">
                  <ShieldAlert className="w-4.5 h-4.5 text-[#8B1E23]" />
                  <span>Severity Distribution (NABH Scale)</span>
                </h3>
                <span className="text-xs font-medium text-[#64748B] bg-[#F8FAFC] px-2.5 py-1 rounded-lg border border-[#E2E8F0]">
                  Levels 1 – 5
                </span>
              </div>

              <div className="h-72 flex flex-col sm:flex-row items-center justify-between gap-4">
                {totalSeverityCount === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-xs text-[#94A3B8]">
                    No incident severity records found in this period
                  </div>
                ) : (
                  <>
                    <div className="w-full sm:w-1/2 h-56 relative flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={severityChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {severityChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#FFFFFF',
                              borderRadius: '10px',
                              border: '1px solid #E2E8F0',
                              boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
                              fontSize: '13px',
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-bold text-[#172033] leading-none">{totalSeverityCount}</span>
                        <span className="text-[11.5px] text-[#64748B] uppercase font-semibold mt-0.5">Total</span>
                      </div>
                    </div>

                    <div className="w-full sm:w-1/2 space-y-2 px-1">
                      {[5, 4, 3, 2, 1].map((lvl) => {
                        const item = severityChartData.find((d) => d.severity === lvl);
                        const conf = SEVERITY_CONFIG[lvl];
                        const count = item?.value || 0;
                        const percent = totalSeverityCount > 0 ? Math.round((count / totalSeverityCount) * 100) : 0;

                        return (
                          <div key={lvl} className="flex items-center justify-between text-xs py-0.5">
                            <div className="flex items-center space-x-2 truncate">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: conf.color }}></span>
                              <span className="font-medium text-[#475569] truncate">{conf.short}</span>
                            </div>
                            <div className="flex items-center space-x-1.5 font-mono shrink-0">
                              <span className="font-bold text-[#172033]">{count}</span>
                              <span className="text-[12.5px] text-[#94A3B8]">({percent}%)</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Department Distribution (Hospital-Wide) */}
            {isHospitalWide && (
              <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-card flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-[#172033] text-sm flex items-center space-x-2">
                    <Building2 className="w-4.5 h-4.5 text-[#8B1E23]" />
                    <span>Incidents by Responsible Department</span>
                  </h3>
                  <span className="text-xs font-medium text-[#64748B] bg-[#F8FAFC] px-2.5 py-1 rounded-lg border border-[#E2E8F0]">
                    Top Departments
                  </span>
                </div>

                <div className="h-72">
                  {departmentChartData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-[#94A3B8]">
                      No department data available
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={departmentChartData} margin={{ top: 10, right: 10, left: 4, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis
                          dataKey="name"
                          tick={truncatedTick(14, { angle: -35, textAnchor: 'end' })}
                          interval={0}
                          axisLine={{ stroke: '#E2E8F0' }}
                          tickLine={false}
                        />
                        <YAxis tick={{ fontSize: 12, fill: '#64748B' }} allowDecimals={false} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#FFFFFF',
                            borderRadius: '10px',
                            border: '1px solid #E2E8F0',
                            boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
                            fontSize: '13px',
                          }}
                        />
                        <Bar dataKey="count" fill="#C62828" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            )}

            {/* Incident Categories Breakdown */}
            <div className={`bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-card flex flex-col justify-between ${!isHospitalWide ? 'lg:col-span-2' : ''}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-[#172033] text-sm flex items-center space-x-2">
                  <BarChart2 className="w-4.5 h-4.5 text-[#8B1E23]" />
                  <span>Top Incident Categories</span>
                </h3>
                <span className="text-xs font-medium text-[#64748B] bg-[#F8FAFC] px-2.5 py-1 rounded-lg border border-[#E2E8F0]">
                  Frequency Analysis
                </span>
              </div>

              <div className="h-72">
                {categoryChartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-[#94A3B8]">
                    No category data recorded in this period
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryChartData} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                      <XAxis type="number" tick={{ fontSize: 12, fill: '#64748B' }} allowDecimals={false} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={truncatedTick(18, { textAnchor: 'end' })} width={120} axisLine={{ stroke: '#E2E8F0' }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#FFFFFF',
                          borderRadius: '10px',
                          border: '1px solid #E2E8F0',
                          boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
                          fontSize: '13px',
                        }}
                      />
                      <Bar dataKey="count" fill="#475569" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
