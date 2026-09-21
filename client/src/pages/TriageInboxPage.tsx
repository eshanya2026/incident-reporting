import { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Inbox } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader } from '../components/ui/primitives';
import IncidentTable from '../components/incident/IncidentTable';

const TABS = [
  { key: 'SUBMITTED', label: 'New reports', description: 'Assign each report to the responsible department HOD, ask the reporter for more information, or reject it.' },
  { key: 'INFO_REQUESTED', label: 'Waiting on reporter', description: 'Reports where you asked the reporter a question. They return to New reports when answered.' },
];

/** Quality: new reports to triage, oldest first. */
export default function TriageInboxPage() {
  const [tab, setTab] = useState('SUBMITTED');

  const queries = useQueries({
    queries: TABS.map((t) => ({
      queryKey: ['triage-queue', t.key],
      queryFn: () => api.get('/incidents/triage-queue', { params: { status: t.key } }),
    })),
  });
  const active = TABS.findIndex((t) => t.key === tab);
  const incidents: any[] = (queries[active].data as any)?.data || [];

  return (
    <div className="space-y-6 text-clinicalText-primary">
      <PageHeader icon={Inbox} title="Triage Inbox" description={TABS[active].description} />

      <div className="bg-white border border-clinicalBorder shadow-sm rounded-xl px-2 flex space-x-1">
        {TABS.map((t, i) => {
          const count = ((queries[i].data as any)?.data || []).length;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-3 text-xs border-b-[3px] transition cursor-pointer ${
                tab === t.key ? 'border-[#8B1E23] text-[#8B1E23] font-bold' : 'border-transparent text-[#64748B] hover:text-[#8B1E23] font-semibold'
              }`}
            >
              {t.label} <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-100 text-[10px]">{count}</span>
            </button>
          );
        })}
      </div>

      <IncidentTable
        incidents={incidents}
        loading={queries[active].isLoading}
        columns={['number', 'reported', 'title', 'occurredIn', 'reporter', 'reportedSeverity', 'waiting']}
        waitingSince={(i) => (tab === 'INFO_REQUESTED' ? i.infoRequests?.[i.infoRequests.length - 1]?.askedAt : i.reportedAt)}
        empty={tab === 'SUBMITTED' ? 'No new reports. The inbox is clear.' : 'No reports are waiting on a reporter.'}
      />
    </div>
  );
}
