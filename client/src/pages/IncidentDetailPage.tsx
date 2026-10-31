import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { ArrowLeft, Building, Calendar, Download, Loader2, MapPin, Tag, UserCheck, Users } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { toast } from '../store/useToastStore';
import { hasPermission, homePath, isWorkingDepartment } from '../lib/rbac';
import { PRIORITY_COLOR, PRIORITY_META, SEVERITY_META, WORKFLOW_STEPS } from '../lib/incidentMeta';
import { errorMessage } from '../lib/useAction';
import { Card, Field, Notice } from '../components/ui/primitives';
import { SeverityBadge, StatusBadge } from '../components/incident/Badges';
import WorkflowStepper from '../components/incident/WorkflowStepper';
import QualityTriagePanel from '../components/incident/detail/QualityTriagePanel';
import QualityReviewPanel from '../components/incident/detail/QualityReviewPanel';
import InvestigationSection from '../components/incident/detail/InvestigationSection';
import RcaSection from '../components/incident/detail/RcaSection';
import CapaSection from '../components/incident/detail/CapaSection';
import DepartmentComparisonSection from '../components/incident/detail/DepartmentComparisonSection';
import { HistorySection, ReportDetails } from '../components/incident/detail/ReportSections';
import { HodAssignedPanel, StaffResponsePanel, SubmitClosurePanel, WaitingNotice, RcaMeetingPanel } from '../components/incident/detail/WorkflowPanels';

const INVESTIGATION_STAGES = ['UNDER_INVESTIGATION', 'CAPA_IN_PROGRESS', 'PENDING_QUALITY_REVIEW', 'RCA_REQUESTED', 'CLOSED'];
const CAPA_STAGES = ['CAPA_IN_PROGRESS', 'PENDING_QUALITY_REVIEW', 'RCA_REQUESTED', 'CLOSED'];
const NOT_YET_ASSIGNED = ['SUBMITTED', 'INFO_REQUESTED', 'REJECTED'];

