import React from 'react';
import { Link } from 'react-router-dom';
import { Eye } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { SeverityBadge, StatusBadge } from './Badges';

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
  const cell = (inc: any, column: IncidentColumn): React.ReactNode => {
    switch (column) {
      case 'number':
        return <span className="font-mono font-bold text-maroon-700 whitespace-nowrap">{inc.incidentNumber}</span>;
      case 'occurred':
        return <span className="text-clinicalText-secondary whitespace-nowrap">{dayjs(inc.incidentDateTime).format('DD MMM YYYY HH:mm')}</span>;
      case 'reported':
        return <span className="text-clinicalText-secondary whitespace-nowrap">{dayjs(inc.reportedAt).format('DD MMM YYYY HH:mm')}</span>;
      case 'title': {
        const flag = highlight?.(inc);
        return (
          <div>
            <div className="font-semibold text-clinicalText-primary line-clamp-1">{inc.title}</div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {flag && (
                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold border border-amber-300">{flag}</span>
              )}
              {inc.categoryId?.name && (
                <span className="px-1.5 py-0.5 rounded bg-red-50 text-[#8B1E23] text-[10px] font-semibold border border-red-100">
                  {inc.categoryId.name}
                </span>
              )}
              {inc.patientInvolved && (
                <span className="text-[11px] text-clinicalText-secondary font-mono">
                  Patient: {inc.patient?.name || 'Involved'} {inc.patient?.uhid ? `(${inc.patient.uhid})` : ''}
                </span>
              )}
            </div>
          </div>
        );
      }
      case 'occurredIn':
        return (
          <div>
            <span className="text-clinicalText-primary font-medium">{inc.occurredInDepartmentId?.name || '—'}</span>
            {(inc.floor || inc.zone || inc.locationId?.floor || inc.locationId?.name) && (
              <div className="text-[11px] text-clinicalText-muted flex items-center gap-1 mt-0.5">
                <span>
                  {inc.floor || inc.locationId?.floor || ''}
                  {(inc.floor || inc.locationId?.floor) && (inc.zone || inc.locationId?.zone) ? ' • ' : ''}
                  {inc.zone || inc.locationId?.zone || ''}
                  {inc.locationId?.name && !inc.locationId.code?.startsWith('FL') ? ` (${inc.locationId.name})` : ''}
                </span>
              </div>
            )}
          </div>
        );
      case 'responsible':
        return inc.departmentId ? (
          <div>
            <div className="font-medium text-clinicalText-primary">{inc.departmentId.name}</div>
            {inc.assignedHod?.name && <div className="text-[11px] text-clinicalText-muted">{inc.assignedHod.name}</div>}
          </div>
        ) : (
          <span className="text-clinicalText-muted">Not assigned</span>
        );
      case 'reporter':
        return <span className="text-clinicalText-primary">{inc.reportedBy?.name || '—'}</span>;
      case 'severity':
        return <SeverityBadge severity={inc.severity} provisional={['SUBMITTED', 'INFO_REQUESTED', 'REJECTED'].includes(inc.status)} />;
      case 'reportedSeverity':
        return <SeverityBadge severity={inc.initialSeverity ?? inc.severity} provisional />;
      case 'status':
        return <StatusBadge status={inc.status} />;
      case 'waiting': {
        const since = waitingSince?.(inc);
        return since ? (
          <span className="text-clinicalText-secondary whitespace-nowrap" title={dayjs(since).format('DD MMM YYYY HH:mm')}>
            {dayjs(since).fromNow()}
          </span>
        ) : (
          '—'
        );
      }
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-clinicalBorder shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-clinicalBorder text-[11px] font-bold uppercase tracking-wider text-clinicalText-secondary">
              {columns.map((c) => (
                <th key={c} className="py-3 px-4">
                  {HEADERS[c]}
                </th>
              ))}
              <th className="py-3 px-4 text-right">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {loading ? (
              <tr>
                <td colSpan={columns.length + 1} className="py-8 text-center text-clinicalText-secondary">
                  Loading…
                </td>
              </tr>
            ) : incidents.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="py-8 text-center text-clinicalText-secondary">
                  {empty}
                </td>
              </tr>
            ) : (
              incidents.map((inc) => (
                <tr key={inc._id} className={`hover:bg-slate-50/80 transition ${highlight?.(inc) ? 'bg-amber-50/40' : ''}`}>
                  {columns.map((c) => (
                    <td key={c} className="py-3 px-4 align-top">
                      {cell(inc, c)}
                    </td>
                  ))}
                  <td className="py-3 px-4 text-right align-top">
                    <Link
                      to={`/incidents/${inc._id}`}
                      className="inline-flex items-center space-x-1.5 px-3 py-1 bg-white hover:bg-[#FFF5F5] text-clinicalText-primary hover:text-[#8B1E23] rounded-md font-semibold text-xs transition border border-clinicalBorder shadow-xs"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#8B1E23]" />
                      <span>Open</span>
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
