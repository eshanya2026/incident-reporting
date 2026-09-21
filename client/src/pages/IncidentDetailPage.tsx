import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { ArrowLeft, Building, Calendar, MapPin, Tag, UserCheck, Users } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { hasPermission, homePath, isReceivingDepartment } from '../lib/rbac';
import { SEVERITY_META } from '../lib/incidentMeta';
import { errorMessage } from '../lib/useAction';
import { Card, Field, Notice } from '../components/ui/primitives';
import { SeverityBadge, StatusBadge } from '../components/incident/Badges';
import WorkflowStepper from '../components/incident/WorkflowStepper';
import Timeline from '../components/incident/Timeline';
import QualityTriagePanel from '../components/incident/detail/QualityTriagePanel';
import QualityReviewPanel from '../components/incident/detail/QualityReviewPanel';
import InvestigationSection from '../components/incident/detail/InvestigationSection';
import RcaSection from '../components/incident/detail/RcaSection';
import CapaSection from '../components/incident/detail/CapaSection';
import { HistorySection, ReportDetails } from '../components/incident/detail/ReportSections';
import { HodAssignedPanel, StaffResponsePanel, SubmitClosurePanel, WaitingNotice } from '../components/incident/detail/WorkflowPanels';

const INVESTIGATION_STAGES = ['UNDER_INVESTIGATION', 'CAPA_IN_PROGRESS', 'PENDING_QUALITY_REVIEW', 'CLOSED'];
const CAPA_STAGES = ['CAPA_IN_PROGRESS', 'PENDING_QUALITY_REVIEW', 'CLOSED'];
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
  const isResponsibleHod = hasPermission(user, 'investigation.write') && isReceivingDepartment(user, incident);
  const workEditable = isResponsibleHod && ['UNDER_INVESTIGATION', 'CAPA_IN_PROGRESS'].includes(status);
  const capaEditable = isResponsibleHod && status === 'CAPA_IN_PROGRESS';

  const showSubmit =
    actions.includes('SUBMIT_CLOSURE') &&
    (status === 'CAPA_IN_PROGRESS' || (!incident.requiresCapa && investigation?.status === 'COMPLETED'));
  const hasActionPanel =
    actions.includes('ASSIGN') || actions.includes('RESPOND_INFO') || actions.includes('START_INVESTIGATION') || showSubmit || actions.includes('REVIEW_ACCEPT') || workEditable;

  const confirmedSeverity = !isStaff && !NOT_YET_ASSIGNED.includes(status);
  const severityChanged = confirmedSeverity && incident.initialSeverity && incident.initialSeverity !== incident.severity;

  return (
    <div className="space-y-6 text-clinicalText-primary">
      <button
        onClick={back}
        className="inline-flex items-center space-x-2 text-xs font-semibold text-[#64748B] hover:text-[#8B1E23] bg-white hover:bg-[#FFF5F5] border border-clinicalBorder px-4 py-2 rounded-xl shadow-xs transition cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back</span>
      </button>

      {/* Header - dark theme */}
      <div className="bg-gradient-to-r from-[#241014] via-[#1B0E11] to-[#150A0C] p-6 rounded-2xl border border-[#3D1B1F] shadow-[0_4px_20px_rgba(0,0,0,0.25)] space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-lg font-black text-[#F06B70]">{incident.incidentNumber}</span>
          <StatusBadge status={status} />
          {confirmedSeverity ? (
            <SeverityBadge severity={incident.severity} />
          ) : (
            <SeverityBadge severity={incident.initialSeverity ?? incident.severity} provisional />
          )}
          {severityChanged && (
            <span className="text-[11px] text-slate-400">reported as {SEVERITY_META[incident.initialSeverity]?.short}</span>
          )}
        </div>
        <h2 className="text-xl font-bold text-white">{incident.title}</h2>
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300/80">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-[#F06B70]" /> Occurred {dayjs(incident.incidentDateTime).format('DD MMM YYYY HH:mm')}
          </span>
          <span className="flex items-center gap-1">
            <Building className="w-3.5 h-3.5 text-[#F06B70]" /> {incident.occurredInDepartmentId?.name || '—'}
          </span>
          <span className="flex items-center gap-1">
            <Tag className="w-3.5 h-3.5 text-[#F06B70]" /> {incident.categoryId?.name}
          </span>
          {(incident.floor || incident.zone || incident.locationId?.floor || incident.locationId?.name) && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#F06B70]" />
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
              <UserCheck className="w-3.5 h-3.5 text-[#F06B70]" /> Reported by {isStaff ? 'you' : incident.reportedBy.name}
            </span>
          )}
        </div>
      </div>

      <WorkflowStepper status={status} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          {/* What this user can do now */}
          {actions.includes('ASSIGN') && <QualityTriagePanel incident={incident} />}
          {actions.includes('RESPOND_INFO') && <StaffResponsePanel incident={incident} />}
          {actions.includes('START_INVESTIGATION') && <HodAssignedPanel incident={incident} />}
          {actions.includes('REVIEW_ACCEPT') && <QualityReviewPanel incident={incident} capas={capas} />}
          {!hasActionPanel && <WaitingNotice incident={incident} isStaff={isStaff} />}

          {/* The HOD's work, in order; read-only for Quality and Admin */}
          {/* Severity 4–5: the RCA comes before completing the investigation */}
          {incident.requiresRca && (workEditable || rca) && <RcaSection incident={incident} rca={rca} editable={workEditable} />}
          <InvestigationSection incident={incident} investigation={investigation} rca={rca} editable={workEditable} />
          {!incident.requiresRca && rca && <RcaSection incident={incident} rca={rca} editable={false} />}
          {CAPA_STAGES.includes(status) && hasPermission(user, 'capa.read') && (
            <CapaSection incident={incident} capas={capas} editable={capaEditable} />
          )}
          {showSubmit && <SubmitClosurePanel incident={incident} investigation={investigation} rca={rca} capas={capas} />}

          <ReportDetails incident={incident} />
          <HistorySection incident={incident} />
        </div>

        <div className="space-y-6">
          <Card title="People" icon={Users}>
            <div className="space-y-3">
              <Field label="Reported by">
                {isStaff ? 'You' : incident.reportedBy?.name}
                {incident.reportingDepartmentId?.name ? ` — ${incident.reportingDepartmentId.name}` : ''}
              </Field>
              <Field label="Responsible department">
                {incident.departmentId?.name ? incident.departmentId.name : 'Not assigned yet'}
              </Field>
              {!isStaff && incident.assignedHod?.name && <Field label="HOD">{incident.assignedHod.name}</Field>}
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
          </Card>
          <Timeline entries={(timelineQuery.data as any)?.data || []} />
        </div>
      </div>
    </div>
  );
}
