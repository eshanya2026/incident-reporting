import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Building2 } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader } from '../components/ui/primitives';
import IncidentTable from '../components/incident/IncidentTable';
import { statusMeta } from '../lib/incidentMeta';

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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {WORK_STATUSES.map((s) => (
            <div key={s} className="bg-white border border-clinicalBorder rounded-xl p-4 shadow-card">
              <div className="text-[11px] font-bold uppercase text-clinicalText-muted">{statusMeta(s).label}</div>
              <div className="text-2xl font-bold text-clinicalText-primary mt-1">{toWork.filter((i) => i.status === s).length}</div>
            </div>
          ))}
        </div>
      )}
      {tab === 'work' && overdue > 0 && (
        <div className="p-3 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs font-semibold">
          {overdue} newly assigned incident{overdue > 1 ? 's have' : ' has'} not been started for 2 days or more.
        </div>
      )}

      <div className="bg-white border border-clinicalBorder shadow-sm rounded-xl px-2 flex space-x-1 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-3 text-xs border-b-[3px] whitespace-nowrap transition cursor-pointer ${
              tab === t.key ? 'border-[#8B1E23] text-[#8B1E23] font-bold' : 'border-transparent text-[#64748B] hover:text-[#8B1E23] font-semibold'
            }`}
          >
            {t.label}
            {'count' in t && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-100 text-[10px]">{t.count}</span>}
          </button>
        ))}
      </div>

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
