import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, PlusCircle, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader } from '../components/ui/primitives';
import IncidentTable from '../components/incident/IncidentTable';
import { FilterChips } from '../components/ui/listKit';

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
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 to-white text-amber-900 shadow-xs">
          <span className="w-9 h-9 shrink-0 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </span>
          <div className="text-sm">
            <p className="font-bold">Action needed on {actionNeeded} report{actionNeeded > 1 ? 's' : ''}</p>
            <p className="text-amber-800/90 mt-0.5">Quality has asked you for more information. Open the report to answer.</p>
          </div>
        </div>
      )}

      <FilterChips
        value={filter}
        onChange={setFilter}
        options={FILTERS.map((f) => ({
          ...f,
          count: f.key === '' ? all.length : f.key === 'open' ? all.filter((i) => OPEN_STATUSES.includes(i.status)).length : all.filter((i) => i.status === f.key).length,
        }))}
      />

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
