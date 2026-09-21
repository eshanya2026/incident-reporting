import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { CheckSquare, Eye } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { hasPermission } from '../lib/rbac';
import { CAPA_STATUS_META } from '../lib/incidentMeta';
import { PageHeader } from '../components/ui/primitives';
import { CapaStatusBadge } from '../components/incident/Badges';

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'OPEN', label: CAPA_STATUS_META.OPEN.label },
  { key: 'overdue', label: 'Overdue' },
  { key: 'DONE', label: CAPA_STATUS_META.DONE.label },
  { key: 'EFFECTIVE', label: CAPA_STATUS_META.EFFECTIVE.label },
];

/**
 * CAPA register. HODs see their department's actions and complete them from the incident page;
 * Quality and Admin see all actions (Quality judges effectiveness during the incident review).
 */
export default function CapaManagerPage() {
  const user = useAuthStore((state) => state.user);
  const isHod = hasPermission(user, 'capa.write');
  const [filter, setFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['all-capas', filter],
    queryFn: () => api.get('/capas', { params: { status: filter === 'overdue' ? 'OPEN' : filter || undefined, limit: 200 } }),
  });
  const all: any[] = (data as any)?.data || [];
  const isOverdue = (c: any) => c.status === 'OPEN' && dayjs().isAfter(dayjs(c.targetDate), 'day');
  const capas = filter === 'overdue' ? all.filter(isOverdue) : all;

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

      <div className="bg-white rounded-2xl border border-clinicalBorder shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-clinicalBorder text-[11px] font-bold uppercase tracking-wider text-clinicalText-secondary">
                <th className="py-3 px-4">CAPA</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Incident</th>
                <th className="py-3 px-4">Department / Owner</th>
                <th className="py-3 px-4">Target</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-clinicalText-secondary">Loading…</td>
                </tr>
              ) : capas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-clinicalText-secondary">No CAPA actions found.</td>
                </tr>
              ) : (
                capas.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-50/80 transition align-top">
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-maroon-700 whitespace-nowrap">{c.capaNumber}</div>
                      <div className="text-[10px] text-clinicalText-muted uppercase">{c.type === 'CORRECTIVE' ? 'Corrective' : 'Preventive'} · {c.priority}</div>
                    </td>
                    <td className="py-3 px-4 font-medium text-clinicalText-primary max-w-md">{c.action}</td>
                    <td className="py-3 px-4">
                      <div className="font-mono text-clinicalText-secondary whitespace-nowrap">{c.incidentId?.incidentNumber}</div>
                      <div className="text-[11px] text-clinicalText-muted line-clamp-1">{c.incidentId?.title}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-clinicalText-primary">{c.ownerDepartmentId?.name}</div>
                      <div className="text-[11px] text-clinicalText-muted">{c.ownerUserId?.name}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={isOverdue(c) ? 'font-bold text-red-700' : 'text-clinicalText-secondary'}>
                        {dayjs(c.targetDate).format('DD MMM YYYY')}
                      </span>
                      {isOverdue(c) && <div className="text-[10px] font-bold text-red-700 uppercase">Overdue</div>}
                    </td>
                    <td className="py-3 px-4">
                      <CapaStatusBadge status={c.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      {c.incidentId?._id && (
                        <Link
                          to={`/incidents/${c.incidentId._id}`}
                          className="inline-flex items-center space-x-1.5 px-3 py-1 bg-white hover:bg-[#FFF5F5] text-clinicalText-primary hover:text-[#8B1E23] rounded-md font-semibold text-xs transition border border-clinicalBorder shadow-xs"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#8B1E23]" />
                          <span>Incident</span>
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
