import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { CheckSquare, ArrowRight, CircleDot, AlarmClock, Hourglass, BadgeCheck, ListChecks } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { hasPermission } from '../lib/rbac';
import { CAPA_STATUS_META } from '../lib/incidentMeta';
import { PageHeader } from '../components/ui/primitives';
import { CapaStatusBadge } from '../components/incident/Badges';
import { EmptyState, FilterChips, StatTile, TableSkeleton } from '../components/ui/listKit';

/**
 * CAPA register. HODs see their department's actions and complete them from the incident page;
 * Quality and Admin see all actions (Quality judges effectiveness during the incident review).
 */
export default function CapaManagerPage() {
  const user = useAuthStore((state) => state.user);
  const isHod = hasPermission(user, 'capa.write');
  const [filter, setFilter] = useState('');

  // One query for every action; filters and counts are worked out here so the chips can show totals
  const { data, isLoading } = useQuery({
    queryKey: ['all-capas'],
    queryFn: () => api.get('/capas', { params: { limit: 200 } }),
  });
  const all: any[] = (data as any)?.data || [];
  const isOverdue = (c: any) => c.status === 'OPEN' && dayjs().isAfter(dayjs(c.targetDate), 'day');

  const counts = {
    '': all.length,
    OPEN: all.filter((c) => c.status === 'OPEN').length,
    overdue: all.filter(isOverdue).length,
    DONE: all.filter((c) => c.status === 'DONE').length,
    EFFECTIVE: all.filter((c) => c.status === 'EFFECTIVE').length,
  };

  const FILTERS = [
    { key: '', label: 'All', count: counts[''] },
    { key: 'OPEN', label: CAPA_STATUS_META.OPEN.label, count: counts.OPEN },
    { key: 'overdue', label: 'Overdue', count: counts.overdue },
    { key: 'DONE', label: CAPA_STATUS_META.DONE.label, count: counts.DONE },
    { key: 'EFFECTIVE', label: CAPA_STATUS_META.EFFECTIVE.label, count: counts.EFFECTIVE },
  ];

  const capas = all.filter((c) => (!filter ? true : filter === 'overdue' ? isOverdue(c) : c.status === filter));

  return (
    <div className="space-y-6 text-clinicalText-primary">
      <PageHeader
        icon={CheckSquare}
        title={isHod ? "My Department's CAPA" : 'CAPA Register'}
        description={
          isHod
            ? 'Corrective and preventive actions for incidents assigned to your department. Open the incident to add actions or mark them done.'
            : 'All corrective and preventive actions. Quality judges effectiveness when reviewing each incident.'
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatTile label="Open actions" value={counts.OPEN} icon={CircleDot} tone="blue" />
        <StatTile label="Overdue" value={counts.overdue} icon={AlarmClock} tone="red" hint={counts.overdue ? 'Past target date' : 'Nothing overdue'} />
        <StatTile label="Awaiting review" value={counts.DONE} icon={Hourglass} tone="amber" />
        <StatTile label="Effective" value={counts.EFFECTIVE} icon={BadgeCheck} tone="green" />
      </div>

      <FilterChips value={filter} onChange={setFilter} options={FILTERS} />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>CAPA</th>
                <th>Action</th>
                <th>Incident</th>
                <th>Department / Owner</th>
                <th>Target</th>
                <th>Status</th>
                <th className="text-right">Details</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton columns={7} />
              ) : capas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="!p-0">
                    <EmptyState icon={ListChecks} message="No CAPA actions found." />
                  </td>
                </tr>
              ) : (
                capas.map((c) => {
                  const overdue = isOverdue(c);
                  return (
                    <tr key={c._id}>
                      <td style={overdue ? { boxShadow: 'inset 4px 0 0 #DC2626' } : undefined}>
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-[#FFF5F5] border border-[#FBD5D5] font-mono font-bold text-[#8B1E23] text-xs whitespace-nowrap">
                          {c.capaNumber}
                        </span>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11.5px] font-semibold ${
                              c.type === 'CORRECTIVE' ? 'bg-orange-50 text-orange-700' : 'bg-sky-50 text-sky-700'
                            }`}
                          >
                            {c.type === 'CORRECTIVE' ? 'Corrective' : 'Preventive'}
                          </span>
                          <span className="text-[11.5px] font-semibold text-slate-500 uppercase">{c.priority}</span>
                        </div>
                      </td>
                      <td className="font-semibold text-slate-900 max-w-md">{c.action}</td>
                      <td>
                        <div className="font-mono font-semibold text-slate-700 whitespace-nowrap">{c.incidentId?.incidentNumber}</div>
                        <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">{c.incidentId?.title}</div>
                      </td>
                      <td>
                        <div className="font-semibold text-slate-900">{c.ownerDepartmentId?.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{c.ownerUserId?.name}</div>
                      </td>
                      <td className="whitespace-nowrap">
                        <div className={`font-semibold ${overdue ? 'text-red-700' : 'text-slate-800'}`}>
                          {dayjs(c.targetDate).format('DD MMM YYYY')}
                        </div>
                        {overdue && (
                          <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-[11.5px] font-bold text-red-700">
                            Overdue {dayjs().diff(dayjs(c.targetDate), 'day')}d
                          </span>
                        )}
                      </td>
                      <td>
                        <CapaStatusBadge status={c.status} />
                      </td>
                      <td className="text-right">
                        {c.incidentId?._id && (
                          <Link
                            to={`/incidents/${c.incidentId._id}`}
                            className="inline-flex items-center gap-1.5 h-9 px-3.5 bg-white hover:bg-gradient-to-b hover:from-[#C62828] hover:to-[#8B1E23] text-slate-700 hover:text-white rounded-xl font-semibold text-[13px] transition border border-slate-200 hover:border-transparent shadow-xs"
                          >
                            <span>Incident</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
