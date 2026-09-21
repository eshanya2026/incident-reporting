import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, PlusCircle } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader } from '../components/ui/primitives';
import IncidentTable from '../components/incident/IncidentTable';

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'INFO_REQUESTED', label: 'Action needed' },
  { key: 'open', label: 'In progress' },
  { key: 'CLOSED', label: 'Closed' },
  { key: 'REJECTED', label: 'Rejected' },
];

const OPEN_STATUSES = ['SUBMITTED', 'ASSIGNED', 'UNDER_INVESTIGATION', 'CAPA_IN_PROGRESS', 'PENDING_QUALITY_REVIEW'];

/** Staff: the incidents they reported, with anything Quality is waiting on flagged. */
export default function MyReportsPage() {
  const [filter, setFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['my-reports'],
    queryFn: () => api.get('/incidents', { params: { mine: true, limit: 200 } }),
  });
  const all: any[] = (data as any)?.data || [];
  const actionNeeded = all.filter((i) => i.status === 'INFO_REQUESTED').length;
  const incidents = all.filter((i) =>
    !filter ? true : filter === 'open' ? OPEN_STATUSES.includes(i.status) : i.status === filter
  );

  return (
    <div className="space-y-6 text-clinicalText-primary">
      <PageHeader icon={FileText} title="My Reports" description="Incidents you reported and where each one is now.">
        <Link
          to="/incidents/new"
          className="px-5 py-2.5 bg-gradient-to-r from-[#8B1E23] via-[#C62828] to-[#E53935] hover:brightness-110 text-white font-semibold text-xs rounded-xl shadow-button-red transition flex items-center space-x-2 self-start md:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Report Incident</span>
        </Link>
      </PageHeader>

      {actionNeeded > 0 && (
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs font-semibold">
          Quality has asked you for more information on {actionNeeded} report{actionNeeded > 1 ? 's' : ''}. Open the report to answer.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
              filter === f.key ? 'bg-[#8B1E23] text-white border-[#8B1E23]' : 'bg-white text-clinicalText-secondary border-clinicalBorder hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <IncidentTable
        incidents={incidents}
        loading={isLoading}
        columns={['number', 'occurred', 'title', 'occurredIn', 'reportedSeverity', 'status']}
        highlight={(i) => (i.status === 'INFO_REQUESTED' ? 'Action needed' : undefined)}
        empty="You have not reported any incidents yet."
      />
    </div>
  );
}
