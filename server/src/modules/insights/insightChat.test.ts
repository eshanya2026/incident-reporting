import { describe, expect, it } from 'vitest';
import { buildChatDataset, shiftOf } from './chatDataset.js';
import { citedIncidents, fixIncidentNumbers } from './insightChat.js';

const now = new Date('2026-11-15T06:00:00Z');
const dept = (name: string, id = name) => ({ _id: id, name });
const incident = (n: number, over: any = {}) => ({
  _id: `id${n}`,
  incidentNumber: `INC-2026-${String(n).padStart(6, '0')}`,
  title: `Incident ${n}`,
  description: 'A sufficiently detailed description of what happened.',
  immediateAction: 'Patient made safe',
  status: 'CLOSED',
  severity: 2,
  initialSeverity: 2,
  incidentDateTime: '2026-10-01T03:30:00Z', // 09:00 IST, Thursday
  reportedAt: '2026-10-01T06:30:00Z',
  closedAt: '2026-10-08T06:30:00Z',
  categoryId: { _id: 'cat', name: 'Medication Error', subcategories: [] },
  locationId: dept('ICU Bed 01', 'loc1'),
  departmentId: dept('ICU'),
  reportingDepartmentId: dept('ICU'),
  riskAssessment: { likelihood: 2, severity: 2, score: 4, band: 'LOW' },
  ...over,
});
const build = (incidents: any[], extra: any = {}, shareCaseText = false) =>
  buildChatDataset(
    { incidents, investigations: [], rcas: [], rcaMeetings: [], capas: [], allDepartments: [], ...extra },
    { now, shareCaseText, scope: { kind: 'HOSPITAL' } }
  );

