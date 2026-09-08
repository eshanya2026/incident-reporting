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
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center space-x-2">
            <CheckSquare className="w-6 h-6 text-hospital-600" />
            <span>CAPA Action Items & Compliance Manager</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Track corrective & preventive actions, evidence uploads, target completion dates, and quality verifications.
          </p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
        >
          <option value="">-- Filter by Status (All) --</option>
          <option value="OPEN">OPEN</option>
          <option value="IN_PROGRESS">IN PROGRESS</option>
          <option value="PENDING_VERIFICATION">PENDING VERIFICATION</option>
          <option value="VERIFIED">VERIFIED</option>
          <option value="OVERDUE">OVERDUE</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
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
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading CAPA register...
                  </td>
                </tr>
              ) : capas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No CAPA items found.
                  </td>
                </tr>
              ) : (
                capas.map((c: any) => {
                  const isOverdue = dayjs().isAfter(dayjs(c.targetDate)) && c.status !== 'VERIFIED';
                  return (
                    <tr key={c._id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-bold text-hospital-700">{c.capaNumber}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${c.type === 'CORRECTIVE' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
                          {c.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">{c.action}</td>
                      <td className="py-3 px-4 text-slate-600">
                        <div>{c.ownerUserId?.name}</div>
                        <div className="text-[10px] text-slate-400">{c.ownerDepartmentId?.name}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className={`font-semibold ${isOverdue ? 'text-red-600 flex items-center space-x-1' : 'text-slate-700'}`}>
                          {isOverdue && <AlertTriangle className="w-3.5 h-3.5" />}
                          <span>{dayjs(c.targetDate).format('DD MMM YYYY')}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-amber-50 text-amber-800 border-amber-200 uppercase">
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedCapa(c)}
                          className="px-3 py-1 bg-hospital-50 text-hospital-700 hover:bg-hospital-100 rounded-md font-semibold text-xs transition border border-hospital-200"
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
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-800">
              Manage CAPA: {selectedCapa.capaNumber}
            </h3>
            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
              {selectedCapa.action}
            </p>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Completion Remarks (Owner)</label>
                <textarea
                  rows={2}
                  placeholder="Steps taken to implement corrective/preventive action..."
                  value={completionRemarks}
                  onChange={(e) => setCompletionRemarks(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                ></textarea>
                <button
                  onClick={handleCompleteCapa}
                  className="mt-2 px-3 py-1.5 bg-hospital-600 text-white font-semibold text-xs rounded-lg shadow"
                >
                  Submit Completion
                </button>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Quality Verification Remarks</label>
                <textarea
                  rows={2}
                  placeholder="Verification audit findings..."
                  value={verificationRemarks}
                  onChange={(e) => setVerificationRemarks(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                ></textarea>
                <div className="flex space-x-2 mt-2">
                  <button
                    onClick={() => handleVerifyCapa(true)}
                    className="px-3 py-1.5 bg-emerald-600 text-white font-semibold text-xs rounded-lg shadow"
                  >
                    Verify Effective
                  </button>
                  <button
                    onClick={() => handleVerifyCapa(false)}
                    className="px-3 py-1.5 bg-red-600 text-white font-semibold text-xs rounded-lg shadow"
                  >
                    Return Ineffective
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                onClick={() => setSelectedCapa(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold text-xs rounded-lg"
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
