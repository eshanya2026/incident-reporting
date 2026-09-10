import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  FileSpreadsheet,
  Search,
  Filter,
  Eye,
  PlusCircle,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../lib/api';
import dayjs from 'dayjs';

export default function IncidentRegisterPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [severity, setSeverity] = useState('');
  const [page, setPage] = useState(1);

  // Queries
  const { data: departmentsData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments'),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories'),
  });

  const { data: incidentsData, isLoading } = useQuery({
    queryKey: ['incidents', page, search, status, departmentId, categoryId, severity],
    queryFn: () =>
      api.get('/incidents', {
        params: {
          page,
          limit: 15,
          search: search || undefined,
          status: status || undefined,
          departmentId: departmentId || undefined,
          categoryId: categoryId || undefined,
          severity: severity || undefined,
        },
      }),
  });

  const departments = (departmentsData as any)?.data || [];
  const categories = (categoriesData as any)?.data || [];
  const incidents = (incidentsData as any)?.data || [];
  const meta = (incidentsData as any)?.meta || { page: 1, totalPages: 1, total: 0 };

  const getStatusBadge = (s: string) => {
    const badgeMap: Record<string, { bg: string; text: string; dot: string; border: string }> = {
      SUBMITTED: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', border: 'border-blue-200' },
      TRIAGED: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500', border: 'border-violet-200' },
      HOD_REVIEW: { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500', border: 'border-purple-200' },
      UNDER_INVESTIGATION: { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500', border: 'border-sky-200' },
      RCA_REQUIRED: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500', border: 'border-rose-200' },
      CAPA_IN_PROGRESS: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', border: 'border-amber-200' },
      EFFECTIVENESS_REVIEW: { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500', border: 'border-indigo-200' },
      READY_FOR_CLOSURE: { bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500', border: 'border-teal-200' },
      CLOSED: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', border: 'border-emerald-200' },
      REOPENED: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500', border: 'border-orange-200' },
      RETURNED_FOR_INFORMATION: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', border: 'border-amber-200' },
      CANCELLED: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', border: 'border-slate-200' },
    };
    const style = badgeMap[s] || { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', border: 'border-slate-200' };
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${style.bg} ${style.text} ${style.border}`}>
        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${style.dot}`}></span>
        {s ? s.replace(/_/g, ' ') : 'N/A'}
      </span>
    );
  };

  const getSeverityBadge = (sev: number) => {
    const map: Record<number, { bg: string; label: string }> = {
      1: { bg: 'bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] font-semibold', label: 'L1 Near Miss' },
      2: { bg: 'bg-[#F0F9FF] text-[#0369A1] border border-[#BAE6FD] font-semibold', label: 'L2 Minor' },
      3: { bg: 'bg-[#FFF7ED] text-[#C2410C] border border-[#FED7AA] font-bold', label: 'L3 Moderate' },
      4: { bg: 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA] font-bold', label: 'L4 Major' },
      5: { bg: 'bg-[#6B1418] text-white border border-[#4A0D10] font-black', label: 'L5 Sentinel' },
    };
    const s = map[sev] || { bg: 'bg-slate-100 text-slate-700 border border-slate-200 font-semibold', label: `L${sev}` };
    return <span className={`px-2.5 py-0.5 rounded text-[11px] ${s.bg}`}>{s.label}</span>;
  };

  return (
    <div className="space-y-6 text-clinicalText-primary">
      {/* Header - Separate floating box with light red tint on the left */}
      <div className="bg-gradient-to-r from-[#FDECEC]/70 via-[#FFFBFB] to-white p-6 rounded-2xl border border-clinicalBorder border-l-4 border-l-[#8B1E23] shadow-[0_4px_20px_rgba(15,23,42,0.06)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-clinicalText-primary flex items-center space-x-2">
            <FileSpreadsheet className="w-6 h-6 text-maroon-700" />
            <span>Hospital Incident Register</span>
          </h2>
          <p className="text-xs text-clinicalText-secondary mt-1">
            Master repository of all safety incidents, triage evaluations, and closure statuses.
          </p>
        </div>

        <Link
          to="/incidents/new"
          className="px-5 py-2.5 bg-gradient-to-r from-[#8B1E23] via-[#C62828] to-[#E53935] hover:brightness-110 active:scale-[0.99] text-white font-semibold text-xs rounded-xl shadow-button-red transition flex items-center space-x-2 self-start md:self-auto cursor-pointer"
        >
          <PlusCircle className="w-4 h-4 text-white stroke-[2.5]" />
          <span>New Incident</span>
        </Link>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-clinicalBorder shadow-sm grid grid-cols-1 sm:grid-cols-5 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-clinicalText-muted absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search INC #, title, UHID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
          />
        </div>

        <div>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
          >
            <option value="">-- All Departments --</option>
            {departments.map((d: any) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
          >
            <option value="">-- All Categories --</option>
            {categories.map((c: any) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
          >
            <option value="">-- All Statuses --</option>
            <option value="SUBMITTED">SUBMITTED</option>
            <option value="TRIAGED">TRIAGED</option>
            <option value="HOD_REVIEW">HOD REVIEW</option>
            <option value="UNDER_INVESTIGATION">UNDER INVESTIGATION</option>
            <option value="RCA_REQUIRED">RCA REQUIRED</option>
            <option value="CAPA_IN_PROGRESS">CAPA IN PROGRESS</option>
            <option value="EFFECTIVENESS_REVIEW">EFFECTIVENESS REVIEW</option>
            <option value="READY_FOR_CLOSURE">READY FOR CLOSURE</option>
            <option value="CLOSED">CLOSED</option>
          </select>
        </div>

        <div>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
          >
            <option value="">-- All Severities --</option>
            <option value="1">Level 1 – Near Miss</option>
            <option value="2">Level 2 – Minor</option>
            <option value="3">Level 3 – Moderate</option>
            <option value="4">Level 4 – Major</option>
            <option value="5">Level 5 – Sentinel</option>
          </select>
        </div>
      </div>

      {/* Incidents Data Table */}
      <div className="bg-white rounded-2xl border border-clinicalBorder shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-clinicalBorder text-[11px] font-bold uppercase tracking-wider text-clinicalText-secondary">
                <th className="py-3 px-4">Incident No</th>
                <th className="py-3 px-4">Date / Time</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Title & Patient</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-clinicalText-secondary">
                    Loading incident records...
                  </td>
                </tr>
              ) : incidents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-clinicalText-secondary">
                    No incident records found.
                  </td>
                </tr>
              ) : (
                incidents.map((inc: any) => (
                  <tr key={inc._id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-maroon-700">{inc.incidentNumber}</td>
                    <td className="py-3 px-4 text-clinicalText-secondary">{dayjs(inc.incidentDateTime).format('DD MMM YYYY HH:mm')}</td>
                    <td className="py-3 px-4 font-medium text-clinicalText-primary">{inc.departmentId?.name || 'N/A'}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-clinicalText-primary line-clamp-1">{inc.title}</div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {inc.categoryId?.name && (
                          <span className="px-1.5 py-0.5 rounded bg-red-50 text-[#8B1E23] text-[10px] font-semibold border border-red-100">
                            {inc.categoryId.name}
                          </span>
                        )}
                        {inc.patientInvolved && (
                          <span className="text-[11px] text-clinicalText-secondary font-mono">
                            Patient: {inc.patient?.name || 'Involved'} {inc.patient?.uhid ? `(${inc.patient.uhid})` : ''}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">{getSeverityBadge(inc.severity)}</td>
                    <td className="py-3 px-4">{getStatusBadge(inc.status)}</td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        to={`/incidents/${inc._id}`}
                        className="inline-flex items-center space-x-1.5 px-3 py-1 bg-white hover:bg-[#FFF5F5] text-clinicalText-primary hover:text-[#8B1E23] hover:border-[#EBA3A7] rounded-md font-semibold text-xs transition border border-clinicalBorder shadow-xs"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#8B1E23]" />
                        <span>View</span>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing page {meta.page} of {meta.totalPages} ({meta.total} records)
          </span>
          <div className="flex space-x-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 bg-white border border-slate-200 rounded disabled:opacity-50 hover:bg-slate-100 font-medium"
            >
              Previous
            </button>
            <button
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 bg-white border border-slate-200 rounded disabled:opacity-50 hover:bg-slate-100 font-medium"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
