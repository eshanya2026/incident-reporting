import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import {
  Sparkles,
  RefreshCw,
  Loader2,
  Target,
  Repeat,
  RotateCcw,
  MapPin,
  Building2,
  AlarmClock,
  ThumbsUp,
  TrendingUp,
  TrendingDown,
  Info,
  X,
  BarChart3,
  ArrowRight,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { hasPermission } from '../lib/rbac';
import { toast } from '../store/useToastStore';
import { errorMessage } from '../lib/useAction';
import { PageHeader, Notice } from '../components/ui/primitives';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { departmentOptions } from '../components/ui/DepartmentOptions';
import { filterControlClass } from '../components/ui/listKit';
import { SEVERITY_COLOR } from '../lib/incidentMeta';
import AskAiChat from '../components/insights/AskAiChat';

type Period = '3m' | '6m' | '12m';
const PERIODS: Array<{ key: Period; label: string }> = [
  { key: '3m', label: '3 months' },
  { key: '6m', label: '6 months' },
  { key: '12m', label: '12 months' },
];

// ---------- Indicator status ----------
// Simple, fixed thresholds so each indicator reads at a glance. Volume (trend) and median days are
// shown without a verdict: more reporting can mean a healthier reporting culture, not more harm.
type Tone = 'good' | 'watch' | 'concern' | 'neutral';
const TONE: Record<Tone, { dot: string; bar: string; label: string }> = {
  good: { dot: 'bg-emerald-500', bar: 'bg-emerald-500', label: 'On track' },
  watch: { dot: 'bg-amber-500', bar: 'bg-amber-500', label: 'Watch' },
  concern: { dot: 'bg-red-600', bar: 'bg-red-600', label: 'Needs attention' },
  neutral: { dot: 'bg-slate-300', bar: 'bg-slate-300', label: 'For context' },
};
const atLeast = (v: number | null | undefined, good: number, watch: number): Tone =>
  v === null || v === undefined ? 'neutral' : v >= good ? 'good' : v >= watch ? 'watch' : 'concern';
const atMost = (v: number | null | undefined, good: number, watch: number): Tone =>
  v === null || v === undefined ? 'neutral' : v <= good ? 'good' : v <= watch ? 'watch' : 'concern';

const PRIORITY: Record<string, { stripe: string; pill: string }> = {
  HIGH: { stripe: 'bg-red-600', pill: 'bg-red-50 text-red-700 border-red-200' },
  MEDIUM: {
    stripe: 'bg-amber-500',
    pill: 'bg-amber-50 text-amber-800 border-amber-300',
  },
  LOW: {
    stripe: 'bg-slate-400',
    pill: 'bg-slate-100 text-slate-700 border-slate-200',
  },
};

const pctText = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v}%`);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function AiInsightsPage() {
  const user = useAuthStore((s) => s.user);
  const hospitalWide = hasPermission(user, 'insights.view_all');
  const queryClient = useQueryClient();

  const [period, setPeriod] = useState<Period>('6m');
  const [departmentId, setDepartmentId] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const queryKey = ['insights', period, hospitalWide ? departmentId : 'own'];
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey,
    queryFn: () =>
      api.get('/insights', {
        params: {
          period,
          departmentId: hospitalWide && departmentId ? departmentId : undefined,
        },
      }),
    // While today's analysis is being written in the background, check back until it lands
    refetchInterval: (query) => ((query.state.data as any)?.data?.ai?.generating ? 5000 : false),
    placeholderData: (prev) => prev,
  });
  const view = (data as any)?.data;

  const { data: departmentsData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments'),
    enabled: hospitalWide,
  });
  const departments = (departmentsData as any)?.data || [];

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res: any = await api.post('/insights/regenerate', {
        period,
        departmentId: hospitalWide && departmentId ? departmentId : undefined,
      });
      queryClient.setQueryData(queryKey, res);
      if (res?.data?.ai?.lastError) toast.error(`AI analysis failed: ${res.data.ai.lastError.message}`);
      else toast.success('Analysis regenerated');
    } catch (err: any) {
      toast.error(errorMessage(err, 'Could not regenerate the analysis'));
    } finally {
      setRegenerating(false);
    }
  };

  const facts = view?.facts;
  const ai = view?.ai;
  const narrative = ai?.insight?.narrative;
  const isHospitalScope = view?.scope?.kind === 'HOSPITAL';
  const scopeLabel = !view ? '' : isHospitalScope ? 'Whole hospital' : view.scope.departmentName;
  const months = period.replace('m', '');

  // Incident numbers the AI cites, resolved to links where the facts know the incident
  const incidentIdByNumber = new Map<string, string>();
  facts?.recurring?.forEach((r: any) => r.incidents.forEach((i: any) => incidentIdByNumber.set(i.incidentNumber, i.id)));
  facts?.recurrenceAfterClosure?.forEach((r: any) => {
    incidentIdByNumber.set(r.incident.incidentNumber, r.incident.id);
    incidentIdByNumber.set(r.prior.incidentNumber, r.prior.id);
  });
  facts?.overdueIncidents?.forEach((o: any) => incidentIdByNumber.set(o.incidentNumber, o.id));

  const noteFor = (key: string): string | undefined => narrative?.indicatorNotes?.find((n: any) => n.key === key)?.note;

  return (
    <div className="space-y-6 pb-20 text-clinicalText-primary">
      <PageHeader
        icon={Sparkles}
        title="AI Insights"
        description={
          view
            ? `${scopeLabel} · last ${months} months · figures as of ${dayjs(facts?.asOf).format('DD MMM YYYY, HH:mm')}`
            : 'Where the incident data says to act.'
        }
      >
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={!ai?.canRegenerate || regenerating}
          title={ai?.regenerateBlockedReason || 'Write a fresh analysis from the latest data (once a day)'}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#5C1A22] hover:bg-[#FAF3EC] text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed self-start md:self-auto"
        >
          {regenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          <span>{regenerating ? 'Regenerating…' : 'Regenerate analysis'}</span>
        </button>
      </PageHeader>

      {/* ---- Controls ---- */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-card">
        {hospitalWide && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold text-slate-500 shrink-0">Scope</span>
            <SearchableSelect
              value={departmentId}
              onChange={setDepartmentId}
              options={[{ value: '', label: 'Whole hospital' }, ...departmentOptions(departments)]}
              searchPlaceholder="Search departments..."
              className={`${filterControlClass} min-w-[15rem]`}
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 shrink-0">Period</span>
          <div className="inline-flex rounded-xl bg-slate-100 p-1" role="group" aria-label="Period">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriod(p.key)}
                aria-pressed={period === p.key}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  period === p.key ? 'bg-white text-[#5C1A22] shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {isFetching && !isLoading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" aria-label="Updating" />}
        </div>
        <div className="lg:ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-slate-500">
          {(['good', 'watch', 'concern'] as Tone[]).map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${TONE[t].dot}`} />
              {TONE[t].label}
            </span>
          ))}
        </div>
      </div>

      {error && !view && <Notice tone="error">{errorMessage(error, 'Could not load insights')}</Notice>}

      {isLoading && <PageSkeleton />}

      {/* ---- Floating "Ask AI" chat: independent of this page's period, department and figures ---- */}
      <>
        {chatOpen && (
          <div
            className="fixed z-50 inset-x-3 bottom-24 top-24 sm:inset-x-auto sm:top-auto sm:right-6 sm:w-[420px] sm:h-[min(640px,calc(100vh-8rem))]"
            role="dialog"
            aria-label="Ask AI about your incidents"
          >
            <AskAiChat onClose={() => setChatOpen(false)} />
          </div>
        )}
        <button
          type="button"
          onClick={() => setChatOpen((o) => !o)}
          aria-expanded={chatOpen}
          aria-label={chatOpen ? 'Close Ask AI' : 'Ask AI about your incidents'}
          className="fixed z-50 bottom-6 right-4 sm:right-6 inline-flex items-center gap-2 h-14 pl-4 pr-5 rounded-full brand-gradient text-white font-bold text-[14px] shadow-[0_12px_28px_-8px_rgba(92,26,34,0.65)] hover:brightness-110 active:scale-[0.98] transition cursor-pointer"
          style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {chatOpen ? <X className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
          <span>{chatOpen ? 'Close' : 'Ask AI'}</span>
        </button>
      </>

      {facts && (
        <>
          {/* ---- AI brief ---- */}
          <section className="relative overflow-hidden rounded-2xl border border-[#E9D3BC] bg-gradient-to-br from-[#FFFBF6] via-white to-[#FBF5EE] shadow-card">
            <div className="absolute inset-y-0 left-0 w-1.5 brand-gradient" aria-hidden="true" />
            <div className="p-5 sm:p-6 pl-6 sm:pl-7 grid grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-6">
              <div className="space-y-3 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#5C1A22] text-white text-[11px] font-bold uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" /> AI Brief
                  </span>
                  {ai.insight && (
                    <span className="text-[12px] text-clinicalText-muted">
                      {ai.insight.trigger === 'MANUAL' ? `Regenerated by ${ai.insight.generatedByName || 'a user'}` : 'Daily analysis'} ·{' '}
                      {dayjs(ai.insight.generatedAt).format('DD MMM, HH:mm')}
                    </span>
                  )}
                  {ai.generating && ai.insight && (
                    <span className="inline-flex items-center gap-1 text-[12px] text-maroon-700">
                      <Loader2 className="w-3 h-3 animate-spin" /> Refreshing
                    </span>
                  )}
                </div>

                {narrative ? (
                  <p className="text-[15.5px] leading-7 text-clinicalText-primary">{narrative.summary}</p>
                ) : ai.enabled && ai.generating ? (
                  <div className="space-y-2.5 py-1" aria-live="polite">
                    <p className="text-[13px] text-clinicalText-secondary flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-maroon-700" />
                      Reading {plural(facts.totals.reported, 'incident')}. This usually takes under a minute.
                    </p>
                    {[92, 100, 78].map((w) => (
                      <div key={w} className="h-3.5 rounded bg-[#F1E6D8] animate-pulse" style={{ width: `${w}%` }} />
                    ))}
                  </div>
                ) : (
                  <p className="text-[15.5px] leading-7 text-clinicalText-primary">{glanceSentence(facts, months)}</p>
                )}

                {!ai.enabled && (
                  <p className="text-[12px] text-clinicalText-muted flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" /> AI analysis isn't switched on yet, so this is a plain summary of the figures below.
                  </p>
                )}
                {ai.lastError && (
                  <Notice tone="warning">
                    The latest analysis attempt failed ({dayjs(ai.lastError.at).format('DD MMM, HH:mm')}): {ai.lastError.message}
                  </Notice>
                )}
                {narrative && (
                  <p className="text-[11.5px] text-clinicalText-muted flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 shrink-0" /> Written by AI from the figures on this page. Check the linked incidents before
                    acting.
                  </p>
                )}
              </div>

              {/* Priorities at a glance */}
              <div className="min-w-0 lg:border-l lg:border-[#EADBC8] lg:pl-6">
                <h3 className="text-[11.5px] font-bold uppercase tracking-wider text-clinicalText-muted mb-3">Top priorities</h3>
                {narrative?.focusAreas?.length ? (
                  <ol className="space-y-2">
                    {narrative.focusAreas.map((f: any, i: number) => (
                      <li key={i}>
                        <a
                          href={`#focus-${i}`}
                          className="group flex items-start gap-2.5 rounded-lg px-2 py-1.5 -mx-2 hover:bg-white/80 transition"
                        >
                          <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${(PRIORITY[f.priority] || PRIORITY.MEDIUM).stripe}`} />
                          <span className="text-[13px] font-semibold leading-snug text-clinicalText-primary group-hover:text-[#5C1A22]">
                            {f.title}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <ul className="space-y-2 text-[13px]">
                    <GlanceRow
                      label="Repeated incident types"
                      value={facts.recurring.length}
                      tone={facts.recurring.length ? 'watch' : 'good'}
                    />
                    <GlanceRow
                      label="Came back after closure"
                      value={facts.recurrenceAfterClosure.length}
                      tone={facts.recurrenceAfterClosure.length ? 'concern' : 'good'}
                    />
                    <GlanceRow
                      label="Past the HOD deadline"
                      value={facts.totals.overdueOpenNow}
                      tone={facts.totals.overdueOpenNow ? 'concern' : 'good'}
                    />
                    <GlanceRow
                      label="CAPAs past target"
                      value={facts.totals.overdueCapasNow}
                      tone={atMost(facts.totals.overdueCapasNow, 0, 3)}
                    />
                  </ul>
                )}
              </div>
            </div>
          </section>

          {/* ---- Indicators ---- */}
          <section className="space-y-3">
            <SectionTitle icon={BarChart3} title="Key indicators" />
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <Indicator
                label="Incidents reported"
                value={facts.totals.reported}
                tone="neutral"
                trend={facts.totals.trendPct}
                hint={
                  facts.totals.trendPct === null
                    ? 'No data for the previous period'
                    : `${facts.totals.trendPct > 0 ? '+' : ''}${facts.totals.trendPct}% vs the previous ${months} months`
                }
                note={noteFor('trend')}
              />
              <Indicator
                label="Near-miss share"
                value={pctText(facts.severity.nearMissSharePct)}
                tone={atLeast(facts.severity.nearMissSharePct, 40, 20)}
                hint={`${facts.severity.counts['1'] ?? 0} near ${(facts.severity.counts['1'] ?? 0) === 1 ? 'miss' : 'misses'}. Higher means problems are caught early.`}
                note={noteFor('nearMiss')}
              />
              <Indicator
                label="Harm events"
                value={facts.severity.harmEvents}
                tone={facts.severity.sentinelEvents > 0 ? 'concern' : facts.severity.harmEvents > 0 ? 'watch' : 'good'}
                hint={`Severity 3 to 5 · ${facts.severity.sentinelEvents} sentinel`}
                note={noteFor('harm')}
              />
              <Indicator
                label="Median days to close"
                value={facts.closure.medianDaysToClose ?? '—'}
                tone="neutral"
                hint={`${facts.totals.closed} closed in the period`}
                note={noteFor('closureTime')}
              />
              <Indicator
                label="Closed within target"
                value={pctText(facts.closure.withinTargetPct)}
                tone={atLeast(facts.closure.withinTargetPct, 80, 50)}
                hint="Target is 7 to 30 days, by severity"
                note={noteFor('withinTarget')}
              />
              <Indicator
                label="Sent back for rework"
                value={pctText(facts.reworkRatePct)}
                tone={atMost(facts.reworkRatePct, 10, 25)}
                hint="Returned by the HOD or Quality at least once"
                note={noteFor('rework')}
              />
              <Indicator
                label="CAPAs past target"
                value={facts.totals.overdueCapasNow}
                tone={atMost(facts.totals.overdueCapasNow, 0, 3)}
                hint="Open right now"
                note={noteFor('capaOverdue')}
              />
              <Indicator
                label="High or extreme risk"
                value={(facts.risk.bands.HIGH ?? 0) + (facts.risk.bands.EXTREME ?? 0)}
                tone={atMost((facts.risk.bands.HIGH ?? 0) + (facts.risk.bands.EXTREME ?? 0), 0, 2)}
                hint={`Of ${facts.risk.assessed} risk-scored at closure`}
                note={noteFor('risk')}
              />
            </div>
          </section>

          {/* ---- Where to work ---- */}
          {narrative?.focusAreas?.length > 0 && (
            <section className="space-y-3">
              <SectionTitle icon={Target} title="Where to work" />
              <div className="space-y-3">
                {narrative.focusAreas.map((f: any, i: number) => {
                  const p = PRIORITY[f.priority] || PRIORITY.MEDIUM;
                  return (
                    <article
                      key={i}
                      id={`focus-${i}`}
                      className="relative overflow-hidden bg-white rounded-2xl border border-slate-200 shadow-card scroll-mt-28"
                    >
                      <span className={`absolute inset-y-0 left-0 w-1 ${p.stripe}`} aria-hidden="true" />
                      <div className="p-5 pl-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-x-6 gap-y-3">
                        <div className="space-y-2 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-[#5C1A22] text-white text-[12px] font-bold flex items-center justify-center shrink-0">
                              {i + 1}
                            </span>
                            <h4 className="font-bold text-[15px] text-clinicalText-primary">{f.title}</h4>
                            <span className={`px-2 py-0.5 rounded-full border text-[10.5px] font-bold tracking-wide ${p.pill}`}>
                              {f.priority}
                            </span>
                          </div>
                          {f.evidence && <p className="text-[13px] text-clinicalText-secondary leading-relaxed">{f.evidence}</p>}
                          {f.whyItMatters && (
                            <p className="text-[13px] text-clinicalText-secondary leading-relaxed">
                              <span className="font-semibold text-clinicalText-primary">Why it matters: </span>
                              {f.whyItMatters}
                            </p>
                          )}
                          {f.incidentNumbers?.length > 0 && <IncidentChips numbers={f.incidentNumbers} idByNumber={incidentIdByNumber} />}
                        </div>
                        {f.action && (
                          <div className="rounded-xl bg-[#FAF3EC] border border-[#E9D3BC] p-4 self-start">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-[#7A2430] mb-1.5 flex items-center gap-1.5">
                              <ArrowRight className="w-3.5 h-3.5" /> Recommended action
                            </div>
                            <p className="text-[13.5px] leading-relaxed text-[#4A1219]">{f.action}</p>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* ---- Patterns ---- */}
          <section className="space-y-3">
            <SectionTitle icon={Repeat} title="Patterns" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Panel
                title="Repeated incidents"
                icon={Repeat}
                count={facts.recurring.length}
                subtitle="The same category and subcategory, more than once this period."
              >
                {facts.recurring.length === 0 ? (
                  <Empty message="No incident type was reported more than once." />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {facts.recurring.map((r: any, i: number) => (
                      <li key={i} className="py-3 first:pt-0 last:pb-0 flex gap-3">
                        <span
                          className="w-10 h-10 shrink-0 rounded-xl flex flex-col items-center justify-center text-white"
                          style={{
                            background: SEVERITY_COLOR[r.maxSeverity] ?? '#64748B',
                          }}
                          title={`Highest severity: ${r.maxSeverity}`}
                        >
                          <span className="text-[15px] font-extrabold leading-none tabular-nums">{r.count}</span>
                          <span className="text-[9px] font-semibold opacity-90">times</span>
                        </span>
                        <div className="min-w-0 space-y-1">
                          <div className="font-semibold text-[13.5px] leading-snug">
                            {r.category}
                            {r.subcategory && <span className="font-normal text-clinicalText-muted"> · {r.subcategory}</span>}
                          </div>
                          <div className="text-[12px] text-clinicalText-secondary flex flex-wrap gap-x-3 gap-y-0.5">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {r.locations.map((l: any) => `${l.name} (${l.count})`).join(', ')}
                            </span>
                            {isHospitalScope && (
                              <span className="inline-flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {r.departments.map((d: any) => `${d.name} (${d.count})`).join(', ')}
                              </span>
                            )}
                          </div>
                          <IncidentChips numbers={r.incidents.map((x: any) => x.incidentNumber)} idByNumber={incidentIdByNumber} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel
                title="Came back after closure"
                icon={RotateCcw}
                count={facts.recurrenceAfterClosure.length}
                tone={facts.recurrenceAfterClosure.length ? 'concern' : undefined}
                subtitle="The same kind of incident in the same department, reported after an earlier one was closed with its CAPA marked effective."
              >
                {facts.recurrenceAfterClosure.length === 0 ? (
                  <Empty message="Nothing came back after closure. CAPAs are holding." positive />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {facts.recurrenceAfterClosure.map((r: any, i: number) => (
                      <li key={i} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
                          <IncidentLink id={r.prior.id} number={r.prior.incidentNumber} />
                          <span className="text-clinicalText-muted">closed, then</span>
                          <IncidentLink id={r.incident.id} number={r.incident.incidentNumber} />
                          <span className="font-semibold text-red-700">{r.daysAfterClosure} days later</span>
                        </div>
                        <div className="text-[12px] text-clinicalText-secondary">
                          {r.category}
                          {r.subcategory ? ` · ${r.subcategory}` : ''} · {r.department}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </section>

          {/* ---- Hotspots ---- */}
          <section className="space-y-3">
            <SectionTitle icon={MapPin} title="Hotspots" hint="Ranked by severity-weighted score, so harm counts for more than volume." />
            <div className={`grid grid-cols-1 gap-6 ${isHospitalScope ? 'lg:grid-cols-2' : ''}`}>
              {isHospitalScope && (
                <Panel title="Departments" icon={Building2}>
                  <HotspotBars rows={facts.hotspots.departments} />
                </Panel>
              )}
              <Panel title="Locations" icon={MapPin}>
                <HotspotBars rows={facts.hotspots.locations} />
              </Panel>
            </div>
          </section>

          {/* ---- Right now & trend ---- */}
          <section className="space-y-3">
            <SectionTitle icon={AlarmClock} title="Right now and over time" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Panel
                title="Past the HOD deadline"
                icon={AlarmClock}
                count={facts.overdueIncidents.length}
                tone={facts.overdueIncidents.length ? 'concern' : undefined}
              >
                {facts.overdueIncidents.length === 0 ? (
                  <Empty message="Every open incident is within its action deadline." positive />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {facts.overdueIncidents.map((o: any) => (
                      <li key={o.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                        <div className="min-w-0 space-y-0.5">
                          <IncidentLink id={o.id} number={o.incidentNumber} />
                          <div className="text-[12px] text-clinicalText-secondary truncate">
                            {o.title} · {o.department}
                          </div>
                        </div>
                        <span className="shrink-0 px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-[11.5px] font-bold text-red-700 tabular-nums">
                          {o.daysOverdue}d late
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel title="Reported per month" icon={BarChart3}>
                <MonthlyBars rows={facts.monthly} />
                {narrative?.positives?.length > 0 && (
                  <div className="mt-4 rounded-xl bg-emerald-50/70 border border-emerald-200 p-3.5 space-y-2">
                    <div className="text-[11.5px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                      <ThumbsUp className="w-3.5 h-3.5" /> What's going well
                    </div>
                    <ul className="space-y-1.5">
                      {narrative.positives.map((p: string, i: number) => (
                        <li key={i} className="text-[13px] text-emerald-900 leading-relaxed">
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Panel>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

// ---------- Pieces ----------

/** One plain sentence from the figures, used when there's no AI analysis to show. */
function glanceSentence(facts: any, months: string): string {
  const t = facts.totals;
  const parts = [`${plural(t.reported, 'incident')} reported in the last ${months} months`];
  if (t.trendPct !== null)
    parts[0] += ` (${t.trendPct > 0 ? 'up' : t.trendPct < 0 ? 'down' : 'unchanged'}${t.trendPct ? ` ${Math.abs(t.trendPct)}%` : ''} on the period before)`;
  parts.push(`${facts.severity.harmEvents} caused harm`);
  parts.push(`${plural(facts.recurring.length, 'incident type')} repeated`);
  const tail = t.overdueOpenNow
    ? `${t.overdueOpenNow} open ${t.overdueOpenNow === 1 ? 'incident is' : 'incidents are'} past the HOD deadline.`
    : 'No open incident is past its HOD deadline.';
  return `${parts.join(', ')}. ${tail}`;
}

function SectionTitle({ icon: Icon, title, hint }: { icon: any; title: string; hint?: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#5C1A22] flex items-center gap-2">
        <Icon className="w-4 h-4" /> {title}
      </h2>
      {hint && <span className="text-[12px] text-clinicalText-muted">{hint}</span>}
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  count,
  tone,
  subtitle,
  children,
}: {
  title: string;
  icon: any;
  count?: number;
  tone?: 'concern';
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 space-y-4 min-w-0">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[14px] font-bold text-clinicalText-primary flex items-center gap-2">
            <Icon className="w-4 h-4 text-maroon-700" /> {title}
          </h3>
          {count !== undefined && (
            <span
              className={`px-2 py-0.5 rounded-full text-[11.5px] font-bold tabular-nums ${
                tone === 'concern' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {count}
            </span>
          )}
        </div>
        {subtitle && <p className="text-[12px] text-clinicalText-muted leading-relaxed">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Empty({ message, positive }: { message: string; positive?: boolean }) {
  return (
    <div
      className={`rounded-xl px-4 py-6 text-center text-[13px] ${positive ? 'bg-emerald-50/60 text-emerald-800' : 'bg-slate-50 text-slate-500'}`}
    >
      {message}
    </div>
  );
}

function GlanceRow({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-clinicalText-secondary">
        <span className={`w-2 h-2 rounded-full ${TONE[tone].dot}`} />
        {label}
      </span>
      <span className="font-bold tabular-nums">{value}</span>
    </li>
  );
}

function Indicator({
  label,
  value,
  hint,
  note,
  trend,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  note?: string;
  trend?: number | null;
  tone: Tone;
}) {
  const t = TONE[tone];
  return (
    <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-200 shadow-card p-4 pt-5 flex flex-col gap-1.5 min-w-0">
      <span className={`absolute top-0 inset-x-0 h-1 ${t.bar}`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11.5px] font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
        {tone !== 'neutral' && (
          <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-slate-500 shrink-0" title={t.label}>
            <span className={`w-2 h-2 rounded-full ${t.dot}`} />
            {t.label}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-[30px] font-extrabold text-slate-900 leading-none tabular-nums">{value}</p>
        {trend !== undefined &&
          trend !== null &&
          trend !== 0 &&
          (trend > 0 ? <TrendingUp className="w-4 h-4 text-slate-500" /> : <TrendingDown className="w-4 h-4 text-slate-500" />)}
      </div>
      {hint && <p className="text-[12px] text-slate-400 leading-snug">{hint}</p>}
      {note && (
        <p className="mt-1.5 pt-2.5 border-t border-dashed border-slate-200 text-[12.5px] leading-relaxed text-clinicalText-secondary flex gap-1.5">
          <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#B8892E]" />
          <span>{note}</span>
        </p>
      )}
    </div>
  );
}

function IncidentLink({ id, number }: { id?: string; number: string }) {
  const cls = 'inline-block px-2 py-0.5 rounded-md bg-[#FAF3EC] border border-[#E9D3BC] font-mono font-bold text-[11.5px] text-[#5C1A22]';
  return id ? (
    <Link to={`/incidents/${id}`} className={`${cls} hover:bg-[#F4E6D7] hover:border-[#D9BB9A] transition`}>
      {number}
    </Link>
  ) : (
    <span className={cls}>{number}</span>
  );
}

function IncidentChips({ numbers, idByNumber }: { numbers: string[]; idByNumber: Map<string, string> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {numbers.map((n) => (
        <IncidentLink key={n} id={idByNumber.get(n)} number={n} />
      ))}
    </div>
  );
}

function HotspotBars({
  rows,
}: {
  rows: Array<{
    name: string;
    count: number;
    weightedScore: number;
    highRisk?: number;
    open?: number;
  }>;
}) {
  if (!rows.length) return <Empty message="No incidents in this period." />;
  const max = Math.max(...rows.map((r) => r.weightedScore), 1);
  return (
    <ol className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.name} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-[13px]">
            <span className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] font-bold text-slate-400 w-4 shrink-0 tabular-nums">{i + 1}</span>
              <span className="font-semibold truncate">{r.name}</span>
            </span>
            <span className="shrink-0 text-[12px] text-clinicalText-secondary tabular-nums">
              {plural(r.count, 'incident')}
              {r.highRisk ? <span className="text-red-700 font-semibold"> · {r.highRisk} high risk</span> : null}
              {r.open ? ` · ${r.open} open` : ''}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden ml-6">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#7A2430] to-[#D4A954]"
              style={{ width: `${(r.weightedScore / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

function MonthlyBars({ rows }: { rows: Array<{ month: string; count: number }> }) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  const current = dayjs().format('YYYY-MM');
  return (
    <div
      className="relative h-44 pt-4"
      role="img"
      aria-label={`Incidents reported per month: ${rows.map((r) => `${dayjs(`${r.month}-01`).format('MMM')} ${r.count}`).join(', ')}`}
    >
      <div className="absolute inset-x-0 top-4 bottom-6 flex flex-col justify-between pointer-events-none" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="border-t border-dashed border-slate-100" />
        ))}
      </div>
      <div className="relative h-full flex items-end gap-2">
        {rows.map((r) => (
          <div key={r.month} className="flex-1 min-w-0 flex flex-col items-center gap-1 h-full justify-end">
            <span className="text-[11px] font-bold text-clinicalText-secondary tabular-nums">{r.count}</span>
            <div
              className={`w-full max-w-[2.75rem] rounded-t-md ${r.month === current ? 'bg-[#D4A954]' : 'bg-[#7A2430]'}`}
              style={{
                height: `${Math.max((r.count / max) * 100, r.count ? 6 : 2)}%`,
              }}
              title={r.month === current ? 'This month so far' : undefined}
            />
            <span className={`text-[10.5px] ${r.month === current ? 'font-bold text-[#8A6420]' : 'text-clinicalText-muted'}`}>
              {dayjs(`${r.month}-01`).format('MMM')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading insights">
      <div className="h-40 rounded-2xl bg-white border border-slate-200 animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-white border border-slate-200 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 rounded-2xl bg-white border border-slate-200 animate-pulse" />
        <div className="h-64 rounded-2xl bg-white border border-slate-200 animate-pulse" />
      </div>
    </div>
  );
}
