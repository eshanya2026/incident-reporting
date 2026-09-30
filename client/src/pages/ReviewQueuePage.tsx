import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, GitBranch } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader } from '../components/ui/primitives';
import IncidentTable from '../components/incident/IncidentTable';

/** Quality & Quality Members: incidents submitted for closure or assigned for RCA. */
export default function ReviewQueuePage() {
  const [tab, setTab] = useState<'PENDING' | 'RCA'>('PENDING');

  const { data: pendingData, isLoading: loadingPending } = useQuery({
    queryKey: ['review-queue', 'PENDING_QUALITY_REVIEW'],
    queryFn: () => api.get('/incidents/review-queue'),
  });

  const { data: rcaData, isLoading: loadingRca } = useQuery({
    queryKey: ['review-queue', 'RCA_REQUESTED'],
    queryFn: () => api.get('/incidents/review-queue?status=RCA_REQUESTED'),
  });

  const pendingIncidents: any[] = (pendingData as any)?.data || [];
  const rcaIncidents: any[] = (rcaData as any)?.data || [];

  const activeIncidents = tab === 'PENDING' ? pendingIncidents : rcaIncidents;
  const isLoading = tab === 'PENDING' ? loadingPending : loadingRca;

  return (
    <div className="space-y-6 text-clinicalText-primary">
      <PageHeader
        icon={ClipboardCheck}
        title="Review Queue"
        description="Review incidents submitted by HODs, or monitor and perform 5-Why Root Cause Analyses requested for Quality Members."
      >
        <div className="flex items-center gap-3">
          <div className="self-start md:self-auto shrink-0 px-4 py-2.5 rounded-2xl bg-black/20 border border-white/15 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            <div className="text-xl font-extrabold text-white leading-none">{pendingIncidents.length}</div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#FBC9CB] mt-0.5">Awaiting Review</div>
          </div>
          <div className="self-start md:self-auto shrink-0 px-4 py-2.5 rounded-2xl bg-black/20 border border-white/15 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            <div className="text-xl font-extrabold text-white leading-none">{rcaIncidents.length}</div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-purple-200 mt-0.5">RCA in progress</div>
          </div>
        </div>
      </PageHeader>

      {/* Tabs */}
      <div className="flex border-b border-clinicalBorder gap-2">
        <button
          type="button"
          onClick={() => setTab('PENDING')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 cursor-pointer transition ${
            tab === 'PENDING'
              ? 'border-[#8B1E23] text-[#8B1E23]'
              : 'border-transparent text-clinicalText-secondary hover:text-clinicalText-primary'
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          <span>Pending Quality Review</span>
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-700">
            {pendingIncidents.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab('RCA')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 cursor-pointer transition ${
            tab === 'RCA'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-clinicalText-secondary hover:text-clinicalText-primary'
          }`}
        >
          <GitBranch className="w-4 h-4" />
          <span>RCA Requested (Quality Members)</span>
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-purple-100 text-purple-800">
            {rcaIncidents.length}
          </span>
        </button>
      </div>

      <IncidentTable
        incidents={activeIncidents}
        loading={isLoading}
        columns={['number', 'title', 'responsible', 'severity', 'waiting']}
        waitingSince={(i) => (tab === 'PENDING' ? i.closureSubmission?.at : i.rcaRequestedAt)}
        empty={tab === 'PENDING' ? 'No incidents awaiting Quality review.' : 'No incidents currently waiting for RCA.'}
      />
    </div>
  );
}
