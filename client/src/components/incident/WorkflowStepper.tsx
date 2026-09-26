import { Check, XCircle } from 'lucide-react';
import { WORKFLOW_STEPS } from '../../lib/incidentMeta';

/** Progress indicator across the main workflow steps. */
export default function WorkflowStepper({ status }: { status: string }) {
  if (status === 'REJECTED') {
    return (
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
        <XCircle className="w-4 h-4 text-slate-500" /> Rejected by Quality — no further action
      </div>
    );
  }

  const current = WORKFLOW_STEPS.findIndex((s) => s.statuses.includes(status as any));
  return (
    <ol className="flex items-center w-full bg-white border border-clinicalBorder rounded-xl px-4 py-3 shadow-card overflow-x-auto">
      {WORKFLOW_STEPS.map((step, i) => {
        const done = i < current || status === 'CLOSED';
        const active = i === current && status !== 'CLOSED';
        return (
          <li key={step.key} className="flex items-center flex-1 min-w-[110px] last:flex-none">
            <div className="flex items-center gap-2">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[12.5px] font-bold shrink-0 ${
                  done
                    ? 'bg-emerald-600 text-white'
                    : active
                    ? 'bg-[#8B1E23] text-white ring-4 ring-[#8B1E23]/15'
                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                }`}
              >
                {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </span>
              <span className={`text-[12.5px] whitespace-nowrap ${active ? 'font-bold text-[#8B1E23]' : done ? 'font-semibold text-clinicalText-primary' : 'text-clinicalText-muted'}`}>
                {step.label}
              </span>
            </div>
            {i < WORKFLOW_STEPS.length - 1 && <span className={`flex-1 h-0.5 mx-3 ${done ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
          </li>
        );
      })}
    </ol>
  );
}
