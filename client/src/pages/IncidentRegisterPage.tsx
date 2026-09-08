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
  const [severity, setSeverity] = useState('');
  const [page, setPage] = useState(1);

  // Queries
  const { data: departmentsData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments'),
  });

  const { data: incidentsData, isLoading } = useQuery({
    queryKey: ['incidents', page, search, status, departmentId, severity],
    queryFn: () =>
      api.get('/incidents', {
        params: {
          page,
          limit: 15,
          search: search || undefined,
          status: status || undefined,
          departmentId: departmentId || undefined,
          severity: severity || undefined,
        },
      }),
  });

  const departments = (departmentsData as any)?.data || [];
  const incidents = (incidentsData as any)?.data || [];
  const meta = (incidentsData as any)?.meta || { page: 1, totalPages: 1, total: 0 };

  const getStatusBadge = (s: string) => {
    const badgeMap: Record<string, { bg: string; text: string }> = {
      SUBMITTED: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
      TRIAGED: { bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700' },
      HOD_REVIEW: { bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700' },
      UNDER_INVESTIGATION: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
      RCA_REQUIRED: { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700' },
      CAPA_IN_PROGRESS: { bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-800' },
      READY_FOR_CLOSURE: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
      CLOSED: { bg: 'bg-slate-100 border-slate-300', text: 'text-slate-700' },
    };
    const style = badgeMap[s] || { bg: 'bg-slate-100 border-slate-200', text: 'text-slate-600' };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${style.bg} ${style.text}`}>
        {s.replace(/_/g, ' ')}
      </span>
    );
  };

  const getSeverityBadge = (sev: number) => {
    const map: Record<number, { bg: string; label: string }> = {
      1: { bg: 'bg-emerald-100 text-emerald-800', label: 'L1 Near Miss' },
      2: { bg: 'bg-blue-100 text-blue-800', label: 'L2 Minor' },
      3: { bg: 'bg-amber-100 text-amber-800', label: 'L3 Moderate' },
      4: { bg: 'bg-orange-100 text-orange-800', label: 'L4 Major' },
      5: { bg: 'bg-red-100 text-red-800 font-extrabold', label: 'L5 Sentinel' },
    };
    const s = map[sev] || { bg: 'bg-slate-100 text-slate-700', label: `L${sev}` };
    return <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${s.bg}`}>{s.label}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center space-x-2">
            <FileSpreadsheet className="w-6 h-6 text-hospital-600" />
            <span>Hospital Incident Register</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Master repository of all safety incidents, triage evaluations, and closure statuses.
          </p>
        </div>

        <Link
          to="/incidents/new"
          className="px-4 py-2 bg-hospital-600 hover:bg-hospital-700 active:bg-hospital-800 text-white font-semibold text-xs rounded-xl shadow transition flex items-center space-x-2 self-start md:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Incident</span>
        </Link>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search INC #, title, UHID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-hospital-500 focus:bg-white"
          />
        </div>

        <div>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
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
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
          >
            <option value="">-- All Statuses --</option>
            <option value="SUBMITTED">SUBMITTED</option>
            <option value="TRIAGED">TRIAGED</option>
            <option value="HOD_REVIEW">HOD REVIEW</option>
            <option value="UNDER_INVESTIGATION">UNDER INVESTIGATION</option>
            <option value="RCA_REQUIRED">RCA REQUIRED</option>
            <option value="CAPA_IN_PROGRESS">CAPA IN PROGRESS</option>
            <option value="READY_FOR_CLOSURE">READY FOR CLOSURE</option>
            <option value="CLOSED">CLOSED</option>
          </select>
        </div>

        <div>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
          >
            <option value="">-- All Severities --</option>
            <option value="1">Level 1 - Near Miss</option>
            <option value="2">Level 2 - Minor</option>
            <option value="3">Level 3 - Moderate</option>
            <option value="4">Level 4 - Major</option>
            <option value="5">Level 5 - Sentinel</option>
          </select>
        </div>
      </div>

      {/* Incidents Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
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
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading incident register...
                  </td>
                </tr>
              ) : incidents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No incident records found.
                  </td>
                </tr>
              ) : (
                incidents.map((inc: any) => (
                  <tr key={inc._id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-bold text-hospital-700">{inc.incidentNumber}</td>
                    <td className="py-3 px-4 text-slate-600">{dayjs(inc.incidentDateTime).format('DD MMM YYYY HH:mm')}</td>
                    <td className="py-3 px-4 font-medium text-slate-700">{inc.departmentId?.name || 'N/A'}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800 line-clamp-1">{inc.title}</div>
                      {inc.patientInvolved && (
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          Patient: {inc.patient?.name || 'Involved'} {inc.patient?.uhid ? `(${inc.patient.uhid})` : ''}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">{getSeverityBadge(inc.severity)}</td>
                    <td className="py-3 px-4">{getStatusBadge(inc.status)}</td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        to={`/incidents/${inc._id}`}
                        className="inline-flex items-center space-x-1 px-3 py-1 bg-hospital-50 text-hospital-700 hover:bg-hospital-100 rounded-md font-semibold text-xs transition border border-hospital-200"
                      >
                        <Eye className="w-3.5 h-3.5" />
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
