import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, CheckCircle2, Undo2, GitBranch, AlertCircle, UserCheck, X, Calendar, Clock, MapPin, Gauge } from 'lucide-react';
import dayjs from 'dayjs';
import { api } from '../../../lib/api';
import { useAction } from '../../../lib/useAction';
import { idOf, LIKELIHOOD_LABELS, RISK_SEVERITY_LABELS, RISK_BAND_META, riskBandFor } from '../../../lib/incidentMeta';
import { Button, Card, Notice, inputClass, labelClass, IconInput } from '../../ui/primitives';
import { SearchableSelect } from '../../ui/SearchableSelect';

interface RcaHeadOption {
  _id: string;
  name: string;
  designation?: string;
  employeeId?: string;
}

/**
 * Quality's review panel:
 * - If satisfied / okay: close the incident with closure remarks.
 * - If not satisfied: ask for an RCA — assign an RCA Head and schedule the meeting with the
 *   involved HODs right here. The RCA Head only investigates and hands their findings to Quality
 *   outside the system; Quality uploads the report afterward (see WorkflowPanels.tsx's
 *   RcaMeetingPanel) and closes the incident the normal way.
 * - Or send back to HOD for CAPA rework — for a single department here; for a multi-department
 *   incident, each department is returned individually from its own card in the comparison above
 *   (see DepartmentComparisonSection.tsx), not from this panel.
 */
