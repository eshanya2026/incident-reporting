import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Loader2, TrendingUp, Zap } from 'lucide-react';
import { api } from '../../lib/api';
import { SearchableSelect } from '../ui/SearchableSelect';
import { departmentOptions } from '../ui/DepartmentOptions';
import { EmptyState, FilterChips, filterControlClass } from '../ui/listKit';

/**
 * Monthly incident counts by category / department / severity, with the latest month and the
 * last complete month flagged when they spike or keep rising. Pick up to 5 rows to chart.
 */

// Validated categorical palette (dataviz reference instance), assigned in fixed order. A series keeps
// its colour while it stays selected; colour never follows rank.
const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'];
const MAX_LINES = SERIES_COLORS.length;

type By = 'category' | 'department' | 'severity';

function FlagBadge({ flag, when }: { flag: 'SPIKE' | 'RISING' | null; when: string }) {
  if (!flag) return null;
  const spike = flag === 'SPIKE';
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${
        spike ? 'bg-red-50 text-red-800 border-red-200' : 'bg-amber-50 text-amber-800 border-amber-200'
      }`}
      title={spike ? 'Well above its usual monthly level' : 'Up three months in a row'}
    >
      {spike ? <Zap className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
      {spike ? 'Spike' : 'Rising'} · {when}
    </span>
  );
}

export default function TrendsTab({ isHospitalWide, departments }: { isHospitalWide: boolean; departments: any[] }) {
  const [by, setBy] = useState<By>('category');
  const [months, setMonths] = useState(12);
  const [departmentId, setDepartmentId] = useState('');
  // id -> colour slot, so a series keeps its colour while others are added / removed
  const [selected, setSelected] = useState<Record<string, number>>({});

  const params = { by, months, ...(departmentId ? { departmentId } : {}) };
  const q = useQuery({
    queryKey: ['report-trends', params],
    queryFn: () => api.get('/reports/trends', { params }),
  });
  const d: any = (q.data as any)?.data;
  const series: any[] = d?.series || [];
  const monthList: Array<{ key: string; label: string }> = d?.months || [];

  // Default selection: flagged first, then the biggest, up to 5
  useEffect(() => {
    if (!d) return;
    const ids = series.slice(0, MAX_LINES).map((s) => s.id);
    setSelected(Object.fromEntries(ids.map((id, i) => [id, i])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d]);

  const toggle = (id: string) =>
    setSelected((cur) => {
      if (id in cur) {
        const next = { ...cur };
        delete next[id];
        return next;
      }
      const used = new Set(Object.values(cur));
      const slot = [...Array(MAX_LINES).keys()].find((s) => !used.has(s));
      return slot === undefined ? cur : { ...cur, [id]: slot };
    });

  const chartSeries = series.filter((s) => s.id in selected);
  const chartData = useMemo(
    () =>
      monthList.map((m, i) => {
        const point: Record<string, any> = {
          month: m.label + (i === monthList.length - 1 ? ' (so far)' : ''),
        };
        for (const s of chartSeries) point[s.id] = s.counts[i];
        return point;
      }),
    [monthList, chartSeries],
  );

  const maxCell = Math.max(1, ...series.flatMap((s) => s.counts));
  // Sequential single-hue shading for the table cells (light -> dark blue); text stays ink
  const cellBg = (n: number) => (n === 0 ? undefined : `rgba(42, 120, 214, ${0.08 + (n / maxCell) * 0.42})`);
  const flagged = series.filter((s) => s.flag || s.previousFlag);
  const lastLabel = monthList[monthList.length - 1]?.label ?? '';
  const prevLabel = monthList[monthList.length - 2]?.label ?? '';

  return (
    <div className="space-y-5 animate-tab-panel-in">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-4 flex flex-col lg:flex-row lg:items-end gap-3">
        <div>
          <span className="block text-xs font-semibold text-slate-600 mb-1.5">Group by</span>
          <FilterChips
            value={by}
            onChange={(k) => setBy(k as By)}
            options={[
              { key: 'category', label: 'Category' },
              { key: 'department', label: 'Department' },
              { key: 'severity', label: 'Severity' },
            ]}
          />
        </div>
        <div>
          <span className="block text-xs font-semibold text-slate-600 mb-1.5">Period</span>
          <FilterChips
            value={String(months)}
            onChange={(k) => setMonths(Number(k))}
            options={[
              { key: '6', label: '6 months' },
              { key: '12', label: '12 months' },
              { key: '24', label: '24 months' },
            ]}
          />
        </div>
        {isHospitalWide && by !== 'department' && (
          <div className="lg:w-72">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Department</label>
            <SearchableSelect
              containerClassName="block w-full"
              value={departmentId}
              onChange={setDepartmentId}
              options={[
                { value: '', label: 'Whole hospital' },
                ...departmentOptions(departments, undefined, {
                  includeInactive: true,
                }),
              ]}
              searchPlaceholder="Search departments..."
              className={filterControlClass}
            />
          </div>
        )}
      </div>

      {q.isLoading ? (
        <div className="py-20 flex justify-center text-slate-400">
          <Loader2 className="w-7 h-7 animate-spin" />
        </div>
      ) : q.isError ? (
        <EmptyState message={(q.error as any)?.response?.data?.error?.message || 'Could not load trends.'} />
      ) : series.length === 0 ? (
        <EmptyState message="No incidents reported in this period." />
      ) : (
        <>
          {flagged.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3">
              <p className="text-sm font-bold text-amber-900 flex items-center gap-2">
                <Zap className="w-4 h-4" /> Needs a look
              </p>
              <ul className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-slate-700">
                {flagged.map((s) => (
                  <li key={s.id} className="flex items-center gap-2">
                    <span className="font-semibold">{s.name}</span>
                    <FlagBadge flag={s.previousFlag} when={prevLabel} />
                    <FlagBadge flag={s.flag} when={`${lastLabel} so far`} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <section className="bg-white rounded-2xl border border-slate-200 shadow-card p-4">
            <div className="flex items-center justify-between mb-3 gap-3">
              <h3 className="text-sm font-bold text-slate-800">Incidents per month</h3>
              <span className="text-xs text-slate-400">Tick up to {MAX_LINES} rows below to compare</span>
            </div>
            {chartSeries.length === 0 ? (
              <p className="h-64 flex items-center justify-center text-sm text-slate-400">Tick rows in the table to chart them.</p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#EEF2F6" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={{ stroke: '#E2E8F0' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ stroke: '#94A3B8', strokeDasharray: '3 3' }}
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid #E2E8F0',
                        fontSize: 12,
                      }}
                      itemStyle={{ color: '#172033' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
                    {chartSeries.map((s) => (
                      <Line
                        key={s.id}
                        dataKey={s.id}
                        name={s.name}
                        stroke={SERIES_COLORS[selected[s.id]]}
                        strokeWidth={2}
                        dot={{
                          r: 3,
                          strokeWidth: 2,
                          stroke: '#fff',
                          fill: SERIES_COLORS[selected[s.id]],
                        }}
                        activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th className="w-8"></th>
                    <th className="text-left min-w-[200px]">{by === 'category' ? 'Category' : by === 'department' ? 'Department' : 'Severity'}</th>
                    {monthList.map((m, i) => (
                      <th key={m.key} className="text-right whitespace-nowrap">
                        {m.label.replace(/ \d{2}(\d{2})$/, " '$1")}
                        {i === monthList.length - 1 && <span className="block text-[10px] font-normal text-slate-400">so far</span>}
                      </th>
                    ))}
                    <th className="text-right">Total</th>
                    <th className="text-left">Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {series.map((s) => {
                    const on = s.id in selected;
                    const full = !on && Object.keys(selected).length >= MAX_LINES;
                    return (
                      <tr key={s.id}>
                        <td>
                          <label
                            className="flex items-center justify-center cursor-pointer"
                            title={full ? `Up to ${MAX_LINES} at a time` : 'Show on chart'}
                          >
                            <input type="checkbox" checked={on} disabled={full} onChange={() => toggle(s.id)} className="sr-only peer" />
                            <span
                              className="w-4 h-4 rounded border-2 peer-disabled:opacity-30 peer-focus-visible:ring-2 peer-focus-visible:ring-[#5C1A22]/30"
                              style={
                                on
                                  ? {
                                      background: SERIES_COLORS[selected[s.id]],
                                      borderColor: SERIES_COLORS[selected[s.id]],
                                    }
                                  : { borderColor: '#CBD5E1' }
                              }
                            />
                          </label>
                        </td>
                        <td className="text-slate-800 font-medium">{s.name}</td>
                        {s.counts.map((n: number, i: number) => (
                          <td
                            key={i}
                            className="text-right tabular-nums text-slate-900"
                            style={{ background: cellBg(n) }}
                            title={`${monthList[i]?.label}: ${n}`}
                          >
                            {n || <span className="text-slate-300">0</span>}
                          </td>
                        ))}
                        <td className="text-right font-bold tabular-nums">{s.total}</td>
                        <td>
                          <div className="flex flex-col gap-1 items-start">
                            <FlagBadge flag={s.previousFlag} when={prevLabel} />
                            <FlagBadge flag={s.flag} when="this month" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50">
                    <td></td>
                    <td className="font-bold text-slate-700">All</td>
                    {(d.totals as number[]).map((n, i) => (
                      <td key={i} className="text-right font-bold tabular-nums">
                        {n}
                      </td>
                    ))}
                    <td className="text-right font-bold tabular-nums">{(d.totals as number[]).reduce((a, b) => a + b, 0)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <p className="text-xs text-slate-400">
            Spike: at least 3 and well above the usual level (more than the average + 2 standard deviations of the 6 months before, and at least 1.5×
            that average). Rising: up three months in a row, ending at 3 or more. The current month is still running. Rejected reports are not
            counted.
          </p>
        </>
      )}
    </div>
  );
}
