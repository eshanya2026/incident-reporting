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

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#7c3aed'];

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
    (severityData as any)?.data?.map((item: any) => ({
      name: item._id.label || `Level ${item._id.severity}`,
      value: item.count,
    })) || [];

  const categoryChartData =
    (categoryData as any)?.data?.map((item: any) => ({
      name: item._id,
      count: item.count,
    })) || [];

  const departmentChartData =
    (departmentData as any)?.data?.map((item: any) => ({
      name: item._id,
      count: item.count,
    })) || [];

  return (
    <div className="space-y-6">
      {/* Top Welcome & Banner */}
      <div className="bg-gradient-to-r from-hospital-900 via-hospital-800 to-slate-900 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-1 rounded-full bg-hospital-700/80 text-hospital-200 text-xs font-medium uppercase tracking-wider">
            Quality & Patient Safety Overview
          </span>
          <h2 className="text-2xl font-bold mt-2">Hospital Safety & Incident Dashboard</h2>
          <p className="text-sm text-hospital-200 mt-1 max-w-xl">
            Real-time incident monitoring, root cause investigation tracking, and CAPA compliance analytics.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            to="/incidents/new"
            className="px-4 py-2.5 bg-hospital-500 hover:bg-hospital-400 active:bg-hospital-600 text-white font-semibold text-xs rounded-xl shadow transition flex items-center space-x-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Report New Incident</span>
          </Link>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Total Incidents</span>
            <Activity className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-800 mt-2">{summary.totalIncidents}</div>
          <div className="text-[11px] text-slate-400 mt-1">Hospital-wide</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Critical / Sentinel</span>
            <ShieldAlert className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-extrabold text-red-600 mt-2">{summary.criticalIncidents}</div>
          <div className="text-[11px] text-red-500 font-medium mt-1">Severity 4 & 5</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Near Misses</span>
            <AlertTriangle className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-2">{summary.nearMissCount}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">Level 1 No Harm</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Under Investigation</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-amber-600 mt-2">{summary.underInvestigationCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Active investigations</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Overdue CAPAs</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-extrabold text-red-600 mt-2">{summary.overdueCapas}</div>
          <div className="text-[11px] text-red-500 font-medium mt-1">Requires immediate action</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
            <span>Closed This Month</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-800 mt-2">{summary.closedThisMonth}</div>
          <div className="text-[11px] text-slate-400 mt-1">Verified & Closed</div>
        </div>
      </div>

      {/* Analytics Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Distribution Bar Chart */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
              <BarChart2 className="w-4 h-4 text-hospital-600" />
              <span>Incidents by Department</span>
            </h3>
          </div>
          <div className="h-64">
            {departmentChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No department data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0c8ce9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Severity Distribution Pie Chart */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              <span>Severity Breakdown</span>
            </h3>
          </div>
          <div className="h-64 flex items-center justify-center">
            {severityChartData.length === 0 ? (
              <div className="text-xs text-slate-400">No severity data recorded</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={severityChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {severityChartData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
