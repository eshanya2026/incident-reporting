import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader } from '../components/ui/primitives';
import IncidentTable from '../components/incident/IncidentTable';

/** Quality: incidents the HOD submitted for closure, oldest first. */
export default function ReviewQueuePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['review-queue'],
    queryFn: () => api.get('/incidents/review-queue'),
  });
  const incidents: any[] = (data as any)?.data || [];

  return (
    <div className="space-y-6 text-clinicalText-primary">
      <PageHeader
        icon={ClipboardCheck}
        title="Review Queue"
        description="HODs have submitted these incidents for closure. Review the investigation, RCA and each CAPA, then close the incident or send it back."
      >
        <div className="self-start md:self-auto shrink-0 px-5 py-3 rounded-2xl bg-black/20 border border-white/15 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
          <div className="text-2xl font-extrabold text-white leading-none">{incidents.length}</div>
          <div className="text-[11.5px] font-semibold uppercase tracking-wider text-[#FBC9CB] mt-1">Awaiting review</div>
        </div>
      </PageHeader>
      <IncidentTable
        incidents={incidents}
        loading={isLoading}
        columns={['number', 'title', 'responsible', 'severity', 'waiting']}
        waitingSince={(i) => i.closureSubmission?.at}
        empty="Nothing is waiting for review."
      />
    </div>
  );
}
