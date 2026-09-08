import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
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
      {/* Header Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <span className="font-mono text-lg font-bold text-hospital-700">{incident.incidentNumber}</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
              Severity {incident.severity}: {incident.severityLabel}
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mt-1">{incident.title}</h2>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2">
            <span className="flex items-center space-x-1">
              <Building className="w-3.5 h-3.5" />
              <span>{incident.departmentId?.name}</span>
            </span>
            <span className="flex items-center space-x-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>{dayjs(incident.incidentDateTime).format('DD MMM YYYY HH:mm')}</span>
            </span>
            <span className="flex items-center space-x-1">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Reported by: {incident.reportedBy?.name}</span>
            </span>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[11px] font-bold text-slate-400 uppercase">Current Workflow Status</div>
          <div className="mt-1">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-hospital-100 text-hospital-800 border border-hospital-300 uppercase tracking-wider">
              {incident.status.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="bg-white border-b border-slate-200 rounded-xl px-2 flex space-x-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-4 py-3 text-xs font-semibold border-b-2 transition ${
            activeTab === 'summary' ? 'border-hospital-600 text-hospital-700' : 'border-transparent text-slate-500'
          }`}
        >
          Summary
        </button>
        <button
          onClick={() => setActiveTab('triage')}
          className={`px-4 py-3 text-xs font-semibold border-b-2 transition ${
            activeTab === 'triage' ? 'border-hospital-600 text-hospital-700' : 'border-transparent text-slate-500'
          }`}
        >
          Triage & Assignment
        </button>
        <button
          onClick={() => setActiveTab('investigation')}
          className={`px-4 py-3 text-xs font-semibold border-b-2 transition ${
            activeTab === 'investigation' ? 'border-hospital-600 text-hospital-700' : 'border-transparent text-slate-500'
          }`}
        >
          Investigation
        </button>
        <button
          onClick={() => setActiveTab('rca')}
          className={`px-4 py-3 text-xs font-semibold border-b-2 transition ${
            activeTab === 'rca' ? 'border-hospital-600 text-hospital-700' : 'border-transparent text-slate-500'
          }`}
        >
          RCA (5-Why)
        </button>
        <button
          onClick={() => setActiveTab('capa')}
          className={`px-4 py-3 text-xs font-semibold border-b-2 transition ${
            activeTab === 'capa' ? 'border-hospital-600 text-hospital-700' : 'border-transparent text-slate-500'
          }`}
        >
          CAPA Actions ({capas.length})
        </button>
        <button
          onClick={() => setActiveTab('closure')}
          className={`px-4 py-3 text-xs font-semibold border-b-2 transition ${
            activeTab === 'closure' ? 'border-hospital-600 text-hospital-700' : 'border-transparent text-slate-500'
          }`}
        >
          Closure & Sign-off
        </button>
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
            <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200 space-y-2">
              <h3 className="text-xs font-bold text-blue-900 uppercase">Patient Information</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Name:</span> <span className="font-semibold">{incident.patient.name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500">UHID:</span> <span className="font-mono font-semibold">{incident.patient.uhid || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500">IP No:</span> <span className="font-mono font-semibold">{incident.patient.ipNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Ward / Bed:</span> <span className="font-semibold">{incident.patient.ward || 'N/A'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Content 2: Triage */}
      {activeTab === 'triage' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="space-y-4 max-w-lg">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">HOD / Quality Triage</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Adjust Severity Level</label>
              <select
                value={triageSeverity}
                onChange={(e) => setTriageSeverity(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              >
                <option value={1}>Level 1 - Near Miss</option>
                <option value={2}>Level 2 - Minor</option>
                <option value={3}>Level 3 - Moderate</option>
                <option value={4}>Level 4 - Major</option>
                <option value={5}>Level 5 - Sentinel</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Triage Remarks</label>
              <textarea
                rows={3}
                value={triageRemarks}
                onChange={(e) => setTriageRemarks(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              ></textarea>
            </div>
            <button
              onClick={handleTriage}
              className="px-4 py-2 bg-hospital-600 text-white font-semibold text-xs rounded-lg shadow"
            >
              Submit Triage
            </button>
          </div>

          <div className="pt-6 border-t border-slate-200 space-y-4 max-w-lg">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Assign Investigator</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Select User</label>
              <select
                value={selectedInvestigator}
                onChange={(e) => setSelectedInvestigator(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
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
              className="px-4 py-2 bg-hospital-600 text-white font-semibold text-xs rounded-lg shadow"
            >
              Assign Investigator
            </button>
          </div>
        </div>
      )}

      {/* Tab Content 3: Investigation */}
      {activeTab === 'investigation' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          {!investigation ? (
            <div className="text-center py-6">
              <p className="text-xs text-slate-500 mb-4">No investigation record started yet.</p>
              <button
                onClick={handleStartInvestigation}
                className="px-4 py-2 bg-hospital-600 text-white font-semibold text-xs rounded-lg shadow"
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
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg"
                >
                  Save Draft
                </button>
                <button
                  onClick={handleCompleteInvestigation}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow"
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
                className="px-4 py-2 bg-hospital-600 text-white font-semibold text-xs rounded-lg shadow"
              >
                Save RCA
              </button>
              {rca && rca.status !== 'APPROVED' && (
                <button
                  onClick={handleApproveRca}
                  className="px-4 py-2 bg-emerald-600 text-white font-semibold text-xs rounded-lg shadow"
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
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          {/* Create CAPA Form */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <h4 className="text-xs font-bold uppercase text-slate-700">Add New CAPA Action Item</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Type</label>
                <select
                  value={capaType}
                  onChange={(e) => setCapaType(e.target.value as any)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded"
                >
                  <option value="CORRECTIVE">CORRECTIVE</option>
                  <option value="PREVENTIVE">PREVENTIVE</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Action Owner</label>
                <select
                  value={capaOwnerId}
                  onChange={(e) => setCapaOwnerId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded"
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
                <label className="block font-semibold text-slate-600 mb-1">Target Completion Date</label>
                <input
                  type="date"
                  value={capaTargetDate}
                  onChange={(e) => setCapaTargetDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Action Description *</label>
              <input
                type="text"
                placeholder="e.g. Conduct re-training on double-checking high alert medications"
                value={capaAction}
                onChange={(e) => setCapaAction(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded text-xs"
              />
            </div>

            <button
              onClick={handleCreateCapa}
              className="px-4 py-2 bg-hospital-600 text-white font-semibold text-xs rounded-lg shadow"
            >
              Add CAPA Action
            </button>
          </div>

          {/* CAPA List */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase text-slate-700">Action Items List</h4>
            {capas.length === 0 ? (
              <p className="text-xs text-slate-400">No CAPA items recorded.</p>
            ) : (
              capas.map((c: any) => (
                <div key={c._id} className="p-4 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-800">{c.capaNumber}: {c.action}</div>
                    <div className="text-slate-500 mt-1">
                      Owner: {c.ownerUserId?.name} | Target: {dayjs(c.targetDate).format('DD MMM YYYY')}
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full font-bold text-[10px] bg-amber-100 text-amber-800">
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
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 max-w-xl">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Quality Closure Sign-off</h3>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Final Closure Remarks *</label>
            <textarea
              rows={3}
              value={closureRemarks}
              onChange={(e) => setClosureRemarks(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            ></textarea>
          </div>
          <button
            onClick={handleCloseIncident}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-md"
          >
            Formally Close Incident
          </button>
        </div>
      )}
    </div>
  );
}
