import dayjs from 'dayjs';
import { History } from 'lucide-react';
import { Card } from '../ui/primitives';
import { statusMeta } from '../../lib/incidentMeta';

// Plain-language labels for the audit actions returned by GET /incidents/:id/timeline
const ACTION_LABELS: Record<string, string> = {
  SUBMITTED: 'Reported',
  REQUEST_INFO: 'Quality asked for more information',
  RESPOND_INFO: 'Reporter answered',
  REJECT: 'Rejected by Quality',
  ASSIGN: 'Assigned to department HOD',
  RETURN_TO_QUALITY: 'HOD returned it to Quality',
  START_INVESTIGATION: 'Investigation started',
  COMPLETE_INVESTIGATION: 'Investigation completed; CAPA stage',
  SUBMIT_CLOSURE: 'Submitted for Quality review',
  REVIEW_RETURN: 'Quality sent it back to the HOD',
  REVIEW_ACCEPT: 'Closed by Quality',
};

export default function Timeline({ entries }: { entries: any[] }) {
  return (
    <Card title="Timeline" icon={History}>
      {entries.length === 0 ? (
        <p className="text-xs text-clinicalText-muted">No history yet.</p>
      ) : (
        <ol className="relative border-l-2 border-slate-200 ml-2 space-y-4">
          {entries.map((e, i) => (
            <li key={i} className="ml-4">
              <span className={`absolute -left-[7px] mt-1 w-3 h-3 rounded-full border-2 border-white ${statusMeta(e.toStatus).dot}`} />
              <div className="text-xs font-semibold text-clinicalText-primary">{ACTION_LABELS[e.action] ?? e.label}</div>
              <div className="text-[12.5px] text-clinicalText-muted">
                {dayjs(e.at).format('DD MMM YYYY HH:mm')}
                {e.by?.name && ` · ${e.by.name}`}
              </div>
              {e.text && <div className="mt-1 text-xs text-clinicalText-secondary bg-slate-50 border border-slate-100 rounded-lg p-2 whitespace-pre-wrap">{e.text}</div>}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
