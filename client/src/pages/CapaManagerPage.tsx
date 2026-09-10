import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckSquare, Search, Clock, CheckCircle2, AlertTriangle, Eye } from 'lucide-react';
import { api } from '../lib/api';
import dayjs from 'dayjs';

export default function CapaManagerPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedCapa, setSelectedCapa] = useState<any>(null);
  const [completionRemarks, setCompletionRemarks] = useState('');
  const [verificationRemarks, setVerificationRemarks] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['all-capas', statusFilter],
    queryFn: () => api.get(statusFilter ? `/capas?status=${statusFilter}` : '/capas'),
  });

  const capas = (data as any)?.data || [];

  const handleCompleteCapa = async () => {
    if (!selectedCapa) return;
    try {
      await api.post(`/capas/${selectedCapa._id}/complete`, { completionRemarks });
      queryClient.invalidateQueries({ queryKey: ['all-capas'] });
      setSelectedCapa(null);
      setCompletionRemarks('');
      alert('CAPA action marked complete and submitted for verification!');
    } catch (err: any) {
      alert(err?.message || 'Completion failed');
    }
  };

  const handleVerifyCapa = async (effective: boolean) => {
    if (!selectedCapa) return;
    try {
      await api.post(`/capas/${selectedCapa._id}/verify`, {
        effective,
        remarks: verificationRemarks || (effective ? 'Verified effective' : 'Returned for re-action'),
      });
      queryClient.invalidateQueries({ queryKey: ['all-capas'] });
      setSelectedCapa(null);
      setVerificationRemarks('');
      alert('CAPA verification recorded!');
    } catch (err: any) {
      alert(err?.message || 'Verification failed');
    }
  };

  return (
    <div className="space-y-6 text-clinicalText-primary">
      {/* Title Card - Separate floating box with light red tint on the left */}
      <div className="bg-gradient-to-r from-[#FDECEC]/70 via-[#FFFBFB] to-white p-6 rounded-2xl border border-clinicalBorder border-l-4 border-l-[#8B1E23] shadow-[0_4px_20px_rgba(15,23,42,0.06)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-clinicalText-primary flex items-center space-x-2">
            <CheckSquare className="w-6 h-6 text-maroon-700" />
            <span>CAPA Action Items & Compliance Manager</span>
          </h2>
          <p className="text-xs text-clinicalText-secondary mt-1">
            Track corrective & preventive actions, evidence uploads, target completion dates, and quality verifications.
          </p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-clinicalBorder shadow-sm flex items-center space-x-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
        >
          <option value="">-- Filter by Status (All) --</option>
          <option value="OPEN">OPEN</option>
          <option value="IN_PROGRESS">IN PROGRESS</option>
          <option value="PENDING_VERIFICATION">PENDING VERIFICATION</option>
          <option value="VERIFIED">VERIFIED</option>
          <option value="OVERDUE">OVERDUE</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-clinicalBorder shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-clinicalBorder text-[11px] font-bold uppercase tracking-wider text-clinicalText-secondary">
                <th className="py-3 px-4">CAPA ID</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Action Description</th>
                <th className="py-3 px-4">Owner User / Dept</th>
                <th className="py-3 px-4">Target Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-clinicalText-secondary">
                    Loading CAPA register...
                  </td>
                </tr>
              ) : capas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-clinicalText-secondary">
                    No CAPA items found.
                  </td>
                </tr>
              ) : (
                capas.map((c: any) => {
                  const isOverdue = dayjs().isAfter(dayjs(c.targetDate)) && c.status !== 'VERIFIED';
                  return (
                    <tr key={c._id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-maroon-700">{c.capaNumber}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${
                          c.type === 'CORRECTIVE'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {c.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-clinicalText-primary">{c.action}</td>
                      <td className="py-3 px-4 text-clinicalText-secondary">
                        <div className="font-semibold text-clinicalText-primary">{c.ownerUserId?.name}</div>
                        <div className="text-[10px] text-clinicalText-muted">{c.ownerDepartmentId?.name}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className={`font-semibold ${isOverdue ? 'text-brandRed-600 flex items-center space-x-1' : 'text-clinicalText-primary'}`}>
                          {isOverdue && <AlertTriangle className="w-3.5 h-3.5" />}
                          <span>{dayjs(c.targetDate).format('DD MMM YYYY')}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                          c.status === 'VERIFIED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : isOverdue || c.status === 'OVERDUE'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                            c.status === 'VERIFIED'
                              ? 'bg-emerald-500'
                              : isOverdue || c.status === 'OVERDUE'
                              ? 'bg-red-500'
                              : 'bg-blue-500'
                          }`}></span>
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedCapa(c)}
                          className="px-3 py-1 bg-white hover:bg-[#FFF5F5] text-clinicalText-primary hover:text-[#8B1E23] hover:border-[#EBA3A7] rounded-md font-semibold text-xs transition border border-clinicalBorder shadow-xs cursor-pointer"
                        >
                          Manage Action
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Modal */}
      {selectedCapa && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl border border-clinicalBorder">
            <h3 className="text-base font-bold text-clinicalText-primary">
              Manage CAPA: {selectedCapa.capaNumber}
            </h3>
            <p className="text-xs text-clinicalText-secondary bg-slate-50 p-3 rounded-lg border border-clinicalBorder">
              {selectedCapa.action}
            </p>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">Completion Remarks (Owner)</label>
                <textarea
                  rows={2}
                  placeholder="Steps taken to implement corrective/preventive action..."
                  value={completionRemarks}
                  onChange={(e) => setCompletionRemarks(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
                ></textarea>
                <button
                  onClick={handleCompleteCapa}
                  className="mt-2 px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold text-xs rounded-xl shadow-md hover:shadow-lg shadow-emerald-500/20 transition cursor-pointer"
                >
                  Submit Completion
                </button>
              </div>

              <div className="pt-4 border-t border-clinicalBorder">
                <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">Quality Verification Remarks</label>
                <textarea
                  rows={2}
                  placeholder="Verification audit findings..."
                  value={verificationRemarks}
                  onChange={(e) => setVerificationRemarks(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
                ></textarea>
                <div className="flex space-x-2 mt-2">
                  <button
                    onClick={() => handleVerifyCapa(true)}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold text-xs rounded-xl shadow-md hover:shadow-lg shadow-emerald-500/20 transition cursor-pointer"
                  >
                    Verify Effective
                  </button>
                  <button
                    onClick={() => handleVerifyCapa(false)}
                    className="px-4 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-semibold text-xs rounded-xl shadow-md hover:shadow-lg shadow-red-500/20 transition cursor-pointer"
                  >
                    Return Ineffective
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                onClick={() => setSelectedCapa(null)}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-clinicalText-secondary hover:text-clinicalText-primary border border-clinicalBorder font-medium text-xs rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
