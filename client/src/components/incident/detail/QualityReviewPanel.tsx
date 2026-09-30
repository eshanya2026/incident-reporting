import { useState, useEffect } from 'react';
import { ClipboardCheck, CheckCircle2, Undo2, GitBranch, AlertCircle, UserCheck } from 'lucide-react';
import dayjs from 'dayjs';
import { api } from '../../../lib/api';
import { useAction } from '../../../lib/useAction';
import { Button, Card, Notice, inputClass, labelClass } from '../../ui/primitives';

interface QualityMemberOption {
  _id: string;
  name: string;
  designation?: string;
  employeeId?: string;
}

/**
 * Quality's review panel:
 * - If satisfied / okay: close the incident with closure remarks.
 * - If not satisfied: ask for RCA and send to Quality Members (select member & provide remarks).
 * - Or send back to HOD for CAPA rework.
 */
export default function QualityReviewPanel({ incident, capas }: { incident: any; capas: any[] }) {
  const { run, busy, error } = useAction(incident._id);
  const [reviewMode, setReviewMode] = useState<'CLOSE' | 'REQUEST_RCA' | 'RETURN_HOD'>('CLOSE');
  const [remarks, setRemarks] = useState('');
  const [rcaRemarks, setRcaRemarks] = useState('');
  const [selectedQualityMemberId, setSelectedQualityMemberId] = useState('');
  const [qualityMembers, setQualityMembers] = useState<QualityMemberOption[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    setLoadingMembers(true);
    api
      .get('/incidents/quality-members')
      .then((res: any) => {
        const list = res?.data || [];
        setQualityMembers(list);
      })
      .catch(() => undefined)
      .finally(() => setLoadingMembers(false));
  }, []);

  const submitClose = () =>
    run(() =>
      api.post(`/incidents/${incident._id}/review`, {
        decision: 'ACCEPT',
        remarks,
      })
    );

  const submitReturnHod = () =>
    run(() =>
      api.post(`/incidents/${incident._id}/review`, {
        decision: 'RETURN',
        remarks,
      })
    );

  const submitRequestRca = () =>
    run(() =>
      api.post(`/incidents/${incident._id}/request-rca`, {
        remarks: rcaRemarks,
        qualityMemberId: selectedQualityMemberId || undefined,
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
              RCA reported by {incident.rcaSubmittedBy?.name || 'Quality Member'}
              {incident.rcaSubmittedAt ? ` on ${dayjs(incident.rcaSubmittedAt).format('DD MMM YYYY HH:mm')}` : ''}
            </span>
          </div>
          {incident.rcaSubmissionRemarks && (
            <p className="pl-6 text-[12.5px] text-purple-900/90 whitespace-pre-wrap">
              <strong>Quality Member remarks:</strong> {incident.rcaSubmissionRemarks}
            </p>
          )}
        </div>
      )}

      {/* Decision choice buttons */}
      <div className="space-y-1.5">
        <label className={labelClass}>Review assessment</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
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
              Require 5-Why RCA. Send to Quality members to investigate.
            </p>
          </button>

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
        </div>
      </div>

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

          <div className="pt-1">
            <Button
              variant="success"
              busy={busy}
              disabled={!remarks.trim()}
              onClick={submitClose}
            >
              <CheckCircle2 className="w-4 h-4" /> Close incident
            </Button>
          </div>
        </div>
      )}

      {/* MODE 2: NOT SATISFIED -> ASK FOR RCA AND SEND TO QUALITY MEMBERS */}
      {reviewMode === 'REQUEST_RCA' && (
        <div className="space-y-4 pt-1">
          <Notice tone="warning">
            <strong>Assign for Root Cause Analysis:</strong> Quality members will conduct the 5-Why RCA and submit their findings back to Quality for final review.
          </Notice>

          <div>
            <label className={labelClass}>Assign to Quality Member</label>
            <select
              value={selectedQualityMemberId}
              onChange={(e) => setSelectedQualityMemberId(e.target.value)}
              className={inputClass}
            >
              <option value="">Any Quality Member / Committee Team</option>
              {qualityMembers.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name} {m.designation ? `(${m.designation})` : ''} {m.employeeId ? `· ${m.employeeId}` : ''}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[12.5px] text-clinicalText-secondary">
              Select a specific Quality Member or leave unassigned to notify the whole Quality Committee.
            </p>
          </div>

          <div>
            <label className={labelClass}>Reason for requesting RCA *</label>
            <textarea
              rows={3}
              value={rcaRemarks}
              onChange={(e) => setRcaRemarks(e.target.value)}
              placeholder="Why is RCA needed? Specify what findings require deeper 5-Why analysis by the Quality member..."
              className={inputClass}
            />
          </div>

          <div className="pt-1">
            <Button
              variant="primary"
              busy={busy}
              disabled={!rcaRemarks.trim()}
              onClick={submitRequestRca}
              className="bg-purple-700 hover:bg-purple-800 text-white"
            >
              <GitBranch className="w-4 h-4" /> Request RCA & Send to Quality Member
            </Button>
          </div>
        </div>
      )}

      {/* MODE 3: RETURN TO HOD */}
      {reviewMode === 'RETURN_HOD' && (
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
            <Button
              variant="danger"
              busy={busy}
              disabled={!remarks.trim()}
              onClick={submitReturnHod}
            >
              <Undo2 className="w-4 h-4" /> Send back to HOD
            </Button>
          </div>
        </div>
      )}

      {error && <Notice tone="error">{error}</Notice>}
    </Card>
  );
}
