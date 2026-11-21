import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  FileDown,
  FileText,
  Loader2,
  Minus,
  ShieldAlert,
  Repeat,
} from 'lucide-react';
import { api } from '../../lib/api';
import { toast } from '../../store/useToastStore';
import { showInViewer } from '../ui/FileViewer';
import { SearchableSelect } from '../ui/SearchableSelect';
import { departmentOptions } from '../ui/DepartmentOptions';
import { EmptyState, StatTile, filterControlClass } from '../ui/listKit';
import { SeverityBadge, StatusBadge } from '../incident/Badges';

/**
 * Quality committee's monthly pack: key indicators vs last month and the 3 months before,
 * serious events, incident types, departments, repeats and what is past its closure target.
 * The same report downloads as a PDF for the committee file.
 */

type Better = 'up' | 'down' | null; // which direction is an improvement

const INDICATORS: Array<{
  key: string;
  label: string;
  unit?: string;
  better: Better;
  hint?: string;
}> = [
  {
    key: 'reported',
    label: 'Incidents reported',
    better: null,
    hint: 'More reporting is usually a sign of a healthy safety culture',
  },
  {
    key: 'reportingRate',
    label: 'Reporting rate per 1,000 patient days',
    better: null,
  },
  { key: 'nearMiss', label: 'Near misses', better: null },
  {
    key: 'nearMissRatio',
    label: 'Near-miss ratio',
    unit: '%',
    better: 'up',
    hint: 'Near misses / incidents reported',
  },
  {
    key: 'harm',
    label: 'Harm events (adverse, permanent harm, sentinel)',
    better: 'down',
  },
  {
    key: 'serious',
    label: 'Serious events (permanent harm, sentinel)',
    better: 'down',
  },
  { key: 'sentinel', label: 'Sentinel events', better: 'down' },
  { key: 'patientInvolved', label: 'Patient involved', better: null },
  {
    key: 'rejected',
    label: 'Rejected (not an incident / duplicate)',
    better: null,
  },
  {
    key: 'medianDaysToAssign',
    label: 'Median days from report to assignment',
    unit: ' d',
    better: 'down',
  },
  { key: 'closed', label: 'Incidents closed', better: null },
  {
    key: 'closedOnTimeRate',
    label: 'Closed within target time',
    unit: '%',
    better: 'up',
    hint: 'Targets: severity 1: 30 days, 2: 21, 3: 14, 4: 10, 5: 7',
  },
  {
    key: 'medianDaysToClose',
    label: 'Median days from report to closure',
    unit: ' d',
    better: 'down',
  },
  { key: 'openAtEnd', label: 'Open at month end', better: 'down' },
  {
    key: 'overdueAtEnd',
    label: 'Open past target at month end',
    better: 'down',
  },
  { key: 'capaRaised', label: 'CAPAs raised', better: null },
  { key: 'capaDue', label: 'CAPAs due this month', better: null },
  {
    key: 'capaOnTimeRate',
    label: 'CAPAs completed by target date',
    unit: '%',
    better: 'up',
  },
  {
    key: 'capaOverdueAtEnd',
    label: 'CAPAs overdue at month end',
    better: 'down',
  },
  {
    key: 'capaEffectiveRate',
    label: 'CAPAs verified effective',
    unit: '%',
    better: 'up',
  },
];

const fmt = (v: number | null | undefined, unit = '') => (v === null || v === undefined ? '—' : `${v}${unit}`);
const SEVERITY_NAMES = ['Near Miss', 'No Harm', 'Adverse Event', 'Permanent Harm', 'Sentinel Event'];

const patientDaysKey = (month: string, dept: string) => `statlog.patientDays.${month}.${dept || 'all'}`;
const readStored = (key: string) => {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
};