export default function QualityReviewPanel({ incident, capas }: { incident: any; capas: any[] }) {
  const { run, busy, error } = useAction(incident._id);
  const [reviewMode, setReviewMode] = useState<'CLOSE' | 'REQUEST_RCA' | 'RETURN_HOD'>('CLOSE');
  const [remarks, setRemarks] = useState('');
  const [riskLikelihood, setRiskLikelihood] = useState('');
  const [riskSeverity, setRiskSeverity] = useState('');
  const [riskRationale, setRiskRationale] = useState('');
  const [rcaRemarks, setRcaRemarks] = useState('');
  const [selectedRcaHeadId, setSelectedRcaHeadId] = useState('');
  const [rcaHeads, setRcaHeads] = useState<RcaHeadOption[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingLocation, setMeetingLocation] = useState('');
  const [extraHodIds, setExtraHodIds] = useState<string[]>([]);
  const [extraIntimationIds, setExtraIntimationIds] = useState<string[]>([]);

  const multiDept = (incident.notifiedDepartmentIds?.length || 0) > 0;
  // An RCA meeting already happened for this review cycle — asking for another, or sending it
  // back to the HOD, doesn't apply anymore; only closing (or re-requesting later if needed) does.
  const hasRcaReport = Boolean(incident.rcaSubmittedAt);

  useEffect(() => {
    if (hasRcaReport) setReviewMode('CLOSE');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRcaReport]);

  useEffect(() => {
    setLoadingMembers(true);
    api
      .get('/incidents/rca-heads')
      .then((res: any) => {
        const list = res?.data || [];
        setRcaHeads(list);
      })
      .catch(() => undefined)
      .finally(() => setLoadingMembers(false));
  }, []);

  const { data: hodData } = useQuery({
    queryKey: ['users', 'HOD'],
    queryFn: () => api.get('/users?status=ACTIVE&limit=200&role=HOD'),
    enabled: reviewMode === 'REQUEST_RCA',
  });
  const { data: intimationData } = useQuery({
    queryKey: ['users', 'INTIMATION_MEMBER'],
    queryFn: () => api.get('/users?status=ACTIVE&limit=200&role=INTIMATION_MEMBER'),
    enabled: reviewMode === 'REQUEST_RCA',
  });
  const hodOptions: any[] = (hodData as any)?.data || [];
  const intimationOptions: any[] = (intimationData as any)?.data || [];

  const likelihoodNum = Number(riskLikelihood) || 0;
  const severityNum = Number(riskSeverity) || 0;
  const riskScorePreview = likelihoodNum && severityNum ? likelihoodNum * severityNum : 0;
  const riskRationaleNeeded = severityNum >= 4;
  const riskReady = Boolean(likelihoodNum && severityNum && (!riskRationaleNeeded || riskRationale.trim()));

  const submitClose = () =>
    run(() =>
      api.post(`/incidents/${incident._id}/review`, {
        decision: 'ACCEPT',
        remarks,
        riskLikelihood: likelihoodNum,
        riskSeverity: severityNum,
        riskRationale: riskRationale.trim() || undefined,
      })
    );

  const submitReturnHod = () =>
    run(() =>
      api.post(`/incidents/${incident._id}/review`, {
        decision: 'RETURN',
        remarks,
      })
    );

  const meetingScheduled = Boolean(meetingDate && meetingTime && meetingLocation.trim());

  const submitRequestRca = () =>
    run(() =>
      api.post(`/incidents/${incident._id}/request-rca`, {
        remarks: rcaRemarks,
        rcaHeadId: selectedRcaHeadId || undefined,
        proposedMeetingAt: new Date(`${meetingDate}T${meetingTime}`).toISOString(),
        proposedLocation: meetingLocation.trim(),
        additionalAttendeeIds: [...extraHodIds, ...extraIntimationIds],
      })
    );

  return (
    <Card title="Quality review" icon={ClipboardCheck} tone="action">
      {incident.closureSubmission && (
        <Notice>
          <strong>HOD's closure summary{incident.closureSubmission.by?.name ? ` (${incident.closureSubmission.by.name})` : ''}:</strong>{' '}
          {incident.closureSubmission.summary}
        </Notice>
      )}

      {incident.rcaSubmittedAt && (
        <div className="p-3.5 rounded-xl bg-purple-50/80 border border-purple-200 text-xs text-purple-950 space-y-1">
          <div className="flex items-center gap-2 font-bold text-purple-900">
            <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
            <span>
              RCA meeting report uploaded{incident.rcaSubmittedBy?.name ? ` by ${incident.rcaSubmittedBy.name}` : ''}
              {incident.rcaSubmittedAt ? ` on ${dayjs(incident.rcaSubmittedAt).format('DD MMM YYYY HH:mm')}` : ''}
            </span>
          </div>
          {incident.rcaSubmissionRemarks && (
            <p className="pl-6 text-[12.5px] text-purple-900/90 whitespace-pre-wrap">
              <strong>Summary:</strong> {incident.rcaSubmissionRemarks}
            </p>
          )}
        </div>
      )}

      {/* Decision choice buttons */}
      {hasRcaReport ? (
        <p className="text-[12.5px] text-clinicalText-secondary">An RCA meeting was already held for this review.</p>
      ) : (
        <div className="space-y-1.5">
          <label className={labelClass}>Review assessment</label>
          <div className={`grid grid-cols-1 gap-2.5 ${multiDept ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
            <button
              type="button"
              onClick={() => setReviewMode('CLOSE')}
              className={`p-3 rounded-xl border text-left cursor-pointer transition flex flex-col gap-1 ${
                reviewMode === 'CLOSE'
                  ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-950'
                  : 'bg-white hover:bg-slate-50 border-clinicalBorder text-clinicalText-secondary'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs">
                <CheckCircle2 className={`w-4 h-4 ${reviewMode === 'CLOSE' ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span className={reviewMode === 'CLOSE' ? 'text-emerald-900' : 'text-clinicalText-primary'}>
                  Satisfied — Close Incident
                </span>
              </div>
              <p className="text-[11.5px] leading-tight text-clinicalText-secondary">
                Investigation & actions are okay. Close with final remarks.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setReviewMode('REQUEST_RCA')}
              className={`p-3 rounded-xl border text-left cursor-pointer transition flex flex-col gap-1 ${
                reviewMode === 'REQUEST_RCA'
                  ? 'bg-purple-50/80 border-purple-500 ring-2 ring-purple-500/20 text-purple-950'
                  : 'bg-white hover:bg-slate-50 border-clinicalBorder text-clinicalText-secondary'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs">
                <GitBranch className={`w-4 h-4 ${reviewMode === 'REQUEST_RCA' ? 'text-purple-600' : 'text-slate-400'}`} />
                <span className={reviewMode === 'REQUEST_RCA' ? 'text-purple-900' : 'text-clinicalText-primary'}>
                  Not Satisfied — Ask for RCA
                </span>
              </div>
              <p className="text-[11.5px] leading-tight text-clinicalText-secondary">
                Schedule a meeting and assign an RCA Head to investigate.
              </p>
            </button>

            {!multiDept && (
              <button
                type="button"
                onClick={() => setReviewMode('RETURN_HOD')}
                className={`p-3 rounded-xl border text-left cursor-pointer transition flex flex-col gap-1 ${
                  reviewMode === 'RETURN_HOD'
                    ? 'bg-red-50/80 border-red-500 ring-2 ring-red-500/20 text-red-950'
                    : 'bg-white hover:bg-slate-50 border-clinicalBorder text-clinicalText-secondary'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs">
                  <Undo2 className={`w-4 h-4 ${reviewMode === 'RETURN_HOD' ? 'text-red-600' : 'text-slate-400'}`} />
                  <span className={reviewMode === 'RETURN_HOD' ? 'text-red-900' : 'text-clinicalText-primary'}>
                    Return to HOD
                  </span>
                </div>
                <p className="text-[11.5px] leading-tight text-clinicalText-secondary">
                  Corrective actions need revision by the department HOD.
                </p>
              </button>
            )}
          </div>
          {multiDept && (
            <p className="text-[12px] text-clinicalText-secondary">
              To send a specific department back for rework, use "Return to HOD" on that department's card in the comparison above.
            </p>
          )}
        </div>
      )}

      {/* MODE 1: SATISFIED -> CLOSE */}
      {reviewMode === 'CLOSE' && (
        <div className="space-y-4 pt-1">
          <div>
            <label className={labelClass}>Closure remarks *</label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Provide final closure remarks and verification summary..."
              className={inputClass}
            />
            <p className="mt-1 text-[12.5px] text-clinicalText-secondary">
              These closure remarks are permanently recorded and visible to the reporting staff and department.
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-clinicalBorder bg-slate-50/60 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-clinicalText-primary">
              <Gauge className="w-4 h-4 text-maroon-700" /> Risk rating (required to close)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Likelihood of recurrence *</label>
                <select value={riskLikelihood} onChange={(e) => setRiskLikelihood(e.target.value)} className={inputClass}>
                  <option value="">Select...</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} — {LIKELIHOOD_LABELS[n]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Credible severity if it recurs *</label>
                <select value={riskSeverity} onChange={(e) => setRiskSeverity(e.target.value)} className={inputClass}>
                  <option value="">Select...</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} — {RISK_SEVERITY_LABELS[n]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {riskScorePreview > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-clinicalText-secondary">Risk score:</span>
                <span className="font-bold text-clinicalText-primary">{riskScorePreview}/25</span>
                <span className={`px-2 py-0.5 rounded-full border text-[11.5px] ${RISK_BAND_META[riskBandFor(riskScorePreview)].classes}`}>
                  {RISK_BAND_META[riskBandFor(riskScorePreview)].label}
                </span>
              </div>
            )}

            {riskRationaleNeeded && (
              <div>
                <label className={labelClass}>Rationale (required for severity 4–5) *</label>
                <textarea
                  rows={2}
                  value={riskRationale}
                  onChange={(e) => setRiskRationale(e.target.value)}
                  placeholder="Why this severity is credible if the event recurs..."
                  className={inputClass}
                />
              </div>
            )}
          </div>

          <div className="pt-1">
            <Button
              variant="success"
              busy={busy}
              disabled={!remarks.trim() || !riskReady}
              onClick={submitClose}
            >
              <CheckCircle2 className="w-4 h-4" /> Close incident
            </Button>
          </div>
        </div>
      )}

      {/* MODE 2: NOT SATISFIED -> ASK FOR RCA AND ASSIGN AN RCA HEAD */}
      {reviewMode === 'REQUEST_RCA' && (
        <div className="space-y-4 pt-1">
          <Notice tone="warning">
            <strong>Request a Root Cause Analysis:</strong> schedule the meeting below and assign an RCA Head to investigate. They'll hand their findings to you after the meeting — upload the report here when they do, then close the incident as usual.
          </Notice>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Assign to RCA Head</label>
              <select
                value={selectedRcaHeadId}
                onChange={(e) => setSelectedRcaHeadId(e.target.value)}
                className={inputClass}
              >
                <option value="">Any RCA Head</option>
                {rcaHeads.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.name} {m.designation ? `(${m.designation})` : ''} {m.employeeId ? `· ${m.employeeId}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Invite additional HODs (optional)</label>
              <SearchableSelect
                containerClassName="block w-full"
                value=""
                onChange={(addedId) => {
                  if (addedId && !extraHodIds.includes(addedId)) setExtraHodIds((prev) => [...prev, addedId]);
                }}
                options={[
                  { value: '', label: 'Add HOD...' },
                  ...hodOptions
                    .filter((u) => !extraHodIds.includes(u._id))
                    .map((u) => ({
                      value: u._id,
                      label: `${u.name}${u.departmentId?.name ? ` (${u.departmentId.name})` : ''}`,
                      group: u.departmentId?.name || 'HOD',
                    })),
                ]}
                searchPlaceholder="Search HODs..."
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Invite Intimation Members (optional)</label>
              <SearchableSelect
                containerClassName="block w-full"
                value=""
                onChange={(addedId) => {
                  if (addedId && !extraIntimationIds.includes(addedId)) setExtraIntimationIds((prev) => [...prev, addedId]);
                }}
                options={[
                  { value: '', label: 'Add Intimation Member...' },
                  ...intimationOptions
                    .filter((u) => !extraIntimationIds.includes(u._id))
                    .map((u) => ({
                      value: u._id,
                      label: `${u.name}${u.departmentId?.name ? ` (${u.departmentId.name})` : ''}`,
                      group: u.departmentId?.name || 'Intimation Member',
                    })),
                ]}
                searchPlaceholder="Search Intimation Members..."
                className={inputClass}
              />
            </div>
          </div>
          <p className="-mt-2 text-[12.5px] text-clinicalText-secondary">
            Select a specific RCA Head or leave unassigned to notify every RCA Head.
          </p>

          {(extraHodIds.length > 0 || extraIntimationIds.length > 0) && (
            <div className="flex flex-wrap gap-1.5 -mt-2">
              {[...extraHodIds, ...extraIntimationIds].map((uId) => {
                const userObj = [...hodOptions, ...intimationOptions].find((u) => idOf(u) === uId);
                const isHod = extraHodIds.includes(uId);
                return (
                  <span key={uId} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-slate-100 text-slate-800">
                    {userObj?.name || 'User'}
                    <button
                      type="button"
                      onClick={() =>
                        isHod
                          ? setExtraHodIds((prev) => prev.filter((id) => id !== uId))
                          : setExtraIntimationIds((prev) => prev.filter((id) => id !== uId))
                      }
                      className="text-slate-400 hover:text-red-600 cursor-pointer"
                      title="Remove"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Meeting date *</label>
              <IconInput icon={Calendar} type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Meeting time *</label>
              <IconInput icon={Clock} type="time" value={meetingTime} onChange={(e) => setMeetingTime(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Location *</label>
              <IconInput
                icon={MapPin}
                value={meetingLocation}
                onChange={(e) => setMeetingLocation(e.target.value)}
                placeholder="e.g. Quality Office, Admin Block"
              />
            </div>
          </div>
          <p className="-mt-2 text-[12.5px] text-clinicalText-secondary">
            Attendees (HODs, RCA Head, you) are WhatsApp-notified as soon as you submit this request.
          </p>

          <div>
            <label className={labelClass}>Reason for requesting RCA *</label>
            <textarea
              rows={3}
              value={rcaRemarks}
              onChange={(e) => setRcaRemarks(e.target.value)}
              placeholder="Why is an RCA meeting needed? Specify what the meeting should dig into..."
              className={inputClass}
            />
          </div>

          <div className="pt-1">
            <Button
              variant="primary"
              busy={busy}
              disabled={!rcaRemarks.trim() || !meetingScheduled}
              onClick={submitRequestRca}
              className="bg-purple-700 hover:bg-purple-800 text-white"
            >
              <GitBranch className="w-4 h-4" /> Request RCA & Schedule Meeting
            </Button>
          </div>
        </div>
      )}

      {/* MODE 3: RETURN TO HOD (single-department incidents only — see note above for multi-department) */}
      {reviewMode === 'RETURN_HOD' && !multiDept && (
        <div className="space-y-4 pt-1">
          <div>
            <label className={labelClass}>Remarks for the HOD *</label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Explain why the report is returned and what corrections are required from the department..."
              className={inputClass}
            />
            <p className="mt-1 text-[12.5px] text-clinicalText-secondary">
              The incident will be returned to the responsible department's HOD with these remarks.
            </p>
          </div>

          <div className="pt-1">
            <Button variant="danger" busy={busy} disabled={!remarks.trim()} onClick={submitReturnHod}>
              <Undo2 className="w-4 h-4" /> Send back to HOD
            </Button>
          </div>
        </div>
      )}

      {error && <Notice tone="error">{error}</Notice>}
    </Card>
  );
}
