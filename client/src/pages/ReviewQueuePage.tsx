import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, GitBranch, AlarmClock } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader } from '../components/ui/primitives';
import IncidentTable from '../components/incident/IncidentTable';

/**
 * Quality & RCA Heads: incidents submitted for closure, assigned for an RCA meeting, or overdue:
 * still with the department past the deadline of the priority Quality set at assignment.
 */
export default function ReviewQueuePage() {
  const [tab, setTab] = useState<'PENDING' | 'RCA' | 'OVERDUE'>('PENDING');

  const { data: pendingData, isLoading: loadingPending } = useQuery({
    queryKey: ['review-queue', 'PENDING_QUALITY_REVIEW'],
    queryFn: () => api.get('/incidents/review-queue'),
  });

  const { data: rcaData, isLoading: loadingRca } = useQuery({
    queryKey: ['review-queue', 'RCA_REQUESTED'],
    queryFn: () => api.get('/incidents/review-queue?status=RCA_REQUESTED'),
  });

  const { data: overdueData, isLoading: loadingOverdue } = useQuery({
    queryKey: ['review-queue', 'OVERDUE'],
    queryFn: () => api.get('/incidents/review-queue?status=OVERDUE'),
  });

  const pendingIncidents: any[] = (pendingData as any)?.data || [];
  const rcaIncidents: any[] = (rcaData as any)?.data || [];
  const overdueIncidents: any[] = (overdueData as any)?.data || [];

  const activeIncidents = tab === 'PENDING' ? pendingIncidents : tab === 'RCA' ? rcaIncidents : overdueIncidents;
  const isLoading = tab === 'PENDING' ? loadingPending : tab === 'RCA' ? loadingRca : loadingOverdue;

  return (
    <div className="space-y-6 text-clinicalText-primary">
      <PageHeader
        icon={ClipboardCheck}
        title="Review Queue"
        description="Review incidents submitted by HODs, or monitor RCA meetings requested from RCA Heads."
      >
        <div className="flex items-center gap-3">
          <div className="self-start md:self-auto shrink-0 px-4 py-2.5 rounded-2xl bg-black/20 border border-white/15 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            <div className="text-xl font-extrabold text-white leading-none">{pendingIncidents.length}</div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#E8C988] mt-0.5">Awaiting Review</div>
          </div>
          <div className="self-start md:self-auto shrink-0 px-4 py-2.5 rounded-2xl bg-black/20 border border-white/15 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            <div className="text-xl font-extrabold text-white leading-none">{rcaIncidents.length}</div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-purple-200 mt-0.5">RCA in progress</div>
          </div>
          <div className="self-start md:self-auto shrink-0 px-4 py-2.5 rounded-2xl bg-black/20 border border-white/15 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            <div className="text-xl font-extrabold text-white leading-none">{overdueIncidents.length}</div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-red-200 mt-0.5">Overdue</div>
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
              ? 'border-[#5C1A22] text-[#5C1A22]'
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
          <span>RCA Requested (RCA Head)</span>
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-purple-100 text-purple-800">
            {rcaIncidents.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab('OVERDUE')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 cursor-pointer transition ${
            tab === 'OVERDUE'
              ? 'border-red-600 text-red-700'
              : 'border-transparent text-clinicalText-secondary hover:text-clinicalText-primary'
          }`}
        >
          <AlarmClock className="w-4 h-4" />
          <span>Overdue (past priority deadline)</span>
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-red-100 text-red-800">{overdueIncidents.length}</span>
        </button>
      </div>

      {tab === 'OVERDUE' && (
        <p className="text-xs text-clinicalText-secondary -mt-2">
          Incidents still with the department after the time allowed by their priority: High 48 hrs, Medium 72 hrs, Low 5 days,
          Extremely Low 7 days from assignment. Most overdue first.
        </p>
      )}

      <IncidentTable
        incidents={activeIncidents}
        loading={isLoading}
        columns={
          tab === 'OVERDUE'
            ? ['number', 'title', 'responsible', 'priority', 'status', 'deadline']
            : ['number', 'title', 'responsible', 'severity', 'waiting']
        }
        waitingSince={(i) => (tab === 'PENDING' ? i.closureSubmission?.at : i.rcaRequestedAt)}
        empty={
          tab === 'PENDING'
            ? 'No incidents awaiting Quality review.'
            : tab === 'RCA'
              ? 'No incidents currently waiting for RCA.'
              : 'Nothing overdue. Every department is within its priority deadline.'
        }
      />
    </div>
  );
}
