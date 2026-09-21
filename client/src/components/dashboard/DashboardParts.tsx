import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Table2, BarChart3 } from 'lucide-react';
import { CHART, STATUS } from './chartTheme';

/** Headline number with a sentence-case label and an optional note (e.g. "oldest waiting 3 days"). */
export function StatTile({
  label,
  value,
  note,
  to,
  status,
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  /** Makes the tile a link to the matching work queue. */
  to?: string;
  /** Status meaning; always shown with an icon and text, never colour alone. */
  status?: 'critical' | 'good';
}) {
  const body = (
    <div
      className={`h-full bg-white border rounded-xl p-4 shadow-card transition ${
        to ? 'hover:border-[#8B1E23]/40 hover:shadow-md cursor-pointer' : ''
      } ${status === 'critical' ? 'border-[#d03b3b]/40' : 'border-clinicalBorder'}`}
    >
      <div className="text-xs font-medium text-clinicalText-secondary">{label}</div>
      <div className="text-3xl font-semibold text-clinicalText-primary mt-1 leading-tight">{value}</div>
      {status && (
        <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-clinicalText-primary">
          {status === 'critical' ? (
            <AlertTriangle className="w-3.5 h-3.5" style={{ color: STATUS.critical }} />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5" style={{ color: STATUS.good }} />
          )}
          {status === 'critical' ? 'Needs attention' : 'On track'}
        </div>
      )}
      {note && <div className="text-[11px] text-clinicalText-muted mt-1">{note}</div>}
    </div>
  );
  return to ? (
    <Link to={to} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

/** Card that holds one chart, with a switch to an equivalent data table. */
export function ChartCard({
  title,
  subtitle,
  table,
  empty,
  children,
}: {
  title: string;
  subtitle?: string;
  table: { columns: string[]; rows: Array<Array<React.ReactNode>> };
  /** Shown instead of the chart when there is no data. */
  empty?: boolean;
  children: React.ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className="bg-white border border-clinicalBorder rounded-2xl shadow-card p-5 flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-bold text-clinicalText-primary">{title}</h3>
          {subtitle && <p className="text-[11px] text-clinicalText-secondary mt-0.5">{subtitle}</p>}
        </div>
        {!empty && (
          <button
            type="button"
            onClick={() => setAsTable(!asTable)}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-clinicalText-secondary hover:text-[#8B1E23] border border-clinicalBorder rounded-lg cursor-pointer"
            aria-pressed={asTable}
          >
            {asTable ? <BarChart3 className="w-3.5 h-3.5" /> : <Table2 className="w-3.5 h-3.5" />}
            {asTable ? 'Chart' : 'Table'}
          </button>
        )}
      </div>
      {empty ? (
        <div className="flex-1 flex items-center justify-center py-12 text-xs text-clinicalText-muted">No incidents in this period.</div>
      ) : asTable ? (
        <div className="overflow-auto max-h-80">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-clinicalText-secondary border-b border-clinicalBorder">
                {table.columns.map((c, i) => (
                  <th key={c} className={`py-2 px-2 font-semibold ${i > 0 ? 'text-right' : ''}`}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {table.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, i) => (
                    <td key={i} className={`py-1.5 px-2 ${i > 0 ? 'text-right tabular-nums' : 'text-clinicalText-primary'}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

/** Tooltip body: value first (strong), label second; line key in the series colour. */
export function ChartTooltip({ active, payload, label, labelFormatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-clinicalBorder rounded-lg shadow-lg px-3 py-2 text-xs">
      <div className="text-clinicalText-muted mb-1">{labelFormatter ? labelFormatter(label) : label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey ?? p.name} className="flex items-center gap-2">
          <span className="inline-block w-3 h-0.5 rounded" style={{ background: p.payload?.fill ?? p.color }} />
          <span className="font-semibold text-clinicalText-primary tabular-nums">{p.value}</span>
          <span className="text-clinicalText-secondary">{p.name}</span>
        </div>
      ))}
    </div>
  );
}

export const axisProps = {
  tick: { fill: CHART.axisText, fontSize: CHART.font },
  axisLine: { stroke: CHART.grid },
  tickLine: false,
};
