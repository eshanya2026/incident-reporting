import { CAPA_STATUS_META, SEVERITY_META, statusMeta } from '../../lib/incidentMeta';

export function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta(status);
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider whitespace-nowrap ${meta.classes}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

export function SeverityBadge({ severity, provisional }: { severity: number; provisional?: boolean }) {
  const meta = SEVERITY_META[severity];
  if (!meta) return <span className="text-xs text-clinicalText-muted">—</span>;
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[11px] border whitespace-nowrap ${meta.classes}`}
      title={provisional ? 'Severity entered by the reporter; Quality confirms it at assignment' : meta.label}
    >
      {meta.short}
      {provisional && ' (reported)'}
    </span>
  );
}

export function CapaStatusBadge({ status }: { status: string }) {
  const meta = CAPA_STATUS_META[status] ?? { label: status, classes: 'bg-slate-100 text-slate-600 border-slate-200' };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase whitespace-nowrap ${meta.classes}`}>
      {meta.label}
    </span>
  );
}
