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
      />
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
