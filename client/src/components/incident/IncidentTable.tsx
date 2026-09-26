import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, MapPin, Clock, FileSearch } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { SeverityBadge, StatusBadge } from './Badges';
import { SEVERITY_COLOR } from '../../lib/incidentMeta';
import { EmptyState, TableSkeleton } from '../ui/listKit';

dayjs.extend(relativeTime);

export type IncidentColumn =
  | 'number'
  | 'occurred'
  | 'reported'
  | 'title'
  | 'occurredIn'
  | 'responsible'
  | 'reporter'
  | 'severity'
  | 'reportedSeverity'
  | 'status'
  | 'waiting';

const HEADERS: Record<IncidentColumn, string> = {
  number: 'Incident No',
  occurred: 'Occurred',
  reported: 'Reported',
  title: 'Title & Category',
  occurredIn: 'Where it occurred',
  responsible: 'Responsible Dept / HOD',
  reporter: 'Reported by',
  severity: 'Severity',
  reportedSeverity: 'Reported severity',
  status: 'Status',
  waiting: 'Waiting since',
};

const initials = (name?: string) =>
  (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

/** Date on one line, time underneath. */
const DateCell = ({ value }: { value: string }) => (
  <div className="whitespace-nowrap">
    <div className="font-semibold text-slate-800">{dayjs(value).format('DD MMM YYYY')}</div>
    <div className="text-xs text-slate-500 mt-0.5">{dayjs(value).format('HH:mm')}</div>
  </div>
);

/** Shared incident list used by the register and all work queues. */
export default function IncidentTable({
  incidents,
  columns,
  loading,
  empty = 'No incidents found.',
  waitingSince,
  highlight,
}: {
  incidents: any[];
  columns: IncidentColumn[];
  loading?: boolean;
  empty?: string;
  /** Date shown in the "Waiting since" column. */
  waitingSince?: (incident: any) => string | undefined;
  /** Returns a short label to flag a row (e.g. "Action needed"). */
  highlight?: (incident: any) => string | undefined;
}) {
  const navigate = useNavigate();

  const cell = (inc: any, column: IncidentColumn): React.ReactNode => {
    switch (column) {
      case 'number':
        return (
          <span className="inline-block px-2.5 py-1 rounded-lg bg-[#FFF5F5] border border-[#FBD5D5] font-mono font-bold text-[#8B1E23] text-xs whitespace-nowrap">
            {inc.incidentNumber}
          </span>
        );
      case 'occurred':
        return <DateCell value={inc.incidentDateTime} />;
      case 'reported':
        return <DateCell value={inc.reportedAt} />;
      case 'title': {
        const flag = highlight?.(inc);
        return (
          <div className="min-w-[14rem] max-w-md">
            <div className="font-bold text-slate-900 text-sm leading-snug line-clamp-2">{inc.title}</div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {flag && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11.5px] font-bold border border-amber-300">
                  {flag}
                </span>
              )}
              {inc.categoryId?.name && (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11.5px] font-semibold">
                  {inc.categoryId.name}
                </span>
              )}
              {inc.patientInvolved && (
                <span className="text-xs text-slate-500">
                  Patient: {inc.patient?.name || 'Involved'} {inc.patient?.uhid ? `(${inc.patient.uhid})` : ''}
                </span>
              )}
            </div>
          </div>
        );
      }
      case 'occurredIn': {
        const floor = inc.floor || inc.locationId?.floor || '';
        const zone = inc.zone || inc.locationId?.zone || '';
        const room = inc.locationId?.name && !inc.locationId.code?.startsWith('FL') ? ` (${inc.locationId.name})` : '';
        return (
          <div>
            <div className="text-slate-900 font-semibold">{inc.occurredInDepartmentId?.name || '—'}</div>
            {(floor || zone || room) && (
              <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 shrink-0 text-[#C62828]" />
                <span>
                  {floor}
                  {floor && zone ? ' • ' : ''}
                  {zone}
                  {room}
                </span>
              </div>
            )}
          </div>
        );
      }
      case 'responsible':
        return inc.departmentId ? (
          <div>
            <div className="font-semibold text-slate-900">{inc.departmentId.name}</div>
            {inc.assignedHod?.name && <div className="text-xs text-slate-500 mt-0.5">{inc.assignedHod.name}</div>}
          </div>
        ) : (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Not assigned</span>
        );
      case 'reporter':
        return (
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-full bg-gradient-to-br from-[#8B1E23] to-[#E53935] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
              {initials(inc.reportedBy?.name)}
            </span>
            <span className="font-medium text-slate-800">{inc.reportedBy?.name || '—'}</span>
          </div>
        );
      case 'severity':
        return <SeverityBadge severity={inc.severity} provisional={['SUBMITTED', 'INFO_REQUESTED', 'REJECTED'].includes(inc.status)} />;
      case 'reportedSeverity':
        return <SeverityBadge severity={inc.initialSeverity ?? inc.severity} provisional />;
      case 'status':
        return <StatusBadge status={inc.status} />;
      case 'waiting': {
        const since = waitingSince?.(inc);
        if (!since) return '—';
        const days = dayjs().diff(dayjs(since), 'day');
        const tone = days >= 7 ? 'text-red-700 bg-red-50 border-red-200' : days >= 2 ? 'text-amber-800 bg-amber-50 border-amber-200' : 'text-slate-600 bg-slate-50 border-slate-200';
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold whitespace-nowrap ${tone}`}
            title={dayjs(since).format('DD MMM YYYY HH:mm')}
          >
            <Clock className="w-3 h-3" />
            {dayjs(since).fromNow()}
          </span>
        );
      }
    }
  };

  const colSpan = columns.length + 1;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c}>{HEADERS[c]}</th>
              ))}
              <th className="text-right">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton columns={colSpan} />
            ) : incidents.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="!p-0">
                  <EmptyState icon={FileSearch} message={empty} />
                </td>
              </tr>
            ) : (
              incidents.map((inc) => {
                const flagged = Boolean(highlight?.(inc));
                const stripe = SEVERITY_COLOR[inc.severity] ?? '#CBD5E1';
                return (
                  <tr
                    key={inc._id}
                    onClick={() => navigate(`/incidents/${inc._id}`)}
                    className="cursor-pointer group"
                  >
                    {columns.map((c, i) => (
                      <td
                        key={c}
                        className={flagged ? '!bg-amber-50/50' : undefined}
                        style={i === 0 ? { boxShadow: `inset 4px 0 0 ${stripe}` } : undefined}
                      >
                        {cell(inc, c)}
                      </td>
                    ))}
                    <td className={`text-right ${flagged ? '!bg-amber-50/50' : ''}`}>
                      <Link
                        to={`/incidents/${inc._id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 h-9 px-3.5 bg-white group-hover:bg-gradient-to-b group-hover:from-[#C62828] group-hover:to-[#8B1E23] text-slate-700 group-hover:text-white rounded-xl font-semibold text-[13px] transition border border-slate-200 group-hover:border-transparent shadow-xs"
                      >
                        <span>Open</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
