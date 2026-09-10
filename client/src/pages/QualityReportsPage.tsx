import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Download, Printer, Filter, FileSpreadsheet } from 'lucide-react';
import { api } from '../lib/api';
import dayjs from 'dayjs';

export default function QualityReportsPage() {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [departmentId, setDepartmentId] = useState('');

  const { data: departmentsData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments'),
  });

  const { data: incidentReportData, isLoading } = useQuery({
    queryKey: ['report-incidents', fromDate, toDate, departmentId],
    queryFn: () =>
      api.get('/reports/incidents', {
        params: {
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          departmentId: departmentId || undefined,
        },
      }),
  });

  const departments = (departmentsData as any)?.data || [];
  const reportIncidents = (incidentReportData as any)?.data || [];

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
      1: { bg: 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0] font-semibold', label: 'L1 Near Miss' },
      2: { bg: 'bg-[#F0F9FF] text-[#0369A1] border-[#BAE6FD] font-semibold', label: 'L2 Minor' },
      3: { bg: 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA] font-bold', label: 'L3 Moderate' },
      4: { bg: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA] font-bold', label: 'L4 Major' },
      5: { bg: 'bg-[#6B1418] text-white border-[#4A0D10] font-black', label: 'L5 Sentinel' },
    };
    const s = map[sev] || { bg: 'bg-slate-100 text-slate-700 border-slate-200 font-semibold', label: `L${sev}` };
    return <span className={`inline-block px-2 py-0.5 rounded text-[10px] border ${s.bg}`}>{s.label}</span>;
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 text-clinicalText-primary">
      {/* Title Card - Separate floating box with light red tint on the left */}
      <div className="bg-gradient-to-r from-[#FDECEC]/70 via-[#FFFBFB] to-white p-6 rounded-2xl border border-clinicalBorder border-l-4 border-l-[#8B1E23] shadow-[0_4px_20px_rgba(15,23,42,0.06)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-clinicalText-primary flex items-center space-x-2">
            <BarChart3 className="w-6 h-6 text-maroon-700" />
            <span>NABH / Quality Compliance Reports</span>
          </h2>
          <p className="text-xs text-clinicalText-secondary mt-1">
            Export official hospital incident registers and safety compliance audit logs.
          </p>
        </div>

        <button
          onClick={handlePrint}
          className="px-5 py-2.5 bg-gradient-to-r from-[#8B1E23] via-[#C62828] to-[#E53935] hover:brightness-110 active:scale-[0.99] text-white font-semibold text-xs rounded-xl shadow-button-red hover:shadow-lg flex items-center space-x-2 self-start md:self-auto transition cursor-pointer"
        >
          <Printer className="w-4 h-4 text-white" />
          <span>Print / Export PDF</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-clinicalBorder shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-clinicalText-secondary mb-1">From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-clinicalText-secondary mb-1">To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-clinicalText-secondary mb-1">Department</label>
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
      </div>

      {/* Printable Report Register Table */}
      <div className="bg-white rounded-2xl border border-clinicalBorder shadow-card overflow-hidden p-6 print:shadow-none print:border-none">
        <div className="border-b border-clinicalBorder pb-4 mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-clinicalText-primary">Master Incident Register</h3>
            <div className="text-xs text-clinicalText-secondary mt-0.5">
              Adhiparasakthi Hospitals Quality Assurance Dept | Total: {reportIncidents.length} Records
            </div>
          </div>
          <span className="text-xs font-mono font-semibold text-clinicalText-secondary">
            Generated: {dayjs().format('DD-MMM-YYYY HH:mm')}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-clinicalBorder font-bold uppercase text-[11px] tracking-wider text-clinicalText-secondary">
                <th className="py-2.5 px-3">Inc #</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Department</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Title</th>
                <th className="py-2.5 px-3">UHID / Patient</th>
                <th className="py-2.5 px-3">Severity</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-clinicalText-secondary">
                    Generating report data...
                  </td>
                </tr>
              ) : reportIncidents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-clinicalText-secondary">
                    No matching report records found.
                  </td>
                </tr>
              ) : (
                reportIncidents.map((inc: any) => (
                  <tr key={inc._id} className="hover:bg-slate-50/80 transition">
                    <td className="py-2.5 px-3 font-mono font-bold text-maroon-700">{inc.incidentNumber}</td>
                    <td className="py-2.5 px-3 text-clinicalText-secondary">{dayjs(inc.incidentDateTime).format('DD/MM/YYYY')}</td>
                    <td className="py-2.5 px-3 font-medium text-clinicalText-primary">{inc.departmentId?.name}</td>
                    <td className="py-2.5 px-3 text-clinicalText-primary">{inc.categoryId?.name}</td>
                    <td className="py-2.5 px-3 font-semibold text-clinicalText-primary">{inc.title}</td>
                    <td className="py-2.5 px-3 font-mono text-clinicalText-secondary">{inc.patient?.uhid || 'N/A'}</td>
                    <td className="py-2.5 px-3">{getSeverityBadge(inc.severity)}</td>
                    <td className="py-2.5 px-3">{getStatusBadge(inc.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
