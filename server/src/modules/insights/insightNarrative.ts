import { z } from 'zod';
import { InsightFacts, deidentify, scopeLabelOf } from './insightFacts.js';
import { generateJson } from './aiClient.js';

// Turns computed facts into the AI-written analysis. Only aggregates and de-identified incident
// titles are sent — never patient names, UHIDs or incident descriptions.

export const INDICATOR_KEYS = ['trend', 'nearMiss', 'harm', 'closureTime', 'withinTarget', 'rework', 'capaOverdue', 'risk'] as const;

const narrativeSchema = z.object({
  summary: z.string().min(1),
  focusAreas: z
    .array(
      z.object({
        title: z.string().min(1),
        priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).catch('MEDIUM'),
        evidence: z.string().default(''),
        whyItMatters: z.string().default(''),
        action: z.string().default(''),
        incidentNumbers: z.array(z.string()).default([]),
      })
    )
    .max(6),
  indicatorNotes: z.array(z.object({ key: z.string(), note: z.string() })).default([]),
  positives: z.array(z.string()).default([]),
});
export type InsightNarrative = z.infer<typeof narrativeSchema>;

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'focusAreas', 'indicatorNotes', 'positives'],
  properties: {
    summary: { type: 'string' },
    focusAreas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'priority', 'evidence', 'whyItMatters', 'action', 'incidentNumbers'],
        properties: {
          title: { type: 'string' },
          priority: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
          evidence: { type: 'string' },
          whyItMatters: { type: 'string' },
          action: { type: 'string' },
          incidentNumbers: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    indicatorNotes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'note'],
        properties: { key: { type: 'string', enum: [...INDICATOR_KEYS] }, note: { type: 'string' } },
      },
    },
    positives: { type: 'array', items: { type: 'string' } },
  },
};

const SYSTEM_PROMPT = `You are the patient-safety and quality analyst for Adhiparasakthi Hospitals (NABH-accredited, Melmaruvathur, India). You review incident-reporting data and tell hospital leadership where to act.

Rules:
- Use only the data provided. Never invent, estimate or recalculate numbers; quote figures exactly as given.
- When you refer to specific incidents, cite their incident numbers (for example INC-2026-000012). Only cite numbers that appear in the data.
- Be specific and practical: name the department, location and category, and the concrete action (a protocol, checklist, training, equipment check, audit, staffing change).
- A high near-miss share means staff are reporting well. Treat it as a positive signal, not a failure.
- "recurrenceAfterClosure" means an incident came back after an earlier one of the same kind was closed with a CAPA marked effective. Treat it as a sign that the CAPA did not work.
- If there is too little data to support a conclusion (for example, fewer than 5 incidents in the period), say so plainly instead of speculating.
- Write plain, professional English for doctors, nurses and administrators. No markdown, no bullet characters inside strings.

Return JSON only, matching the schema:
- summary: 3 to 5 sentences on the overall picture.
- focusAreas: 3 to 5 items, most important first. Each has a short title, a priority (HIGH, MEDIUM or LOW), the evidence (with figures), why it matters, a recommended action, and the incident numbers it is based on.
- indicatorNotes: one short note (one sentence) for each indicator key present in "indicators".
- positives: 1 to 3 things that are genuinely going well, or an empty list if nothing is.`;

/** The compact, de-identified view of the facts that the AI sees. */
export const buildAiPayload = (facts: InsightFacts, privateNamesById: Map<string, string[]>) => {
  const title = (id: string, text: string) => deidentify(text, privateNamesById.get(id) ?? []);
  return {
    scope: scopeLabelOf(facts.scope),
    period: `Last ${facts.period.replace('m', '')} months (reported since ${facts.since.slice(0, 10)})`,
    indicators: {
      trend: { reportedThisPeriod: facts.totals.reported, reportedPreviousPeriod: facts.totals.previousReported, changePct: facts.totals.trendPct },
      nearMiss: { nearMissSharePct: facts.severity.nearMissSharePct, nearMisses: facts.severity.counts['1'] },
      harm: { harmEvents: facts.severity.harmEvents, sentinelEvents: facts.severity.sentinelEvents },
      closureTime: { medianDaysToClose: facts.closure.medianDaysToClose, closedThisPeriod: facts.totals.closed },
      withinTarget: { closedWithinTargetPct: facts.closure.withinTargetPct, targetDaysBySeverity: { 1: 30, 2: 21, 3: 14, 4: 10, 5: 7 } },
      rework: { sentBackAtLeastOncePct: facts.reworkRatePct },
      capaOverdue: { openCapasPastTargetNow: facts.totals.overdueCapasNow, capasForThisPeriodsIncidents: facts.capa },
      risk: { assessedAtClosure: facts.risk.assessed, bands: facts.risk.bands },
    },
    severityCounts: facts.severity.counts,
    severityScale: '1 Near Miss, 2 No Harm, 3 Adverse Event, 4 Permanent Harm, 5 Sentinel Event',
    monthlyReported: facts.monthly,
    recurringPatterns: facts.recurring.map((r) => ({
      category: r.category,
      subcategory: r.subcategory,
      count: r.count,
      highestSeverity: r.maxSeverity,
      topLocations: r.locations,
      topDepartments: r.departments,
      examples: r.incidents.slice(0, 3).map((i) => ({ number: i.incidentNumber, title: title(i.id, i.title), severity: i.severity })),
    })),
    recurrenceAfterClosure: facts.recurrenceAfterClosure.map((r) => ({
      incident: r.incident.incidentNumber,
      title: title(r.incident.id, r.incident.title),
      cameBackDaysAfterClosureOf: r.prior.incidentNumber,
      days: r.daysAfterClosure,
      category: r.category,
      subcategory: r.subcategory,
      department: r.department,
    })),
    hotspots: {
      departments: facts.hotspots.departments,
      locations: facts.hotspots.locations,
      weightedScoreMeans: 'sum of severity weights (1, 2, 5, 10, 20 for severity 1 to 5)',
    },
    openNow: {
      open: facts.totals.openNow,
      pastHodDeadline: facts.totals.overdueOpenNow,
      mostOverdue: facts.overdueIncidents.slice(0, 5).map((o) => ({
        number: o.incidentNumber,
        title: title(o.id, o.title),
        department: o.department,
        daysOverdue: o.daysOverdue,
      })),
    },
  };
};

export const writeNarrative = async (
  facts: InsightFacts,
  privateNamesById: Map<string, string[]>
): Promise<{ narrative: InsightNarrative; model: string }> => {
  const { value: raw, model } = await generateJson({
    system: SYSTEM_PROMPT,
    user: JSON.stringify(buildAiPayload(facts, privateNamesById)),
    schemaName: 'incident_insights',
    schema: RESPONSE_SCHEMA,
  });
  const parsed = narrativeSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error('The AI reply was not in the expected format');
  }
  return { narrative: parsed.data, model };
};
