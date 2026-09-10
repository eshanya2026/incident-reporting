import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  FileCheck2,
  Clock,
  CheckCircle2,
  ShieldAlert,
  BarChart2,
  PlusCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
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
} from 'recharts';
import { api } from '../lib/api';

const SEVERITY_PALETTE: Record<number, { color: string; label: string }> = {
  1: { color: '#10B981', label: 'Severity 1 – No Harm' },
  2: { color: '#0284C7', label: 'Severity 2 – Minor' },
  3: { color: '#EA580C', label: 'Severity 3 – Moderate' },
  4: { color: '#DC2626', label: 'Severity 4 – Major' },
  5: { color: '#6B1418', label: 'Severity 5 – Sentinel' },
};

export default function DashboardPage() {
  const { data: summaryData, isLoading: loadingSummary } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.get('/dashboard/summary'),
  });

  const { data: severityData } = useQuery({
    queryKey: ['dashboard-severity'],
    queryFn: () => api.get('/dashboard/severity'),
  });

  const { data: categoryData } = useQuery({
    queryKey: ['dashboard-categories'],
    queryFn: () => api.get('/dashboard/categories'),
  });

  const { data: departmentData } = useQuery({
    queryKey: ['dashboard-department-trend'],
    queryFn: () => api.get('/dashboard/department-trend'),
  });

  const summary = (summaryData as any)?.data || {
    totalIncidents: 0,
    openIncidents: 0,
    criticalIncidents: 0,
    nearMissCount: 0,
    underInvestigationCount: 0,
    overdueCapas: 0,
    closedThisMonth: 0,
  };

  const severityChartData =
    (severityData as any)?.data?.map((item: any) => {
      const sevNum = Number(item._id.severity || item._id);
      const conf = SEVERITY_PALETTE[sevNum] || { color: '#CBD5E1', label: `Severity ${sevNum}` };
      return {
        severity: sevNum,
        name: item._id.label || conf.label,
        value: item.count,
        color: conf.color,
      };
    }) || [];

  const totalSeverityCount = severityChartData.reduce((acc: number, cur: any) => acc + cur.value, 0);

  const departmentChartData =
    (departmentData as any)?.data?.map((item: any) => ({
      name: item._id,
      count: item.count,
    })) || [];

  return (
    <div className="space-y-7 text-[#172033]">
      {/* Hero Banner - Separate floating box with light red tint on the left */}
      <div className="bg-gradient-to-r from-[#FDECEC]/70 via-[#FFFBFB] to-white rounded-2xl p-6 sm:p-8 border border-clinicalBorder border-l-4 border-l-[#8B1E23] shadow-[0_4px_20px_rgba(15,23,42,0.06)] relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        {/* Soft flowing decorative wave background on right */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-[#FFF5F5] via-[#FDECEC]/25 to-transparent pointer-events-none rounded-r-2xl"></div>
        <svg
          className="absolute -right-10 -bottom-10 w-80 h-80 opacity-[0.05] text-[#8B1E23] pointer-events-none"
          viewBox="0 0 200 200"
          fill="currentColor"
        >
          <path
            d="M42.7,-72.4C54.9,-66.1,64,-54.6,71.2,-41.8C78.4,-29,83.7,-14.5,82.8,-0.5C81.9,13.4,74.7,26.8,66.4,38.8C58.1,50.7,48.6,61.1,36.8,68.4C25,75.7,10.8,79.8,-3.1,85.2C-17,90.5,-30.7,97.1,-43.3,92.7C-55.9,88.4,-67.4,73,-74.6,58.2C-81.8,43.4,-84.7,29.1,-84.8,15.1C-84.9,1.1,-82.2,-12.7,-76.3,-25.1C-70.4,-37.5,-61.3,-48.5,-49.9,-55.1C-38.6,-61.7,-25.1,-63.9,-12.1,-65.7C0.9,-67.5,27.5,-78.7,42.7,-72.4Z"
            transform="translate(100 100)"
          />
        </svg>

        {/* Left Side: Editorial Content */}
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FDECEC] text-[#8B1E23] border border-[#FCDADA] text-[11px] font-bold tracking-wide uppercase mb-3.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C62828] animate-pulse"></span>
            <span>QUALITY & PATIENT SAFETY OVERVIEW</span>
          </div>
          <h2 className="text-2xl sm:text-[30px] font-bold tracking-tight text-[#68151A] leading-tight">
            Hospital Safety & Incident Dashboard
          </h2>
          <p className="text-sm text-[#64748B] mt-2 leading-relaxed">
            Real-time incident monitoring, root cause investigation tracking, and CAPA compliance analytics.
          </p>
        </div>

        {/* Right Side: Micro-tag & Glossy CTA Button */}
        <div className="relative z-10 flex flex-col items-start md:items-end space-y-3 shrink-0">
          <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#94A3B8] hidden sm:block">
            PATIENT SAFETY | OUR PRIORITY
          </div>
          <Link
            to="/incidents/new"
            className="px-6 py-3.5 bg-gradient-to-r from-[#8B1E23] via-[#C62828] to-[#E53935] hover:brightness-110 active:scale-[0.99] text-white font-semibold text-sm rounded-xl shadow-button-red transition-all duration-180 flex items-center space-x-2.5 relative overflow-hidden group cursor-pointer"
          >
            <span className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent pointer-events-none"></span>
            <PlusCircle className="w-4.5 h-4.5 text-white stroke-[2.5] transition-transform duration-200 group-hover:rotate-90" />
            <span className="relative z-10 tracking-wide font-medium">Report New Incident</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid - 6 Clean White Cards with Status Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 sm:gap-5">
        {/* Card 1: Total Incidents */}
        <div className="bg-white p-5 rounded-[14px] border border-[#E2E8F0] border-t-[3px] border-t-[#8B1E23] shadow-card hover:-translate-y-0.5 hover:shadow-md transition-all duration-180 group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">Total Incidents</span>
            <div className="w-9 h-9 rounded-full bg-[#FDECEC] flex items-center justify-center group-hover:scale-105 transition">
              <Activity className="w-4.5 h-4.5 text-[#8B1E23]" />
            </div>
          </div>
          <div className="text-[32px] font-bold text-[#172033] leading-none mt-3.5 tracking-tight">
            {summary.totalIncidents}
          </div>
          <div className="text-[11px] text-[#94A3B8] mt-2 font-medium">Hospital-wide records</div>
        </div>

        {/* Card 2: Critical / Sentinel */}
        <div className="bg-white p-5 rounded-[14px] border border-[#E2E8F0] border-t-[3px] border-t-[#C62828] shadow-card hover:-translate-y-0.5 hover:shadow-md transition-all duration-180 group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">Critical / Sentinel</span>
            <div className="w-9 h-9 rounded-full bg-[#FDECEC] flex items-center justify-center group-hover:scale-105 transition">
              <ShieldAlert className="w-4.5 h-4.5 text-[#C62828]" />
            </div>
          </div>
          <div className="text-[32px] font-bold text-[#C62828] leading-none mt-3.5 tracking-tight">
            {summary.criticalIncidents}
          </div>
          <div className="text-[11px] text-[#C62828] mt-2 font-semibold">Severity 4 & 5</div>
        </div>

        {/* Card 3: Near Misses */}
        <div className="bg-white p-5 rounded-[14px] border border-[#E2E8F0] border-t-[3px] border-t-[#94A3B8] shadow-card hover:-translate-y-0.5 hover:shadow-md transition-all duration-180 group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">Near Misses</span>
            <div className="w-9 h-9 rounded-full bg-[#F1F5F9] flex items-center justify-center group-hover:scale-105 transition">
              <AlertTriangle className="w-4.5 h-4.5 text-[#64748B]" />
            </div>
          </div>
          <div className="text-[32px] font-bold text-[#172033] leading-none mt-3.5 tracking-tight">
            {summary.nearMissCount}
          </div>
          <div className="text-[11px] text-[#64748B] mt-2 font-medium">Level 1 No Harm</div>
        </div>

        {/* Card 4: Under Investigation */}
        <div className="bg-white p-5 rounded-[14px] border border-[#E2E8F0] border-t-[3px] border-t-[#4677B8] shadow-card hover:-translate-y-0.5 hover:shadow-md transition-all duration-180 group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">Under Investigation</span>
            <div className="w-9 h-9 rounded-full bg-[#EFF6FF] flex items-center justify-center group-hover:scale-105 transition">
              <Clock className="w-4.5 h-4.5 text-[#4677B8]" />
            </div>
          </div>
          <div className="text-[32px] font-bold text-[#172033] leading-none mt-3.5 tracking-tight">
            {summary.underInvestigationCount}
          </div>
          <div className="text-[11px] text-[#4677B8] mt-2 font-medium">Active investigations</div>
        </div>

        {/* Card 5: Overdue CAPAs */}
        <div className="bg-white p-5 rounded-[14px] border border-[#E2E8F0] border-t-[3px] border-t-[#C62828] shadow-card hover:-translate-y-0.5 hover:shadow-md transition-all duration-180 group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">Overdue CAPAs</span>
            <div className="w-9 h-9 rounded-full bg-[#FDECEC] flex items-center justify-center group-hover:scale-105 transition">
              <AlertTriangle className="w-4.5 h-4.5 text-[#C62828]" />
            </div>
          </div>
          <div className="text-[32px] font-bold text-[#C62828] leading-none mt-3.5 tracking-tight">
            {summary.overdueCapas}
          </div>
          <div className="text-[11px] text-[#C62828] mt-2 font-semibold">Action Required</div>
        </div>

        {/* Card 6: Closed This Month */}
        <div className="bg-white p-5 rounded-[14px] border border-[#E2E8F0] border-t-[3px] border-t-[#159A68] shadow-card hover:-translate-y-0.5 hover:shadow-md transition-all duration-180 group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">Closed This Month</span>
            <div className="w-9 h-9 rounded-full bg-[#E8F7F0] flex items-center justify-center group-hover:scale-105 transition">
              <CheckCircle2 className="w-4.5 h-4.5 text-[#159A68]" />
            </div>
          </div>
          <div className="text-[32px] font-bold text-[#159A68] leading-none mt-3.5 tracking-tight">
            {summary.closedThisMonth}
          </div>
          <div className="text-[11px] text-[#159A68] mt-2 font-medium">Verified & Closed</div>
        </div>
      </div>

      {/* Analytics Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Distribution Bar Chart */}
        <div className="bg-white p-6 sm:p-7 rounded-[16px] border border-[#E2E8F0] shadow-chart flex flex-col justify-between">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-[#172033] text-base flex items-center space-x-2.5">
              <BarChart2 className="w-5 h-5 text-[#8B1E23]" />
              <span>Incidents by Department</span>
            </h3>
            <span className="text-xs font-medium text-[#64748B] bg-[#F8FAFC] px-3 py-1 rounded-lg border border-[#E2E8F0]">
              Hospital Trend
            </span>
          </div>

          <div className="h-72">
            {departmentChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-[#94A3B8]">
                No department data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentChartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                  <defs>
                    <linearGradient id="deptBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E53935" />
                      <stop offset="100%" stopColor="#8B1E23" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    axisLine={{ stroke: '#E2E8F0' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                      boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" fill="url(#deptBarGrad)" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Severity Breakdown Donut Chart with Desktop Side Legend */}
        <div className="bg-white p-6 sm:p-7 rounded-[16px] border border-[#E2E8F0] shadow-chart flex flex-col justify-between">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-[#172033] text-base flex items-center space-x-2.5">
              <ShieldAlert className="w-5 h-5 text-[#8B1E23]" />
              <span>Severity Breakdown</span>
            </h3>
            <span className="text-xs font-medium text-[#64748B] bg-[#F8FAFC] px-3 py-1 rounded-lg border border-[#E2E8F0]">
              NABH Scale
            </span>
          </div>

          <div className="h-72 flex flex-col sm:flex-row items-center justify-between gap-4">
            {severityChartData.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-[#94A3B8]">
                No severity data recorded
              </div>
            ) : (
              <>
                {/* Donut graphic */}
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
                        {severityChartData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#FFFFFF',
                          borderRadius: '10px',
                          border: '1px solid #E2E8F0',
                          boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
                          fontSize: '12px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Central Donut Count Display */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-bold text-[#172033] leading-none">{totalSeverityCount}</span>
                    <span className="text-[10px] text-[#64748B] uppercase font-semibold mt-0.5">Total</span>
                  </div>
                </div>

                {/* Side Legend with Clean Statistics */}
                <div className="w-full sm:w-1/2 space-y-2.5 px-2">
                  {[5, 4, 3, 2, 1].map((lvl) => {
                    const item = severityChartData.find((d: any) => d.severity === lvl);
                    const conf = SEVERITY_PALETTE[lvl];
                    const count = item?.value || 0;
                    const percent = totalSeverityCount > 0 ? Math.round((count / totalSeverityCount) * 100) : 0;

                    return (
                      <div key={lvl} className="flex items-center justify-between text-xs py-0.5">
                        <div className="flex items-center space-x-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: conf.color }}
                          ></span>
                          <span className="font-medium text-[#475569] truncate">{conf.label}</span>
                        </div>
                        <div className="flex items-center space-x-2 font-mono">
                          <span className="font-bold text-[#172033]">{count}</span>
                          <span className="text-[11px] text-[#94A3B8]">({percent}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
