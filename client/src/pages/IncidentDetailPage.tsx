import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldAlert,
  FileText,
  Clock,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Send,
  Building,
  Calendar,
  Lock,
  ArrowLeft,
  Tag,
} from 'lucide-react';
import { api } from '../lib/api';
import dayjs from 'dayjs';

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'summary' | 'triage' | 'investigation' | 'rca' | 'capa' | 'closure'>('summary');

  // Queries
  const { data: incidentData, isLoading } = useQuery({
    queryKey: ['incident', id],
    queryFn: () => api.get(`/incidents/${id}`),
  });

  const { data: investigationData } = useQuery({
    queryKey: ['investigation', id],
    queryFn: () => api.get(`/incidents/${id}/investigation`),
    retry: false,
  });

  const { data: rcaData } = useQuery({
    queryKey: ['rca', id],
    queryFn: () => api.get(`/incidents/${id}/rca`),
    retry: false,
  });

  const { data: capasData } = useQuery({
    queryKey: ['capas', id],
    queryFn: () => api.get(`/incidents/${id}/capas`),
    retry: false,
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users'),
  });

  const incident = (incidentData as any)?.data;
  const investigation = (investigationData as any)?.data;
  const rca = (rcaData as any)?.data;
  const capas = (capasData as any)?.data || [];
  const users = (usersData as any)?.data || [];

  // Triage state
  const [triageSeverity, setTriageSeverity] = useState(1);
  const [triageRemarks, setTriageRemarks] = useState('');
  const [selectedInvestigator, setSelectedInvestigator] = useState('');

  // Investigation form state
  const [invFacts, setInvFacts] = useState('');
  const [invChronology, setInvChronology] = useState('');
  const [invFindings, setInvFindings] = useState('');

  // RCA Form State (5 Why)
  const [why1, setWhy1] = useState('');
  const [why2, setWhy2] = useState('');
  const [why3, setWhy3] = useState('');
  const [rcaSummary, setRcaSummary] = useState('');

  // CAPA Form State
  const [capaAction, setCapaAction] = useState('');
  const [capaType, setCapaType] = useState<'CORRECTIVE' | 'PREVENTIVE'>('CORRECTIVE');
  const [capaOwnerId, setCapaOwnerId] = useState('');
  const [capaTargetDate, setCapaTargetDate] = useState('');

  // Closure remarks
  const [closureRemarks, setClosureRemarks] = useState('');

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
      <span className={`inline-flex items-center px-3.5 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${style.bg} ${style.text} ${style.border}`}>
        <span className={`w-2 h-2 rounded-full mr-2 ${style.dot}`}></span>
        {s ? s.replace(/_/g, ' ') : 'N/A'}
      </span>
    );
  };

  const getSeverityBadgeClass = (sev: number) => {
    const map: Record<number, string> = {
      1: 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]',
      2: 'bg-[#F0F9FF] text-[#0369A1] border-[#BAE6FD]',
      3: 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]',
      4: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]',
      5: 'bg-[#6B1418] text-white border-[#4A0D10]',
    };
    return map[sev] || 'bg-slate-100 text-slate-700 border-slate-200';
  };

  if (isLoading) {
    return <div className="p-8 text-center text-xs text-slate-500">Loading incident details...</div>;
  }

  if (!incident) {
    return <div className="p-8 text-center text-xs text-red-500 font-semibold">Incident record not found.</div>;
  }

  const handleTriage = async () => {
    try {
      await api.post(`/incidents/${id}/triage`, { severity: Number(triageSeverity), remarks: triageRemarks });
      queryClient.invalidateQueries({ queryKey: ['incident', id] });
      alert('Triage complete!');
    } catch (err: any) {
      alert(err?.message || 'Triage failed');
    }
  };

  const handleAssignInvestigator = async () => {
    try {
      await api.post(`/incidents/${id}/assign-investigator`, { investigatorId: selectedInvestigator });
      queryClient.invalidateQueries({ queryKey: ['incident', id] });
      alert('Investigator assigned!');
    } catch (err: any) {
      alert(err?.message || 'Assignment failed');
    }
  };

  const handleStartInvestigation = async () => {
    try {
      await api.post(`/incidents/${id}/investigation`);
      queryClient.invalidateQueries({ queryKey: ['investigation', id] });
      queryClient.invalidateQueries({ queryKey: ['incident', id] });
    } catch (err: any) {
      alert(err?.message || 'Investigation start failed');
    }
  };

  const handleSaveInvestigation = async () => {
    if (!investigation) return;
    try {
      await api.patch(`/investigations/${investigation._id}`, {
        facts: invFacts || investigation.facts,
        chronology: invChronology || investigation.chronology,
        findings: invFindings || investigation.findings,
      });
      queryClient.invalidateQueries({ queryKey: ['investigation', id] });
      alert('Investigation draft saved');
    } catch (err: any) {
      alert(err?.message || 'Save failed');
    }
  };

  const handleCompleteInvestigation = async () => {
    if (!investigation) return;
    try {
      await api.post(`/investigations/${investigation._id}/complete`);
      queryClient.invalidateQueries({ queryKey: ['investigation', id] });
      queryClient.invalidateQueries({ queryKey: ['incident', id] });
      alert('Investigation finalized!');
    } catch (err: any) {
      alert(err?.message || 'Finalization failed');
    }
  };

  const handleSaveRca = async () => {
    try {
      await api.post(`/incidents/${id}/rca`, {
        method: 'FIVE_WHY',
        fiveWhy: [
          { sequence: 1, question: 'Why did this happen?', answer: why1 },
          { sequence: 2, question: 'Why did that happen?', answer: why2 },
          { sequence: 3, question: 'Why was that system condition present?', answer: why3 },
        ],
        rootCauseSummary: rcaSummary,
      });
      queryClient.invalidateQueries({ queryKey: ['rca', id] });
      alert('RCA saved successfully');
    } catch (err: any) {
      alert(err?.message || 'RCA save failed');
    }
  };

  const handleApproveRca = async () => {
    if (!rca) return;
    try {
      await api.post(`/rca/${rca._id}/approve`);
      queryClient.invalidateQueries({ queryKey: ['rca', id] });
      queryClient.invalidateQueries({ queryKey: ['incident', id] });
      alert('RCA approved!');
    } catch (err: any) {
      alert(err?.message || 'Approve failed');
    }
  };

  const handleCreateCapa = async () => {
    try {
      await api.post(`/incidents/${id}/capas`, {
        type: capaType,
        action: capaAction,
        ownerUserId: capaOwnerId,
        ownerDepartmentId: incident.departmentId?._id || incident.departmentId,
        targetDate: capaTargetDate,
      });
      queryClient.invalidateQueries({ queryKey: ['capas', id] });
      queryClient.invalidateQueries({ queryKey: ['incident', id] });
      setCapaAction('');
      alert('CAPA action created!');
    } catch (err: any) {
      alert(err?.message || 'CAPA creation failed');
    }
  };

  const handleCloseIncident = async () => {
    try {
      await api.post(`/incidents/${id}/close`, { remarks: closureRemarks });
      queryClient.invalidateQueries({ queryKey: ['incident', id] });
      alert('Incident closed successfully!');
    } catch (err: any) {
      alert(err?.message || 'Closure failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Back Navigation Bar */}
      <div className="flex items-center justify-between">
        <Link
          to="/incidents"
          className="inline-flex items-center space-x-2 text-xs font-semibold text-[#64748B] hover:text-[#8B1E23] bg-white hover:bg-[#FFF5F5] border border-clinicalBorder hover:border-[#FCD4D4] px-4 py-2 rounded-xl shadow-xs transition-all duration-150 group cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-[#64748B] group-hover:text-[#8B1E23] transition-transform duration-150 group-hover:-translate-x-1" />
          <span>Back to Incident Register</span>
        </Link>
      </div>

      {/* Header Card - Separate floating box with light red tint on the left */}
      <div className="bg-gradient-to-r from-[#FDECEC]/70 via-[#FFFBFB] to-white p-6 rounded-2xl border border-clinicalBorder border-l-4 border-l-[#8B1E23] shadow-[0_4px_20px_rgba(15,23,42,0.06)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <span className="font-mono text-lg font-black text-maroon-700">{incident.incidentNumber}</span>
            <span className={`px-3 py-0.5 rounded-full text-xs font-bold border ${getSeverityBadgeClass(incident.severity)}`}>
              Severity {incident.severity}: {incident.severityLabel}
            </span>
          </div>
          <h2 className="text-xl font-bold text-clinicalText-primary mt-1">{incident.title}</h2>
          <div className="flex flex-wrap items-center gap-4 text-xs text-clinicalText-secondary mt-2">
            <span className="flex items-center space-x-1">
              <Building className="w-3.5 h-3.5 text-maroon-700" />
              <span>{incident.departmentId?.name}</span>
            </span>
            <span className="flex items-center space-x-1">
              <Calendar className="w-3.5 h-3.5 text-maroon-700" />
              <span>{dayjs(incident.incidentDateTime).format('DD MMM YYYY HH:mm')}</span>
            </span>
            <span className="flex items-center space-x-1">
              <UserCheck className="w-3.5 h-3.5 text-maroon-700" />
              <span>Reported by: {incident.reportedBy?.name}</span>
            </span>
            <span className="flex items-center space-x-1">
              <Tag className="w-3.5 h-3.5 text-maroon-700" />
              <span>
                Category: <strong className="text-clinicalText-primary">{incident.categoryId?.name || 'N/A'}</strong>
                {incident.subcategoryCode && (
                  <span className="text-clinicalText-secondary font-medium ml-1">
                    ({incident.categoryId?.subcategories?.find((s: any) => s.code === incident.subcategoryCode)?.name || incident.subcategoryCode})
                  </span>
                )}
              </span>
            </span>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[11px] font-bold text-clinicalText-secondary uppercase">Current Workflow Status</div>
          <div className="mt-1">
            {getStatusBadge(incident.status)}
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="bg-white border border-clinicalBorder shadow-sm rounded-xl px-2 flex space-x-1 overflow-x-auto">
        {[
          { id: 'summary', label: 'Summary' },
          { id: 'triage', label: 'Triage & Assignment' },
          { id: 'investigation', label: 'Investigation' },
          { id: 'rca', label: 'RCA (5-Why)' },
          { id: 'capa', label: `CAPA Actions (${capas.length})` },
          { id: 'closure', label: 'Closure & Sign-off' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-5 py-3 text-xs rounded-t-xl transition-all duration-150 cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'border-b-[3px] border-[#8B1E23] text-[#8B1E23] bg-[#FFF5F5] font-bold shadow-xs'
                  : 'border-b-[3px] border-transparent text-[#64748B] hover:text-[#8B1E23] hover:bg-[#FFF5F5] hover:border-[#8B1E23]/30 font-semibold'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content 1: Summary */}
      {activeTab === 'summary' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</h3>
              <p className="text-xs text-slate-800 bg-slate-50 p-4 rounded-xl border border-slate-200 leading-relaxed">
                {incident.description}
              </p>
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Immediate Action Taken</h3>
              <p className="text-xs text-slate-800 bg-slate-50 p-4 rounded-xl border border-slate-200 leading-relaxed">
                {incident.immediateAction || 'None reported.'}
              </p>
            </div>
          </div>

          {incident.patientInvolved && incident.patient && (
            <div className="p-4 bg-slate-50 rounded-xl border border-clinicalBorder space-y-2">
              <h3 className="text-xs font-bold text-maroon-700 uppercase">Patient Information</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-clinicalText-secondary">Name:</span> <span className="font-semibold text-clinicalText-primary">{incident.patient.name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-clinicalText-secondary">UHID:</span> <span className="font-mono font-semibold text-clinicalText-primary">{incident.patient.uhid || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-clinicalText-secondary">IP No:</span> <span className="font-mono font-semibold text-clinicalText-primary">{incident.patient.ipNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-clinicalText-secondary">Ward / Bed:</span> <span className="font-semibold text-clinicalText-primary">{incident.patient.ward || 'N/A'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Content 2: Triage */}
      {activeTab === 'triage' && (
        <div className="bg-white p-6 rounded-2xl border border-clinicalBorder shadow-card space-y-6">
          <div className="space-y-4 max-w-lg">
            <h3 className="text-sm font-bold text-clinicalText-primary uppercase tracking-wider">HOD / Quality Triage</h3>
            <div>
              <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">Adjust Severity Level</label>
              <select
                value={triageSeverity}
                onChange={(e) => setTriageSeverity(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
              >
                <option value={1}>Level 1 – Near Miss (No Harm)</option>
                <option value={2}>Level 2 – Minor Harm</option>
                <option value={3}>Level 3 – Moderate Harm</option>
                <option value={4}>Level 4 – Major Harm</option>
                <option value={5}>Level 5 – Critical / Sentinel Event</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">Triage Remarks</label>
              <textarea
                rows={3}
                value={triageRemarks}
                onChange={(e) => setTriageRemarks(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
              ></textarea>
            </div>
            <button
              onClick={handleTriage}
              className="px-5 py-2.5 bg-gradient-to-r from-[#8B1E23] via-[#C62828] to-[#E53935] hover:brightness-110 active:scale-[0.99] text-white font-semibold text-xs rounded-xl shadow-button-red hover:shadow-lg transition cursor-pointer"
            >
              Submit Triage
            </button>
          </div>

          <div className="pt-6 border-t border-clinicalBorder space-y-4 max-w-lg">
            <h3 className="text-sm font-bold text-clinicalText-primary uppercase tracking-wider">Assign Investigator</h3>
            <div>
              <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">Select User</label>
              <select
                value={selectedInvestigator}
                onChange={(e) => setSelectedInvestigator(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
              >
                <option value="">-- Choose Investigator --</option>
                {users.map((u: any) => (
                  <option key={u._id} value={u._id}>
                    {u.name} ({u.designation || 'Staff'})
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleAssignInvestigator}
              className="px-5 py-2.5 bg-gradient-to-r from-[#8B1E23] via-[#C62828] to-[#E53935] hover:brightness-110 active:scale-[0.99] text-white font-semibold text-xs rounded-xl shadow-button-red hover:shadow-lg transition cursor-pointer"
            >
              Assign Investigator
            </button>
          </div>
        </div>
      )}

      {/* Tab Content 3: Investigation */}
      {activeTab === 'investigation' && (
        <div className="bg-white p-6 rounded-2xl border border-clinicalBorder shadow-card space-y-6">
          {!investigation ? (
            <div className="text-center py-6">
              <p className="text-xs text-clinicalText-secondary mb-4">No investigation record started yet.</p>
              <button
                onClick={handleStartInvestigation}
                className="px-5 py-2.5 bg-gradient-to-r from-[#8B1E23] via-[#C62828] to-[#E53935] hover:brightness-110 active:scale-[0.99] text-white font-semibold text-xs rounded-xl shadow-button-red hover:shadow-lg transition cursor-pointer"
              >
                Start Investigation
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-slate-500">
                  Status: {investigation.status} | Due: {dayjs(investigation.dueDate).format('DD MMM YYYY')}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Established Facts</label>
                <textarea
                  rows={3}
                  value={invFacts || investigation.facts || ''}
                  onChange={(e) => setInvFacts(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                ></textarea>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Chronology / Timeline of Events</label>
                <textarea
                  rows={3}
                  value={invChronology || investigation.chronology || ''}
                  onChange={(e) => setInvChronology(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                ></textarea>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Investigation Findings *</label>
                <textarea
                  rows={3}
                  value={invFindings || investigation.findings || ''}
                  onChange={(e) => setInvFindings(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                ></textarea>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleSaveInvestigation}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition cursor-pointer"
                >
                  Save Draft
                </button>
                <button
                  onClick={handleCompleteInvestigation}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold text-xs rounded-xl shadow-md hover:shadow-lg shadow-emerald-500/20 transition cursor-pointer"
                >
                  Finalize Investigation
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Content 4: RCA */}
      {activeTab === 'rca' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="space-y-4 max-w-xl">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">5-Why Root Cause Analysis</h3>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Why 1: Why did the event occur?</label>
              <input
                type="text"
                value={why1}
                onChange={(e) => setWhy1(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Why 2: Why did that condition exist?</label>
              <input
                type="text"
                value={why2}
                onChange={(e) => setWhy2(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Why 3: System / Process root cause?</label>
              <input
                type="text"
                value={why3}
                onChange={(e) => setWhy3(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Root Cause Summary *</label>
              <textarea
                rows={3}
                value={rcaSummary}
                onChange={(e) => setRcaSummary(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              ></textarea>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleSaveRca}
                className="px-5 py-2.5 bg-gradient-to-r from-[#8B1E23] via-[#C62828] to-[#E53935] hover:brightness-110 active:scale-[0.99] text-white font-semibold text-xs rounded-xl shadow-button-red hover:shadow-lg transition cursor-pointer"
              >
                Save RCA
              </button>
              {rca && rca.status !== 'APPROVED' && (
                <button
                  onClick={handleApproveRca}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold text-xs rounded-xl shadow-md hover:shadow-lg shadow-emerald-500/20 transition cursor-pointer"
                >
                  Quality Admin Approve RCA
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab Content 5: CAPA */}
      {activeTab === 'capa' && (
        <div className="bg-white p-6 rounded-2xl border border-clinicalBorder shadow-card space-y-6">
          {/* Create CAPA Form */}
          <div className="p-4 bg-slate-50 rounded-xl border border-clinicalBorder space-y-3">
            <h4 className="text-xs font-bold uppercase text-clinicalText-primary">Add New CAPA Action Item</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-clinicalText-secondary mb-1">Type</label>
                <select
                  value={capaType}
                  onChange={(e) => setCapaType(e.target.value as any)}
                  className="w-full px-3 py-1.5 bg-white border border-clinicalBorder rounded text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 transition"
                >
                  <option value="CORRECTIVE">CORRECTIVE</option>
                  <option value="PREVENTIVE">PREVENTIVE</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-clinicalText-secondary mb-1">Action Owner</label>
                <select
                  value={capaOwnerId}
                  onChange={(e) => setCapaOwnerId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-clinicalBorder rounded text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 transition"
                >
                  <option value="">-- Choose Owner --</option>
                  {users.map((u: any) => (
                    <option key={u._id} value={u._id}>
                      {u.name} ({u.designation || 'Staff'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-clinicalText-secondary mb-1">Target Completion Date</label>
                <input
                  type="date"
                  value={capaTargetDate}
                  onChange={(e) => setCapaTargetDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-clinicalBorder rounded text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">Action Description *</label>
              <input
                type="text"
                placeholder="e.g. Conduct re-training on double-checking high alert medications"
                value={capaAction}
                onChange={(e) => setCapaAction(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-clinicalBorder rounded text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 transition"
              />
            </div>

            <button
              onClick={handleCreateCapa}
              className="px-5 py-2.5 bg-gradient-to-r from-[#8B1E23] via-[#C62828] to-[#E53935] hover:brightness-110 active:scale-[0.99] text-white font-semibold text-xs rounded-xl shadow-button-red hover:shadow-lg transition cursor-pointer"
            >
              Add CAPA Action
            </button>
          </div>

          {/* CAPA List */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase text-clinicalText-primary">Action Items List</h4>
            {capas.length === 0 ? (
              <p className="text-xs text-clinicalText-muted">No CAPA items recorded.</p>
            ) : (
              capas.map((c: any) => (
                <div key={c._id} className="p-4 bg-white border border-clinicalBorder rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-clinicalText-primary">{c.capaNumber}: {c.action}</div>
                    <div className="text-clinicalText-secondary mt-1">
                      Owner: {c.ownerUserId?.name} | Target: {dayjs(c.targetDate).format('DD MMM YYYY')}
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] border uppercase ${
                    c.status === 'COMPLETED' || c.status === 'VERIFIED'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}>
                    {c.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab Content 6: Closure */}
      {activeTab === 'closure' && (
        <div className="bg-white p-6 rounded-2xl border border-clinicalBorder shadow-card space-y-6 max-w-xl">
          <h3 className="text-sm font-bold text-clinicalText-primary uppercase tracking-wider">Quality Closure Sign-off</h3>
          <div>
            <label className="block text-xs font-semibold text-clinicalText-secondary mb-1">Final Closure Remarks *</label>
            <textarea
              rows={3}
              value={closureRemarks}
              onChange={(e) => setClosureRemarks(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
            ></textarea>
          </div>
          <button
            onClick={handleCloseIncident}
            className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold text-xs rounded-xl shadow-md hover:shadow-lg shadow-emerald-500/20 transition cursor-pointer"
          >
            Formally Close Incident
          </button>
        </div>
      )}
    </div>
  );
}