/** Change vs last month, coloured only where "better" has a direction; always with an arrow and text. */
function Change({ now, before, better, unit }: { now: number | null; before: number | null; better: Better; unit?: string }) {
  if (now === null || before === null || now === undefined || before === undefined) return <span className="text-slate-300">—</span>;
  const diff = Math.round((now - before) * 10) / 10;
  if (diff === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-slate-400 text-xs font-semibold">
        <Minus className="w-3.5 h-3.5" /> same
      </span>
    );
  }
  const up = diff > 0;
  const good = better === null ? null : (better === 'up') === up;
  const color = good === null ? 'text-slate-500' : good ? 'text-emerald-700' : 'text-red-700';
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-bold ${color}`}
      title={good === null ? undefined : good ? 'Better than last month' : 'Worse than last month'}
    >
      <Icon className="w-3.5 h-3.5" />
      {up ? '+' : ''}
      {diff}
      {unit?.trim() === '%' ? ' pts' : unit || ''}
    </span>
  );
}

function Card({ title, icon: Icon, children, note }: { title: string; icon?: any; children: React.ReactNode; note?: string }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
      <header className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-[#7A2430]" />}
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        {note && <span className="ml-auto text-xs text-slate-400">{note}</span>}
      </header>
      {children}
    </section>
  );
}

export default function MonthlyReportTab({ isHospitalWide, departments }: { isHospitalWide: boolean; departments: any[] }) {
  const lastMonth = dayjs().subtract(1, 'month').format('YYYY-MM');
  const [month, setMonth] = useState(lastMonth);
  const [departmentId, setDepartmentId] = useState('');
  const [patientDays, setPatientDays] = useState(() => readStored(patientDaysKey(lastMonth, '')));
  const [downloading, setDownloading] = useState(false);

  // Patient days are entered per month (from the census); remembered on this computer
  useEffect(() => setPatientDays(readStored(patientDaysKey(month, departmentId))), [month, departmentId]);
  const savePatientDays = (value: string) => {
    const clean = value.replace(/[^\d]/g, '').slice(0, 8);
    setPatientDays(clean);
    try {
      if (clean) localStorage.setItem(patientDaysKey(month, departmentId), clean);
      else localStorage.removeItem(patientDaysKey(month, departmentId));
    } catch {
      // storage unavailable: the value still applies for this visit
    }
  };

  const params = useMemo(
    () => ({
      month,
      ...(departmentId ? { departmentId } : {}),
      ...(Number(patientDays) > 0 ? { patientDays: Number(patientDays) } : {}),
    }),
    [month, departmentId, patientDays],
  );
  const q = useQuery({
    queryKey: ['report-monthly', params],
    queryFn: () => api.get('/reports/monthly', { params }),
    enabled: /^\d{4}-\d{2}$/.test(month),
  });
  const r: any = (q.data as any)?.data;

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const blob = (await api.get('/reports/monthly/pdf', {
        params,
        responseType: 'blob',
      })) as unknown as Blob;
      showInViewer(blob, `Monthly_Incident_Report_${month}.pdf`, 'application/pdf');
    } catch (err: any) {
      let message = 'Could not create the PDF';
      const data = err?.response?.data;
      if (data instanceof Blob) {
        try {
          message = JSON.parse(await data.text())?.error?.message || message;
        } catch {
          // not JSON
        }
      }
      toast.error(message);
    } finally {
      setDownloading(false);
    }
  };

  const c = r?.current;
  const p = r?.previous;
  const prevLabel = p ? dayjs(`${p.month}-01`).format('MMM YYYY') : 'Last month';
  const monthShort = dayjs(`${month}-01`).format('MMM YYYY');

  return (
    <div className="space-y-5 animate-tab-panel-in">
      {/* Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5" htmlFor="mr-month">
            Month
          </label>
          <input
            id="mr-month"
            type="month"
            value={month}
            max={dayjs().format('YYYY-MM')}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            className={filterControlClass}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Department</label>
          {isHospitalWide ? (
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
          ) : (
            <div className={`${filterControlClass} flex items-center bg-slate-50 text-slate-500`}>{r?.department || 'Your department'}</div>
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5" htmlFor="mr-pd">
            Patient days <span className="font-normal text-slate-400">(optional, from census)</span>
          </label>
          <input
            id="mr-pd"
            inputMode="numeric"
            placeholder="e.g. 9000"
            value={patientDays}
            onChange={(e) => savePatientDays(e.target.value)}
            className={filterControlClass}
          />
        </div>
        <button
          type="button"
          onClick={downloadPdf}
          disabled={downloading || !r}
          className="h-10 px-4 bg-gradient-to-r from-[#5C1A22] via-[#7A2430] to-[#9C3A42] hover:brightness-110 text-white font-semibold text-sm rounded-xl shadow-button-red inline-flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
        >
          {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          Committee report (PDF)
        </button>
      </div>

      {q.isLoading ? (
        <div className="py-20 flex justify-center text-slate-400">
          <Loader2 className="w-7 h-7 animate-spin" />
        </div>
      ) : q.isError || !r ? (
        <EmptyState message={(q.error as any)?.response?.data?.error?.message || 'Could not load the report.'} />
      ) : (
        <>
          <p className="text-sm text-slate-500">
            <span className="font-semibold text-slate-800">{r.monthLabel}</span> · {r.department || 'Whole hospital'} · compared with {prevLabel} and
            the 3 months before
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <StatTile label="Reported" value={c.reported} icon={FileText} tone="red" hint={`${prevLabel}: ${p.reported}`} />
            <StatTile
              label="Near-miss ratio"
              value={fmt(c.nearMissRatio, '%')}
              icon={ShieldAlert}
              tone="blue"
              hint={`${prevLabel}: ${fmt(p.nearMissRatio, '%')}`}
            />
            <StatTile label="Serious events" value={c.serious} icon={AlertTriangle} tone="red" hint="Permanent harm + sentinel" />
            <StatTile
              label="Closed on time"
              value={fmt(c.closedOnTimeRate, '%')}
              icon={CheckCircle2}
              tone="green"
              hint={`${c.closedOnTime} of ${c.closed} closed`}
            />
            <StatTile label="Open past target" value={c.overdueAtEnd} icon={Clock} tone="amber" hint={`of ${c.openAtEnd} open at month end`} />
            <StatTile
              label="CAPA on time"
              value={fmt(c.capaOnTimeRate, '%')}
              icon={CheckCircle2}
              tone="violet"
              hint={`${c.capaDueOnTime} of ${c.capaDue} due`}
            />
          </div>

          <Card title="Key indicators" note="Green = better than last month, red = worse">
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th className="text-left">Indicator</th>
                    <th className="text-right">{monthShort}</th>
                    <th className="text-right">{prevLabel}</th>
                    <th className="text-right">3-month avg</th>
                    <th className="text-right">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {INDICATORS.filter((ind) => ind.key !== 'reportingRate' || c.reportingRate !== null).map((ind) => (
                    <tr key={ind.key}>
                      <td>
                        <span className="text-slate-800">{ind.label}</span>
                        {ind.hint && <span className="block text-xs text-slate-400">{ind.hint}</span>}
                      </td>
                      <td className="text-right font-bold text-slate-900 tabular-nums">{fmt(c[ind.key], ind.unit)}</td>
                      <td className="text-right text-slate-600 tabular-nums">{ind.key === 'reportingRate' ? '—' : fmt(p[ind.key], ind.unit)}</td>
                      <td className="text-right text-slate-600 tabular-nums">
                        {ind.key === 'reportingRate' ? '—' : fmt(r.average3[ind.key], ind.unit)}
                      </td>
                      <td className="text-right">
                        {ind.key === 'reportingRate' ? '' : <Change now={c[ind.key]} before={p[ind.key]} better={ind.better} unit={ind.unit} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <Card title="By severity">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th className="text-left">Severity</th>
                    <th className="text-right">{monthShort}</th>
                    <th className="text-right">{prevLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {SEVERITY_NAMES.map((name, i) => (
                    <tr key={name}>
                      <td>
                        <SeverityBadge severity={i + 1} />
                      </td>
                      <td className="text-right font-bold tabular-nums">{c.bySeverity[i]}</td>
                      <td className="text-right text-slate-600 tabular-nums">{p.bySeverity[i]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <Card title="Serious events (permanent harm and sentinel)" icon={AlertTriangle} note={`${r.seriousEvents.length} this month`}>
              {r.seriousEvents.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-400">None reported this month.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {r.seriousEvents.map((e: any) => (
                    <li key={e._id} className="px-4 py-3 flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <Link to={`/incidents/${e._id}`} className="text-sm font-bold text-[#5C1A22] hover:underline">
                          {e.incidentNumber}
                        </Link>
                        <p className="text-sm text-slate-800">{e.title}</p>
                        <p className="text-xs text-slate-500">
                          {e.department} · {e.category} · {dayjs(e.reportedAt).format('DD MMM')}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <SeverityBadge severity={e.severity} />
                        <StatusBadge status={e.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <Card title="Incident types">
              {r.categories.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-400">No incidents reported.</p>
              ) : (
                <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                  <table className="data-table w-full">
                    <thead>
                      <tr>
                        <th className="text-left">Category</th>
                        <th className="text-right">{monthShort}</th>
                        <th className="text-right">{prevLabel}</th>
                        <th className="text-right">3-month avg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.categories.map((x: any) => (
                        <tr key={x.name}>
                          <td className="text-slate-800">{x.name}</td>
                          <td className="text-right font-bold tabular-nums">{x.count}</td>
                          <td className="text-right text-slate-600 tabular-nums">{x.previous}</td>
                          <td className="text-right text-slate-600 tabular-nums">{x.average3}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card title="Departments" note="Responsible department">
              {r.departments.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-400">Nothing to show.</p>
              ) : (
                <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                  <table className="data-table w-full">
                    <thead>
                      <tr>
                        <th className="text-left">Department</th>
                        <th className="text-right">Reported</th>
                        <th className="text-right">Serious</th>
                        <th className="text-right">Closed</th>
                        <th className="text-right">Open</th>
                        <th className="text-right">Past target</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.departments.map((d: any) => (
                        <tr key={d.name}>
                          <td className="text-slate-800">{d.name}</td>
                          <td className="text-right font-bold tabular-nums">{d.reported}</td>
                          <td className="text-right tabular-nums">{d.serious || '—'}</td>
                          <td className="text-right tabular-nums">{d.closed}</td>
                          <td className="text-right tabular-nums">{d.openAtEnd}</td>
                          <td className={`text-right tabular-nums ${d.overdueAtEnd ? 'text-red-700 font-bold' : ''}`}>{d.overdueAtEnd}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          <Card title="Repeat incidents" icon={Repeat}>
            {r.repeatsAtLocation.length === 0 && r.recurring.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-400">No repeats found.</p>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 divide-y xl:divide-y-0 xl:divide-x divide-slate-100">
                <div>
                  <p className="px-4 pt-3 pb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Same type at the same location this month</p>
                  {r.repeatsAtLocation.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-slate-400">None.</p>
                  ) : (
                    <table className="data-table w-full">
                      <tbody>
                        {r.repeatsAtLocation.map((x: any) => (
                          <tr key={`${x.location}${x.category}`}>
                            <td className="text-slate-800">{x.location}</td>
                            <td className="text-slate-600">{x.category}</td>
                            <td className="text-right font-bold tabular-nums">{x.count}×</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div>
                  <p className="px-4 pt-3 pb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Same type, same department, each of the last 3 months
                  </p>
                  {r.recurring.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-slate-400">None.</p>
                  ) : (
                    <table className="data-table w-full">
                      <tbody>
                        {r.recurring.map((x: any) => (
                          <tr key={`${x.department}${x.category}`}>
                            <td className="text-slate-800">{x.department}</td>
                            <td className="text-slate-600">{x.category}</td>
                            <td className="text-right tabular-nums text-slate-700 whitespace-nowrap" title="Last 3 months, oldest first">
                              {x.counts.join(' → ')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </Card>

          <Card title="Open past their closure target at month end" icon={Clock} note={`${r.overdue.length} incidents`}>
            {r.overdue.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-400">None. Everything open is within its target time.</p>
            ) : (
              <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                <table className="data-table w-full">
                  <thead>
                    <tr>
                      <th className="text-left">Incident</th>
                      <th className="text-left">What happened</th>
                      <th className="text-left">Department</th>
                      <th className="text-left">Status</th>
                      <th className="text-right">Days open</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.overdue.map((o: any) => (
                      <tr key={o._id}>
                        <td className="whitespace-nowrap">
                          <Link to={`/incidents/${o._id}`} className="font-bold text-[#5C1A22] hover:underline">
                            {o.incidentNumber}
                          </Link>
                          <div className="mt-1">
                            <SeverityBadge severity={o.severity} />
                          </div>
                        </td>
                        <td className="text-slate-800">{o.title}</td>
                        <td className="text-slate-600">{o.department}</td>
                        <td>
                          <StatusBadge status={o.status} />
                        </td>
                        <td className="text-right whitespace-nowrap tabular-nums">
                          <span className="font-bold text-red-700">{o.daysOpen}</span>
                          <span className="text-xs text-slate-400"> / {o.targetDays}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <p className="text-xs text-slate-400">
            Months are calendar months (IST). Rejected reports are left out of every figure except “Rejected”. Departments are the department
            responsible for the incident. Reporter names are never included.
          </p>
        </>
      )}
    </div>
  );
}
