import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Building2, AlertTriangle, ClipboardList, Search as SearchIcon, ListChecks } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader } from '../components/ui/primitives';
import IncidentTable from '../components/incident/IncidentTable';
import { statusMeta } from '../lib/incidentMeta';
import { StatTile, TabBar } from '../components/ui/listKit';

// Statuses in which the incident is with the HOD, in workflow order
const WORK_STATUSES = ['ASSIGNED', 'UNDER_INVESTIGATION', 'CAPA_IN_PROGRESS'];

/** HOD: incidents Quality assigned to their department. */
export default function MyDepartmentPage() {
  const [tab, setTab] = useState<'work' | 'review' | 'history'>('work');

  const current = useQuery({ queryKey: ['my-department'], queryFn: () => api.get('/incidents/my-department') });
  // Everything the department has seen, including incidents it returned to Quality and closed ones
  const history = useQuery({
    queryKey: ['my-department-history'],
    queryFn: () => api.get('/incidents', { params: { limit: 200 } }),
    enabled: tab === 'history',
  });

  const assigned: any[] = (current.data as any)?.data || [];
  const toWork = assigned.filter((i) => WORK_STATUSES.includes(i.status));
  const withQuality = assigned.filter((i) => i.status === 'PENDING_QUALITY_REVIEW');
  const overdue = toWork.filter((i) => i.status === 'ASSIGNED' && dayjs().diff(dayjs(i.assignedAt), 'day') >= 2).length;

  const tabs = [
    { key: 'work', label: 'To work on', count: toWork.length },
    { key: 'review', label: 'With Quality for review', count: withQuality.length },
    { key: 'history', label: 'All department incidents' },
  ] as const;

  return (
    <div className="space-y-6 text-clinicalText-primary">
      <PageHeader
        icon={Building2}
        title="My Department's Incidents"
        description="Investigate each incident, write the RCA and CAPA, then submit it for Quality review. Return anything assigned to the wrong department."
      />

      {tab === 'work' && toWork.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {WORK_STATUSES.map((s, i) => (
            <StatTile
              key={s}
              label={statusMeta(s).label}
              value={toWork.filter((inc) => inc.status === s).length}
              icon={[ClipboardList, SearchIcon, ListChecks][i]}
              tone={(['violet', 'blue', 'amber'] as const)[i]}
            />
          ))}
        </div>
      )}
      {tab === 'work' && overdue > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 to-white text-amber-900 text-sm">
          <span className="w-9 h-9 shrink-0 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </span>
          <span className="font-semibold">
            {overdue} newly assigned incident{overdue > 1 ? 's have' : ' has'} not been started for 2 days or more.
          </span>
        </div>
      )}

      <TabBar
        active={tab}
        onChange={setTab}
        tabs={tabs.map((t) => ({ key: t.key, label: t.label, count: 'count' in t ? t.count : undefined }))}
      />

      {tab === 'work' && (
        <IncidentTable
          incidents={toWork}
          loading={current.isLoading}
          columns={['number', 'title', 'occurredIn', 'severity', 'status', 'waiting']}
          waitingSince={(i) => i.assignedAt}
          highlight={(i) => (i.status === 'ASSIGNED' ? 'New' : undefined)}
          empty="Nothing to work on. New assignments from Quality appear here."
        />
      )}
      {tab === 'review' && (
        <IncidentTable
          incidents={withQuality}
          loading={current.isLoading}
          columns={['number', 'title', 'severity', 'status', 'waiting']}
          waitingSince={(i) => i.closureSubmission?.at}
          empty="Nothing is with Quality right now."
        />
      )}
      {tab === 'history' && (
        <IncidentTable
          incidents={(history.data as any)?.data || []}
          loading={history.isLoading}
          columns={['number', 'occurred', 'title', 'responsible', 'severity', 'status']}
          empty="No incidents have been assigned to your department."
        />
      )}
    </div>
  );
}