describe('buildChatDataset', () => {
  it('derives reporting delay, lateness, shift and weekday in hospital time', () => {
    const r = build([incident(1, { reportedAt: '2026-10-02T06:30:00Z' })]).caseList.records[0];
    expect(r).toMatchObject({ reportDelayHours: 27, reportedLate: true, shift: 'Morning', weekday: 'Thu' });
  });

  it('records a severity change and who made it', () => {
    const r = build([incident(1, { initialSeverity: 1, severity: 3, assignedBy: { name: 'Dr. Anita' } })]).caseList.records[0];
    expect(r).toMatchObject({ severityReported: 1, severityFinal: 3, severityChangedBy: 'Dr. Anita' });
  });

  it('only includes written case details when sharing is switched on, and de-identifies them', () => {
    const capas = [{ incidentId: 'id1', capaNumber: 'CAPA-1', action: 'Retrain Ramesh on dose checks', status: 'EFFECTIVE' }];
    const inc = incident(1, { patient: { name: 'Ramesh' } });
    expect(build([inc], { capas }).caseList.records[0].capas[0].action).toBeUndefined();
    expect(build([inc], { capas }, true).caseList.records[0].capas[0].action).toBe('Retrain [name] on dose checks');
  });

  it('flags a missing RCA, missing data and impossible dates', () => {
    const r = build([incident(1, { requiresRca: true, immediateAction: '', closedAt: '2026-09-01T00:00:00Z' })]).caseList.records[0];
    expect(r.rca).toEqual({ status: 'MISSING' });
    expect(r.missingData).toContain('immediate action');
    expect(r.dateIssues).toContain('closed before it was reported');
  });

  it('notes when the person who closed it also investigated it', () => {
    const investigations = [{ incidentId: 'id1', departmentId: dept('ICU'), investigatorId: { _id: 'u1', name: 'Dr. X' }, status: 'COMPLETED' }];
    const r = build([incident(1, { closedBy: { _id: 'u1', name: 'Dr. X' } })], { investigations }).caseList.records[0];
    expect(r.closure?.closedByAlsoInvestigated).toBe(true);
  });

  it('counts complete aggregates and finds possible duplicates', () => {
    const d = build([incident(1), incident(2, { incidentDateTime: '2026-10-01T10:00:00Z' }), incident(3, { status: 'REJECTED' })]);
    expect(d.aggregates.rejected).toBe(1);
    expect(d.aggregates.bySeverityFinal['2 No Harm']).toBe(2);
    expect(d.possibleDuplicates[0].incidents).toEqual(['INC-2026-000001', 'INC-2026-000002']);
  });

  it('covers every incident from the first one, with yearly counts', () => {
    const d = build([
      incident(1),
      incident(2, { incidentDateTime: '2023-02-10T03:30:00Z', reportedAt: '2023-02-11T06:30:00Z' }),
      incident(3, { incidentDateTime: '2024-07-01T03:30:00Z', reportedAt: '2024-07-01T06:30:00Z' }),
    ]);
    expect(d.aggregates.coverage.firstReported).toBe('2023-02-11');
    expect(d.aggregates.coverage.firstOccurred).toBe('2023-02-10');
    expect(d.aggregates.byYearReported).toEqual({ '2023': 1, '2024': 1, '2026': 1 });
    expect(d.caseList.records).toHaveLength(3);
  });

  it('keeps patient names, UHIDs and descriptions out unless the asker may see them', () => {
    const withPatient = incident(1, { title: 'Mr. Sharma fell near bed', patient: { name: 'Mr. Ramesh Sharma', uhid: 'UH-778899' } });
    const hidden = build([withPatient]);
    const r0 = hidden.caseList.records[0] as any;
    expect(hidden.patientDetailsShared).toBe(false);
    expect(r0.patient).toBeUndefined();
    expect(r0.description).toBeUndefined();
    expect(JSON.stringify(hidden)).not.toMatch(/Sharma|UH-778899/);

    const shown = buildChatDataset(
      { incidents: [withPatient], investigations: [], rcas: [], rcaMeetings: [], capas: [], allDepartments: [] },
      { now, shareCaseText: false, scope: { kind: 'HOSPITAL' }, identify: true }
    );
    const r1 = shown.caseList.records[0] as any;
    expect(shown.patientDetailsShared).toBe(true);
    expect(r1.patient).toMatchObject({ name: 'Mr. Ramesh Sharma', uhid: 'UH-778899' });
    expect(r1.title).toBe('Mr. Sharma fell near bed');
    expect(r1.description).toContain('detailed description');
  });

  it('adds older incidents whose patient is named in the question, beyond the recent-records cap', () => {
    const many = Array.from({ length: 405 }, (_, k) => incident(k + 1, { patient: { name: `Patient ${k + 1}`, uhid: `UH-${100000 + k}` } }));
    many[404] = incident(405, { patient: { name: 'Mrs. Kamala Sharma', uhid: 'UH-555123' } });
    const ask = (question: string) =>
      buildChatDataset(
        { incidents: many, investigations: [], rcas: [], rcaMeetings: [], capas: [], allDepartments: [] },
        { now, shareCaseText: false, scope: { kind: 'HOSPITAL' }, identify: true, question }
      ).caseList.records.map((r: any) => r.no);
    expect(ask('What happened to Sharma last week?')).toContain('INC-2026-000405');
    expect(ask('Show the incident for UHID 555123')).toContain('INC-2026-000405');
    expect(ask('What happened last week?')).not.toContain('INC-2026-000405');
  });

  it('lists departments with no reports in the last six months (hospital scope)', () => {
    const d = build([incident(1)], { allDepartments: [{ id: 'ICU', name: 'ICU' }, { id: 'OT', name: 'Operation Theatre' }] });
    expect(d.aggregates.departmentsWithNoReportsInLast6Months).toEqual(['Operation Theatre']);
  });
});

describe('shiftOf', () => {
  it('maps hours to the assumed shifts', () => {
    expect([shiftOf(8), shiftOf(13), shiftOf(14), shiftOf(19), shiftOf(20), shiftOf(3)]).toEqual(['Morning', 'Morning', 'Evening', 'Evening', 'Night', 'Night']);
  });
});

describe('citedIncidents', () => {
  it("links only incident numbers that are in the asker's scope", () => {
    const answer = 'See INC-2026-000001 and INC-2026-000001 again, plus INC-2026-999999 from elsewhere.';
    expect(citedIncidents(answer, new Map([['INC-2026-000001', 'id1']]))).toEqual([{ number: 'INC-2026-000001', id: 'id1' }]);
  });
});

describe('fixIncidentNumbers', () => {
  it('restores dropped leading zeros so incident links work, and leaves correct numbers alone', () => {
    expect(fixIncidentNumbers('See INC-2026-00002 and INC-2026-000045, CAPA-2026-15.')).toBe('See INC-2026-000002 and INC-2026-000045, CAPA-2026-000015.');
  });
});
