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

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center space-x-2">
            <BarChart3 className="w-6 h-6 text-hospital-600" />
            <span>NABH / Quality Compliance Reports</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Export official hospital incident registers and safety compliance audit logs.
          </p>
        </div>

        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-slate-800 text-white font-semibold text-xs rounded-xl shadow flex items-center space-x-2 self-start md:self-auto"
        >
          <Printer className="w-4 h-4" />
          <span>Print / Export PDF</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Department</label>
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
      </div>

      {/* Printable Report Register Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 print:shadow-none print:border-none">
        <div className="border-b border-slate-200 pb-4 mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-800">Master Incident Register</h3>
            <div className="text-xs text-slate-500 mt-0.5">
              Adhiparasakthi Hospitals Quality Assurance Dept | Total: {reportIncidents.length} Records
            </div>
          </div>
          <span className="text-xs font-mono font-semibold text-slate-400">
            Generated: {dayjs().format('DD-MMM-YYYY HH:mm')}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 font-bold uppercase text-slate-700">
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
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-400">
                    Generating report data...
                  </td>
                </tr>
              ) : reportIncidents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-400">
                    No matching report records found.
                  </td>
                </tr>
              ) : (
                reportIncidents.map((inc: any) => (
                  <tr key={inc._id}>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{inc.incidentNumber}</td>
                    <td className="py-2.5 px-3 text-slate-600">{dayjs(inc.incidentDateTime).format('DD/MM/YYYY')}</td>
                    <td className="py-2.5 px-3 font-medium">{inc.departmentId?.name}</td>
                    <td className="py-2.5 px-3">{inc.categoryId?.name}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{inc.title}</td>
                    <td className="py-2.5 px-3 font-mono">{inc.patient?.uhid || 'N/A'}</td>
                    <td className="py-2.5 px-3 font-bold">Level {inc.severity}</td>
                    <td className="py-2.5 px-3 font-semibold uppercase">{inc.status}</td>
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