/** GET that returns null on 404 (record not created yet). */
const getOrNull = async (url: string) => {
  try {
    const res: any = await api.get(url);
    return res.data;
  } catch (err: any) {
    if (err?.code === 'NOT_FOUND' || err?.response?.status === 404) return null;
    throw err;
  }
};

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const incidentQuery = useQuery({ queryKey: ['incident', id], queryFn: () => api.get(`/incidents/${id}`), retry: false });
  const incident = (incidentQuery.data as any)?.data;
  const status: string = incident?.status;

  const timelineQuery = useQuery({ queryKey: ['timeline', id], queryFn: () => api.get(`/incidents/${id}/timeline`), enabled: Boolean(incident) });
  const investigationQuery = useQuery({
    queryKey: ['investigation', id],
    queryFn: () => getOrNull(`/incidents/${id}/investigation`),
    enabled: Boolean(incident) && hasPermission(user, 'investigation.read') && INVESTIGATION_STAGES.includes(status),
  });
  const rcaQuery = useQuery({
    queryKey: ['rca', id],
    queryFn: () => getOrNull(`/incidents/${id}/rca`),
    enabled: Boolean(incident) && hasPermission(user, 'rca.read') && INVESTIGATION_STAGES.includes(status),
  });
  const capasQuery = useQuery({
    queryKey: ['capas', id],
    queryFn: () => api.get(`/incidents/${id}/capas`),
    enabled: Boolean(incident) && hasPermission(user, 'capa.read') && CAPA_STAGES.includes(status),
  });

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate(homePath(user)));

  const [downloadingReport, setDownloadingReport] = useState(false);
  const handleDownloadReport = async () => {
    setDownloadingReport(true);
    try {
      const blob = (await api.get(`/incidents/${id}/report`, { responseType: 'blob' })) as unknown as Blob;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${incident.incidentNumber}-final-report.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      let message = 'Could not download the report';
      const data = err?.response?.data;
      if (data instanceof Blob) {
        try {
          message = JSON.parse(await data.text())?.error?.message || message;
        } catch {
          // body wasn't JSON — keep the generic message
        }
      } else {
        message = errorMessage(err, message);
      }
      toast.error(message);
    } finally {
      setDownloadingReport(false);
    }
  };

  if (incidentQuery.isLoading) {
    return <div className="p-8 text-center text-xs text-clinicalText-secondary">Loading incident…</div>;
  }
  if (!incident) {
    return (
      <div className="max-w-xl mx-auto mt-8">
        <Notice tone="error">{errorMessage(incidentQuery.error, 'Incident not found.')}</Notice>
      </div>
    );
  }

  const actions: string[] = incident.availableActions || [];
  const investigation = investigationQuery.data;
  const rca = rcaQuery.data;
  const capas: any[] = (capasQuery.data as any)?.data || [];

  const isStaff = hasPermission(user, 'incident.read_own') && !hasPermission(user, 'incident.read_all');
  // Responsible department, or a department Quality marked as involved — both co-work the
  // investigation and CAPA (see incidentAccess.ts canWorkOnIncident on the server).
  const canWorkIncident = hasPermission(user, 'investigation.write') && isWorkingDepartment(user, incident);
  const workEditable = canWorkIncident && ['UNDER_INVESTIGATION', 'CAPA_IN_PROGRESS'].includes(status);
  const capaEditable = canWorkIncident && status === 'CAPA_IN_PROGRESS';

  const isRcaRequested = status === 'RCA_REQUESTED';
  // Quality scheduled the meeting and uploads its report; the RCA Head just views the meeting
  // details and investigates — both see RcaMeetingPanel, no one else needs to.
  const canPerformRca = (user?.roles || []).includes('RCA_HEAD') || (user?.roles || []).includes('QUALITY');
  // RcaMeetingPanel replaces this 5-Why form during RCA_REQUESTED; this form stays only for the
  // HOD's investigation-stage RCA (severity 4–5).
  const rcaEditable = workEditable && incident.requiresRca;

  const showSubmit =
    actions.includes('SUBMIT_CLOSURE') &&
    (status === 'CAPA_IN_PROGRESS' || (!incident.requiresCapa && investigation?.status === 'COMPLETED'));
  const hasActionPanel =
    actions.includes('ASSIGN') ||
    actions.includes('RESPOND_INFO') ||
    actions.includes('START_INVESTIGATION') ||
    showSubmit ||
    actions.includes('REVIEW_ACCEPT') ||
    workEditable ||
    (isRcaRequested && canPerformRca);

  // Quality/Admin/RCA Head: not working the incident directly, so they get the side-by-side
  // comparison of every department's investigation and CAPA instead of a single department's view.
  const canReviewComparison = !canWorkIncident && hasPermission(user, 'investigation.read') && hasPermission(user, 'capa.read');

  const confirmedSeverity = !isStaff && !NOT_YET_ASSIGNED.includes(status);
  const severityChanged = confirmedSeverity && incident.initialSeverity && incident.initialSeverity !== incident.severity;

  return (
    <div className="space-y-6 text-clinicalText-primary">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={back}
          className="inline-flex items-center space-x-2 text-xs font-semibold text-[#64748B] hover:text-[#5C1A22] bg-white hover:bg-[#FAF3EC] border border-clinicalBorder px-4 py-2 rounded-xl shadow-xs transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        {status === 'CLOSED' && (
          <button
            onClick={handleDownloadReport}
            disabled={downloadingReport}
            className="inline-flex items-center space-x-2 text-xs font-semibold text-white bg-gradient-to-r from-[#5C1A22] via-[#6B1F29] to-[#7A2430] hover:from-[#431219] hover:via-[#5C1A22] hover:to-[#4F161C] disabled:opacity-60 px-4 py-2 rounded-xl shadow-button-red transition cursor-pointer"
            title="Download the final report as a single PDF, including attached files"
          >
            {downloadingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>{downloadingReport ? 'Preparing report…' : 'Download Final Report'}</span>
          </button>
        )}
      </div>

      {/* Header - dark theme */}
      <div className="hero-banner p-6 rounded-2xl space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-lg font-black text-[#D4A954]">{incident.incidentNumber}</span>
          <StatusBadge status={status} />
          {confirmedSeverity ? (
            <SeverityBadge severity={incident.severity} />
          ) : (
            <SeverityBadge severity={incident.initialSeverity ?? incident.severity} provisional />
          )}
          {severityChanged && (
            <span className="text-[12.5px] text-slate-400">reported as {SEVERITY_META[incident.initialSeverity]?.short}</span>
          )}
        </div>
        <h2 className="text-xl font-bold text-white">{incident.title}</h2>
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300/80">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-[#D4A954]" /> Occurred {dayjs(incident.incidentDateTime).format('DD MMM YYYY HH:mm')}
          </span>
          <span className="flex items-center gap-1">
            <Building className="w-3.5 h-3.5 text-[#D4A954]" /> {incident.occurredInDepartmentId?.name || '—'}
          </span>
          <span className="flex items-center gap-1">
            <Tag className="w-3.5 h-3.5 text-[#D4A954]" /> {incident.categoryId?.name}
          </span>
          {(incident.floor || incident.zone || incident.locationId?.floor || incident.locationId?.name) && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#D4A954]" />
              <span>
                {incident.floor || incident.locationId?.floor || ''}
                {(incident.floor || incident.locationId?.floor) && (incident.zone || incident.locationId?.zone) ? ' • ' : ''}
                {incident.zone || incident.locationId?.zone || ''}
                {incident.locationId?.name && !incident.locationId.code?.startsWith('FL') ? ` (${incident.locationId.name})` : ''}
              </span>
            </span>
          )}
          {incident.reportedBy?.name && (
            <span className="flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-[#D4A954]" /> Reported by {isStaff ? 'you' : incident.reportedBy.name}
            </span>
          )}
        </div>
      </div>

      <WorkflowStepper status={status} />

      <Card title="People" icon={Users}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3">
          <Field label="Reported by">
            {isStaff ? 'You' : incident.reportedBy?.name}
            {incident.reportingDepartmentId?.name ? ` — ${incident.reportingDepartmentId.name}` : ''}
          </Field>
          <Field label="Responsible department">
            {incident.departmentId?.name ? incident.departmentId.name : 'Not assigned yet'}
          </Field>
          {!isStaff && incident.assignedHod?.name && <Field label="HOD">{incident.assignedHod.name}</Field>}
          {!isStaff && incident.rcaHeadId?.name && (
            <Field label="RCA Head">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200 text-[11.5px] font-semibold">
                {incident.rcaHeadId.name}
                {incident.rcaHeadId.designation ? ` (${incident.rcaHeadId.designation})` : ''}
              </span>
            </Field>
          )}
          {!isStaff && incident.priority && (
            <Field label="Priority">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11.5px] border ${PRIORITY_META[incident.priority as keyof typeof PRIORITY_META]?.classes || ''}`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: PRIORITY_COLOR[incident.priority as keyof typeof PRIORITY_COLOR] }}
                />
                {PRIORITY_META[incident.priority as keyof typeof PRIORITY_META]?.label || incident.priority}
              </span>
              {incident.actionDueAt && status !== 'CLOSED' && (
                <p className={`mt-1 text-[12px] font-medium ${dayjs().isAfter(dayjs(incident.actionDueAt)) ? 'text-red-600' : 'text-clinicalText-secondary'}`}>
                  {dayjs().isAfter(dayjs(incident.actionDueAt))
                    ? `Overdue — was due ${dayjs(incident.actionDueAt).format('DD MMM, HH:mm')}`
                    : `Due by ${dayjs(incident.actionDueAt).format('DD MMM, HH:mm')}`}
                </p>
              )}
            </Field>
          )}
          {!isStaff && incident.notifiedDepartmentIds?.length > 0 && (
            <Field label="Involved departments">
              <div className="flex flex-wrap gap-1 mt-0.5">
                {incident.notifiedDepartmentIds.map((d: any) => (
                  <span key={d._id || d.id || d} className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-clinicalText-primary text-[11.5px] font-medium">
                    {d.name || d}
                  </span>
                ))}
              </div>
            </Field>
          )}
          {!isStaff && incident.intimatedUserIds?.length > 0 && (
            <Field label="Intimated to">
              <div className="flex flex-wrap gap-1 mt-0.5">
                {incident.intimatedUserIds.map((u: any) => (
                  <span key={u._id || u.id || u} className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200 text-[11.5px] font-medium">
                    {u.name || u.email || u}
                    {u.designation ? ` (${u.designation})` : ''}
                  </span>
                ))}
              </div>
            </Field>
          )}
          {!isStaff && incident.assignedAt && (
            <Field label="Assigned">
              {dayjs(incident.assignedAt).format('DD MMM YYYY HH:mm')}
              {incident.assignedBy?.name ? ` by ${incident.assignedBy.name}` : ''}
            </Field>
          )}
          {confirmedSeverity && (
            <Field label="Requirements">
              {incident.requiresRca ? 'RCA and CAPA' : incident.requiresCapa ? 'CAPA' : 'Investigation only'}
            </Field>
          )}
        </div>

        {status !== 'REJECTED' && (
          <div className="mt-4 pt-4 border-t border-clinicalBorder flex flex-wrap gap-x-6 gap-y-2">
            {WORKFLOW_STEPS.map((step) => {
              const at = ((timelineQuery.data as any)?.data || []).find((e: any) => step.statuses.includes(e.toStatus))?.at;
              return (
                <div key={step.key} className="text-[11.5px]">
                  <span className="text-clinicalText-muted">{step.label}: </span>
                  <span className={at ? 'font-semibold text-clinicalText-primary' : 'text-clinicalText-muted'}>
                    {at ? dayjs(at).format('DD MMM, HH:mm') : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="space-y-6">
        {/* What was reported, first */}
        <ReportDetails incident={incident} />

        {/* What this user can do now */}
        {actions.includes('ASSIGN') && <QualityTriagePanel incident={incident} />}
        {actions.includes('RESPOND_INFO') && <StaffResponsePanel incident={incident} />}
        {actions.includes('START_INVESTIGATION') && <HodAssignedPanel incident={incident} />}
        {(isRcaRequested || incident.rcaSubmittedAt) && canPerformRca && <RcaMeetingPanel incident={incident} />}
        {!hasActionPanel && <WaitingNotice incident={incident} isStaff={isStaff} />}

        {/* Root Cause Analysis section */}
        {(incident.requiresRca || rca) && (
          <RcaSection incident={incident} rca={rca} editable={rcaEditable} />
        )}

        {/* Investigation findings */}
        <InvestigationSection incident={incident} investigation={investigation} rca={rca} editable={workEditable} />

        {/* CAPA actions */}
        {CAPA_STAGES.includes(status) && hasPermission(user, 'capa.read') && (
          <CapaSection incident={incident} capas={capas} editable={capaEditable} />
        )}
        {showSubmit && <SubmitClosurePanel incident={incident} investigation={investigation} rca={rca} capas={capas} />}

        {/* Quality's comparison of every involved department's investigation and CAPA */}
        {canReviewComparison && INVESTIGATION_STAGES.includes(status) && (
          <DepartmentComparisonSection incident={incident} capas={capas} />
        )}

        {/* Quality's decision, after seeing the investigation, CAPA and comparison above */}
        {actions.includes('REVIEW_ACCEPT') && <QualityReviewPanel incident={incident} capas={capas} />}

        <HistorySection incident={incident} />
      </div>
    </div>
  );
}
