import { Lock } from 'lucide-react';
import { CAPA_STATUS_META, SEVERITY_COLOR, SEVERITY_META, statusMeta } from '../../lib/incidentMeta';

export function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta(status);
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${meta.classes}`}
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
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border whitespace-nowrap ${meta.classes}`}
      title={provisional ? 'Severity entered by the reporter; Quality confirms it at assignment' : meta.label}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: severity === 5 ? '#FFFFFF' : SEVERITY_COLOR[severity] }} />
      {meta.short}
      {provisional && <span className="font-medium opacity-70">(reported)</span>}
    </span>
  );
}

export function CapaStatusBadge({ status }: { status: string }) {
  const meta = CAPA_STATUS_META[status] ?? { label: status, classes: 'bg-slate-100 text-slate-600 border-slate-200' };
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${meta.classes}`}>
      {meta.label}
    </span>
  );
}

/**
 * Shown in place of the reporter's name to everyone except Quality, Admin and Super Admin
 * (the API sends `reporterHidden: true` and no reporter details).
 */
export function ConfidentialReporter() {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border border-slate-200 bg-slate-50 text-slate-600 whitespace-nowrap"
      title="The reporter's identity is visible only to Quality and Admin"
    >
      <Lock className="w-3 h-3" /> Confidential
    </span>
  );
}
