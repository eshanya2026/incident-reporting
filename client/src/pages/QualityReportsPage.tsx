import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Download,
  Printer,
  Filter,
  FileSpreadsheet,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileText,
  Building2,
  Calendar,
  Layers,
  ArrowUpDown,
  RefreshCw,
} from 'lucide-react';
import dayjs from 'dayjs';
import { api } from '../lib/api';
import { SeverityBadge, StatusBadge } from '../components/incident/Badges';
import { useAuthStore } from '../store/useAuthStore';
import { hasPermission } from '../lib/rbac';
import { departmentOptions } from '../components/ui/DepartmentOptions';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { EmptyState, FilterBar, SearchInput, StatTile, TabBar, TableSkeleton, filterControlClass } from '../components/ui/listKit';
import { SEVERITY_COLOR } from '../lib/incidentMeta';

type ReportTab = 'INCIDENTS' | 'CAPA';

export default function QualityReportsPage() {
  const user = useAuthStore((state) => state.user);
  const isHospitalWide = hasPermission(user, 'report.view_all');
  const userDeptId = user?.departmentId;

  const [activeTab, setActiveTab] = useState<ReportTab>('INCIDENTS');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [departmentId, setDepartmentId] = useState(isHospitalWide ? '' : userDeptId || '');
  const [severity, setSeverity] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [capaStatus, setCapaStatus] = useState<string>('');
  const [capaOverdueOnly, setCapaOverdueOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Departments for dropdown
  const { data: departmentsData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments'),
  });
  const departments = (departmentsData as any)?.data || [];

  // Incidents report query
  const {
    data: incidentReportData,
    isLoading: loadingIncidents,
    refetch: refetchIncidents,
  } = useQuery({
    queryKey: ['report-incidents', fromDate, toDate, departmentId, severity, status],
    queryFn: () =>
      api.get('/reports/incidents', {
        params: {
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          departmentId: departmentId || undefined,
          severity: severity ? Number(severity) : undefined,
          status: status || undefined,
        },
      }),
    enabled: activeTab === 'INCIDENTS',
  });

  // CAPA report query
  const {
    data: capaReportData,
    isLoading: loadingCapas,
    refetch: refetchCapas,
  } = useQuery({
    queryKey: ['report-capa', departmentId, capaStatus, capaOverdueOnly],
    queryFn: () =>
      api.get('/reports/capa', {
        params: {
          ownerDepartmentId: departmentId || undefined,
          status: capaStatus || undefined,
          overdue: capaOverdueOnly ? 'true' : undefined,
        },
      }),
    enabled: activeTab === 'CAPA',
  });

  const rawIncidents: any[] = (incidentReportData as any)?.data || [];
  const rawCapas: any[] = (capaReportData as any)?.data || [];

  // Client-side text search filter
  const filteredIncidents = useMemo(() => {
    if (!searchQuery.trim()) return rawIncidents;
    const q = searchQuery.toLowerCase();
    return rawIncidents.filter(
      (inc) =>
        inc.incidentNumber?.toLowerCase().includes(q) ||
        inc.title?.toLowerCase().includes(q) ||
        inc.patientUhid?.toLowerCase().includes(q) ||
        inc.category?.toLowerCase().includes(q) ||
        inc.responsibleDepartment?.toLowerCase().includes(q) ||
        inc.hod?.toLowerCase().includes(q)
    );
  }, [rawIncidents, searchQuery]);

  const filteredCapas = useMemo(() => {
    if (!searchQuery.trim()) return rawCapas;
    const q = searchQuery.toLowerCase();
    return rawCapas.filter(
      (c) =>
        c.capaNumber?.toLowerCase().includes(q) ||
        c.incidentNumber?.toLowerCase().includes(q) ||
        c.action?.toLowerCase().includes(q) ||
        c.department?.toLowerCase().includes(q) ||
        c.owner?.toLowerCase().includes(q)
    );
  }, [rawCapas, searchQuery]);

  // Summary Metrics for Incidents
  const incidentSummary = useMemo(() => {
    const total = filteredIncidents.length;
    const closed = filteredIncidents.filter((i) => i.status === 'CLOSED').length;
    const critical = filteredIncidents.filter((i) => (i.severity || 0) >= 4).length;
    const closedWithDays = filteredIncidents.filter((i) => i.daysToClose !== null && i.daysToClose !== undefined);
    const medianDays =
      closedWithDays.length > 0
        ? Math.round(
            (closedWithDays.map((i) => i.daysToClose).sort((a, b) => a - b)[Math.floor(closedWithDays.length / 2)] ||
              0) * 10
          ) / 10
        : null;

    return { total, closed, critical, medianDays };
  }, [filteredIncidents]);

  // Summary Metrics for CAPA
  const capaSummary = useMemo(() => {
    const total = filteredCapas.length;
    const effective = filteredCapas.filter((c) => c.status === 'EFFECTIVE').length;
    const open = filteredCapas.filter((c) => c.status === 'OPEN').length;
    const overdue = filteredCapas.filter((c) => c.overdue).length;
    return { total, effective, open, overdue };
  }, [filteredCapas]);

  // Export CSV
  const handleExportCsv = () => {
    const baseUrl = (api as any).defaults?.baseURL || '/api/v1';
    let url = '';
    const params = new URLSearchParams();
    params.set('format', 'csv');

    if (activeTab === 'INCIDENTS') {
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);
      if (departmentId) params.set('departmentId', departmentId);
      if (severity) params.set('severity', severity);
      if (status) params.set('status', status);
      url = `${baseUrl}/reports/incidents?${params.toString()}`;
    } else {
      if (departmentId) params.set('ownerDepartmentId', departmentId);
      if (capaStatus) params.set('status', capaStatus);
      if (capaOverdueOnly) params.set('overdue', 'true');
      url = `${baseUrl}/reports/capa?${params.toString()}`;
    }

    // Trigger download with auth header via fetch blob
    setIsExporting(true);
    api
      .get(url.replace(baseUrl, ''), { responseType: 'blob' })
      .then((res: any) => {
        const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const fileName =
          activeTab === 'INCIDENTS'
            ? `Incident_Register_${dayjs().format('YYYY-MM-DD')}.csv`
            : `CAPA_Register_${dayjs().format('YYYY-MM-DD')}.csv`;
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      })
      .finally(() => setIsExporting(false));
  };

  // Export Excel (HTML Table compatible with Excel)
  const handleExportExcel = () => {
    // Every cell below is interpolated into an HTML string, and several columns are free text a
    // Staff or HOD user wrote (title, description, CAPA action, remarks, names). Without escaping,
    // a value like `<img src=x onerror=...>` or a <script> tag lands verbatim in the exported
    // file and can run when Quality/Admin open it (some Excel versions render HTML-as-.xls with
    // script support enabled, and the file may instead be opened in a browser). Escape every
    // field that isn't a value we generated ourselves (dayjs date strings, enums, booleans).
    const esc = (value: unknown): string =>
      String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
    const fileName =
      activeTab === 'INCIDENTS'
        ? `Incident_Register_${dayjs().format('YYYY-MM-DD')}.xls`
        : `CAPA_Register_${dayjs().format('YYYY-MM-DD')}.xls`;

    let tableHtml = '';
    if (activeTab === 'INCIDENTS') {
      tableHtml = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head><meta charset="utf-8"/></head>
        <body>
          <h3>Adhiparasakthi Hospitals - Master Incident Register</h3>
          <p>Generated: ${dayjs().format('DD-MMM-YYYY HH:mm')} | Filtered Records: ${filteredIncidents.length}</p>
          <table border="1">
            <tr style="background-color: #8B1E23; color: #ffffff; font-weight: bold;">
              <th>Incident #</th><th>Reported Date</th><th>Occurred Date</th><th>Reporting Dept</th>
              <th>Occurred In Dept</th><th>Responsible Dept</th><th>Assigned HOD</th><th>Category</th>
              <th>Subcategory</th><th>Title</th><th>UHID</th><th>Reported Severity</th><th>Confirmed Severity</th>
              <th>Status</th><th>Assigned Date</th><th>Submitted Review Date</th><th>Closed Date</th>
              <th>Days to Assign</th><th>Days Assign to Submit</th><th>Days Review to Close</th><th>Total Days to Close</th>
              <th>HOD Returns</th><th>Quality Send Backs</th>
            </tr>
            ${filteredIncidents
              .map(
                (i) => `
              <tr>
                <td>${i.incidentNumber}</td>
                <td>${i.reportedAt ? dayjs(i.reportedAt).format('YYYY-MM-DD HH:mm') : ''}</td>
                <td>${i.occurredAt ? dayjs(i.occurredAt).format('YYYY-MM-DD HH:mm') : ''}</td>
                <td>${esc(i.reportingDepartment)}</td>
                <td>${esc(i.occurredInDepartment)}</td>
                <td>${esc(i.responsibleDepartment)}</td>
                <td>${esc(i.hod)}</td>
                <td>${esc(i.category)}</td>
                <td>${esc(i.subcategory)}</td>
                <td>${esc(i.title)}</td>
                <td>${esc(i.patientUhid)}</td>
                <td>${i.reportedSeverity}</td>
                <td>${i.severity}</td>
                <td>${i.status}</td>
                <td>${i.assignedAt ? dayjs(i.assignedAt).format('YYYY-MM-DD HH:mm') : ''}</td>
                <td>${i.submittedForReviewAt ? dayjs(i.submittedForReviewAt).format('YYYY-MM-DD HH:mm') : ''}</td>
                <td>${i.closedAt ? dayjs(i.closedAt).format('YYYY-MM-DD HH:mm') : ''}</td>
                <td>${i.daysToAssign ?? ''}</td>
                <td>${i.daysAssignToSubmit ?? ''}</td>
                <td>${i.daysReviewToClose ?? ''}</td>
                <td>${i.daysToClose ?? ''}</td>
                <td>${i.hodReturns}</td>
                <td>${i.sentBackByQuality}</td>
              </tr>`
              )
              .join('')}
          </table>
        </body></html>`;
    } else {
      tableHtml = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head><meta charset="utf-8"/></head>
        <body>
          <h3>Adhiparasakthi Hospitals - CAPA Compliance Register</h3>
          <p>Generated: ${dayjs().format('DD-MMM-YYYY HH:mm')} | Filtered Records: ${filteredCapas.length}</p>
          <table border="1">
            <tr style="background-color: #8B1E23; color: #ffffff; font-weight: bold;">
              <th>CAPA #</th><th>Incident #</th><th>Incident Title</th><th>Department</th>
              <th>Owner</th><th>Type</th><th>Action</th><th>Priority</th><th>Assigned Date</th>
              <th>Target Date</th><th>Status</th><th>Overdue</th><th>Completed Date</th>
              <th>Completion Remarks</th><th>Reviewed By</th><th>Reviewed Date</th><th>Review Remarks</th>
            </tr>
            ${filteredCapas
              .map(
                (c) => `
              <tr>
                <td>${c.capaNumber}</td>
                <td>${c.incidentNumber ?? ''}</td>
                <td>${esc(c.incidentTitle)}</td>
                <td>${esc(c.department)}</td>
                <td>${esc(c.owner)}</td>
                <td>${c.type}</td>
                <td>${esc(c.action)}</td>
                <td>${c.priority}</td>
                <td>${c.assignedAt ? dayjs(c.assignedAt).format('YYYY-MM-DD') : ''}</td>
                <td>${c.targetDate ? dayjs(c.targetDate).format('YYYY-MM-DD') : ''}</td>
                <td>${c.status}</td>
                <td>${c.overdue ? 'YES' : 'NO'}</td>
                <td>${c.completedAt ? dayjs(c.completedAt).format('YYYY-MM-DD HH:mm') : ''}</td>
                <td>${esc(c.completionRemarks)}</td>
                <td>${esc(c.reviewedBy)}</td>
                <td>${c.reviewedAt ? dayjs(c.reviewedAt).format('YYYY-MM-DD HH:mm') : ''}</td>
                <td>${esc(c.reviewRemarks)}</td>
              </tr>`
              )
              .join('')}
          </table>
        </body></html>`;
    }

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 text-[#172033]">
      {/* Title Card / Banner - dark theme */}
      <div className="hero-banner p-6 sm:p-7 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-white/10 text-[#F5A5A8] text-[12.5px] font-bold tracking-wide uppercase mb-2">
            <span>AUDIT & COMPLIANCE REGISTERS</span>
          </div>
          <h2 className="text-2xl font-bold text-white flex items-start space-x-2.5">
            <BarChart3 className="w-6 h-6 shrink-0 mt-1 text-[#F06B70]" />
            <span>NABH & Quality Compliance Registers</span>
          </h2>
          <p className="text-xs text-slate-300/80 mt-1">
            Export official hospital incident registers, root cause timelines, and CAPA compliance audit logs.
          </p>
        </div>

        {/* Action Buttons: Export CSV, Excel, Print */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={isExporting}
            className="px-4 py-2.5 bg-white/10 border border-white/15 hover:bg-white/15 text-white font-semibold text-xs rounded-xl flex items-center space-x-2 transition cursor-pointer disabled:opacity-50"
            title="Download CSV"
          >
            <Download className="w-4 h-4 text-[#F5A5A8]" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="px-4 py-2.5 bg-white/10 border border-white/15 hover:bg-white/15 text-white font-semibold text-xs rounded-xl flex items-center space-x-2 transition cursor-pointer"
            title="Download Excel spreadsheet"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#34D399]" />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2.5 bg-gradient-to-r from-[#8B1E23] via-[#C62828] to-[#E53935] hover:brightness-110 active:scale-[0.99] text-white font-semibold text-xs rounded-xl shadow-button-red flex items-center space-x-2 transition cursor-pointer"
            title="Print or Save PDF"
          >
            <Printer className="w-4 h-4 text-white" />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Printable Header (Visible only when printing) */}
      <div className="hidden print:block mb-6 border-b-2 border-[#8B1E23] pb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold text-[#8B1E23]">ADHIPARASAKTHI HOSPITALS</h1>
            <h2 className="text-sm font-semibold text-[#172033]">
              {activeTab === 'INCIDENTS' ? 'MASTER INCIDENT REGISTER' : 'CAPA COMPLIANCE REGISTER'}
            </h2>
            <p className="text-xs text-[#64748B]">Quality Assurance & Patient Safety Department</p>
          </div>
          <div className="text-right text-xs text-[#64748B]">
            <p>Generated: {dayjs().format('DD-MMM-YYYY HH:mm')}</p>
            <p>Total Records: {activeTab === 'INCIDENTS' ? filteredIncidents.length : filteredCapas.length}</p>
          </div>
        </div>
      </div>

      {/* Register switcher */}
      <div className="print:hidden">
        <TabBar
          active={activeTab}
          onChange={(key) => {
            setActiveTab(key as typeof activeTab);
            setSearchQuery('');
          }}
          tabs={[
            { key: 'INCIDENTS', label: 'Incident Master Register', count: filteredIncidents.length },
            { key: 'CAPA', label: 'CAPA Compliance Register', count: filteredCapas.length },
          ]}
        />
      </div>

      {/* KPI Metric Summary Strip */}
      <div key={activeTab} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden animate-tab-panel-in">
        {activeTab === 'INCIDENTS' ? (
          <>
            <StatTile label="Total in register" value={incidentSummary.total} icon={FileText} tone="red" hint="Matching filters" />
            <StatTile
              label="Closed incidents"
              value={incidentSummary.closed}
              icon={CheckCircle2}
              tone="green"
              hint={
                incidentSummary.total
                  ? `${Math.round((incidentSummary.closed / incidentSummary.total) * 100)}% resolution rate`
                  : '0%'
              }
            />
            <StatTile label="Critical / major" value={incidentSummary.critical} icon={AlertTriangle} tone="red" hint="Severity 4 & 5 events" />
            <StatTile
              label="Median cycle time"
              value={incidentSummary.medianDays !== null ? `${incidentSummary.medianDays} d` : '—'}
              icon={Clock}
              tone="slate"
              hint="Report to final closure"
            />
          </>
        ) : (
          <>
            <StatTile label="Total CAPAs" value={capaSummary.total} icon={Layers} tone="red" hint="Audit registered" />
            <StatTile label="Verified effective" value={capaSummary.effective} icon={CheckCircle2} tone="green" hint="Quality approved" />
            <StatTile label="Ongoing / open" value={capaSummary.open} icon={Clock} tone="amber" hint="In execution" />
            <StatTile label="Overdue actions" value={capaSummary.overdue} icon={AlertTriangle} tone="red" hint="Target date exceeded" />
          </>
        )}
      </div>

      {/* Filter Bar */}
      <FilterBar className="space-y-3 print:hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[#64748B] flex items-center space-x-1.5">
            <Filter className="w-3.5 h-3.5 text-[#8B1E23]" />
            <span>Filter Audit Register</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setFromDate('');
              setToDate('');
              if (isHospitalWide) setDepartmentId('');
              setSeverity('');
              setStatus('');
              setCapaStatus('');
              setCapaOverdueOnly(false);
              setSearchQuery('');
            }}
            className="text-xs text-[#8B1E23] hover:underline font-semibold cursor-pointer"
          >
            Reset Filters
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Quick Search */}
          <div className="lg:col-span-1">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Search keywords</label>
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={activeTab === 'INCIDENTS' ? 'Search #, title, UHID...' : 'Search CAPA #, action...'}
            />
          </div>

          {/* From Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className={filterControlClass}
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className={filterControlClass}
            />
          </div>

          {/* Department Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Responsible Department
            </label>
            <SearchableSelect
              containerClassName="block w-full"
              value={departmentId}
              onChange={setDepartmentId}
              disabled={!isHospitalWide}
              options={[
                ...(isHospitalWide ? [{ value: '', label: '-- All Departments --' }] : []),
                ...departmentOptions(departments),
              ]}
              searchPlaceholder="Search departments..."
              className={filterControlClass}
            />
          </div>

          {/* Dynamic Tab Filter: Severity/Status vs CAPA Status/Overdue */}
          {activeTab === 'INCIDENTS' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Severity / Harm Level</label>
              <SearchableSelect
                containerClassName="block w-full"
                value={severity}
                onChange={setSeverity}
                options={[
                  { value: '', label: '-- All Severities --' },
                  { value: '1', label: 'Severity 1 – Near Miss / No Harm' },
                  { value: '2', label: 'Severity 2 – Minor Harm' },
                  { value: '3', label: 'Severity 3 – Moderate Harm' },
                  { value: '4', label: 'Severity 4 – Major Harm' },
                  { value: '5', label: 'Severity 5 – Sentinel Event' },
                ]}
                searchPlaceholder="Search severities..."
                className={filterControlClass}
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">CAPA Status & Compliance</label>
              <div className="flex items-center space-x-2">
                <SearchableSelect
                  containerClassName="block w-full"
                  value={capaStatus}
                  onChange={setCapaStatus}
                  options={[
                    { value: '', label: '-- All Statuses --' },
                    { value: 'OPEN', label: 'OPEN (In progress)' },
                    { value: 'DONE', label: 'DONE (Waiting verification)' },
                    { value: 'EFFECTIVE', label: 'EFFECTIVE (Completed)' },
                  ]}
                  searchPlaceholder="Search statuses..."
                  className={filterControlClass}
                />

                <label className="inline-flex items-center space-x-1.5 cursor-pointer shrink-0 text-xs text-[#DC2626] font-semibold">
                  <input
                    type="checkbox"
                    checked={capaOverdueOnly}
                    onChange={(e) => setCapaOverdueOnly(e.target.checked)}
                    className="rounded text-[#DC2626] focus:ring-[#DC2626]"
                  />
                  <span>Overdue</span>
                </label>
              </div>
            </div>
          )}
        </div>
      </FilterBar>

      {/* Main Audit Register Table */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-card overflow-hidden print:border-none print:shadow-none">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 print:hidden">
          <div>
            <h3 className="font-bold text-base text-slate-900">
              {activeTab === 'INCIDENTS' ? 'Master Incident Register' : 'CAPA Compliance Register'}
            </h3>
            <span className="text-xs text-[#64748B]">
              Showing {activeTab === 'INCIDENTS' ? filteredIncidents.length : filteredCapas.length} records
            </span>
          </div>
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#FFF5F5] border border-[#FBD5D5] text-[#8B1E23]">
            NABH Accreditation Reference Standard PSQ.2
          </span>
        </div>

        <div key={activeTab} className="overflow-x-auto animate-tab-panel-in">
          {activeTab === 'INCIDENTS' ? (
            /* INCIDENT REGISTER TABLE */
            <table className="data-table">
              <thead>
                <tr className="bg-slate-100/75 border-b border-[#E2E8F0] font-bold uppercase text-[11.5px] tracking-wider text-[#475569]">
                  <th className="py-3 px-3">Inc #</th>
                  <th className="py-3 px-3">Reported</th>
                  <th className="py-3 px-3">Occurred In</th>
                  <th className="py-3 px-3">Responsible Dept</th>
                  <th className="py-3 px-3">Assigned HOD</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Title & Patient</th>
                  <th className="py-3 px-3">Harm Level</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-center">Turnaround Days</th>
                  <th className="py-3 px-3 text-center">Rework</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingIncidents ? (
                  <TableSkeleton columns={11} />
                ) : filteredIncidents.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="!p-0">
                      <EmptyState icon={FileText} message="No matching incident records found for the selected filters." />
                    </td>
                  </tr>
                ) : (
                  filteredIncidents.map((inc) => (
                    <tr key={inc._id} className="hover:bg-slate-50/80 transition">
                      {/* Incident # */}
                      <td
                        className="whitespace-nowrap"
                        style={{ boxShadow: `inset 4px 0 0 ${SEVERITY_COLOR[inc.severity] ?? '#CBD5E1'}` }}
                      >
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-[#FFF5F5] border border-[#FBD5D5] font-mono font-bold text-[#8B1E23] text-xs">
                          {inc.incidentNumber}
                        </span>
                      </td>

                      {/* Reported Date */}
                      <td className="py-3 px-3 text-[#64748B] whitespace-nowrap">
                        <div>{dayjs(inc.reportedAt).format('DD/MM/YYYY')}</div>
                        <div className="text-[11.5px] text-[#94A3B8]">{dayjs(inc.reportedAt).format('HH:mm')}</div>
                      </td>

                      {/* Occurred In Dept */}
                      <td className="py-3 px-3 text-[#475569] font-medium whitespace-nowrap">
                        {inc.occurredInDepartment || inc.reportingDepartment || '—'}
                      </td>

                      {/* Responsible Dept */}
                      <td className="py-3 px-3 text-[#172033] font-semibold whitespace-nowrap">
                        {inc.responsibleDepartment || <span className="text-[#94A3B8] italic">Pending assignment</span>}
                      </td>

                      {/* Assigned HOD */}
                      <td className="py-3 px-3 text-[#64748B] whitespace-nowrap">
                        {inc.hod || '—'}
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3 text-[#475569]">
                        <div className="font-medium truncate max-w-[140px]">{inc.category || 'General'}</div>
                        {inc.subcategory && (
                          <div className="text-[11.5px] text-[#94A3B8] truncate max-w-[140px]">{inc.subcategory}</div>
                        )}
                      </td>

                      {/* Title & UHID */}
                      <td className="py-3 px-3 text-[#172033] max-w-xs">
                        <div className="font-semibold truncate">{inc.title}</div>
                        {inc.patientUhid && (
                          <div className="text-[11.5px] font-mono text-[#64748B]">UHID: {inc.patientUhid}</div>
                        )}
                      </td>

                      {/* Severity */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <SeverityBadge severity={inc.severity} />
                        {inc.reportedSeverity !== inc.severity && (
                          <span className="block text-[11px] text-[#94A3B8] mt-0.5">
                            Initial: L{inc.reportedSeverity}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <StatusBadge status={inc.status} />
                      </td>

                      {/* Turnaround times breakdown */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {inc.status === 'CLOSED' ? (
                          <div className="inline-flex items-center space-x-1 font-mono text-[12.5px] font-bold text-[#059669]">
                            <span>{inc.daysToClose ?? '—'}d total</span>
                          </div>
                        ) : inc.daysToAssign !== null && inc.daysToAssign !== undefined ? (
                          <span className="font-mono text-[11.5px] text-[#64748B]">{inc.daysToAssign}d to assign</span>
                        ) : (
                          <span className="text-[#94A3B8]">—</span>
                        )}
                      </td>

                      {/* Rework */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {inc.sentBackByQuality > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11.5px] font-bold bg-[#F3E8FF] text-[#7C3AED]">
                            {inc.sentBackByQuality} sent back
                          </span>
                        ) : (
                          <span className="text-[11.5px] text-[#94A3B8]">0</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            /* CAPA REGISTER TABLE */
            <table className="data-table">
              <thead>
                <tr className="bg-slate-100/75 border-b border-[#E2E8F0] font-bold uppercase text-[11.5px] tracking-wider text-[#475569]">
                  <th className="py-3 px-3">CAPA #</th>
                  <th className="py-3 px-3">Incident</th>
                  <th className="py-3 px-3">Department</th>
                  <th className="py-3 px-3">Action Details</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Owner</th>
                  <th className="py-3 px-3">Target Date</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Quality Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingCapas ? (
                  <TableSkeleton columns={9} />
                ) : filteredCapas.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="!p-0">
                      <EmptyState icon={Layers} message="No matching CAPA records found." />
                    </td>
                  </tr>
                ) : (
                  filteredCapas.map((capa) => (
                    <tr key={capa._id} className="hover:bg-slate-50/80 transition">
                      {/* CAPA # */}
                      <td
                        className="whitespace-nowrap"
                        style={capa.overdue ? { boxShadow: 'inset 4px 0 0 #DC2626' } : undefined}
                      >
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-[#FFF5F5] border border-[#FBD5D5] font-mono font-bold text-[#8B1E23] text-xs">
                          {capa.capaNumber}
                        </span>
                      </td>

                      {/* Incident */}
                      <td className="py-3 px-3 text-[#172033] whitespace-nowrap">
                        <span className="font-mono font-semibold text-[#64748B]">{capa.incidentNumber}</span>
                        <div className="text-[11.5px] text-[#94A3B8] truncate max-w-[140px]">{capa.incidentTitle}</div>
                      </td>

                      {/* Department */}
                      <td className="py-3 px-3 text-[#475569] font-medium whitespace-nowrap">
                        {capa.department || '—'}
                      </td>

                      {/* Action Details */}
                      <td className="py-3 px-3 text-[#172033] max-w-sm">
                        <div className="font-medium leading-relaxed line-clamp-2">{capa.action}</div>
                      </td>

                      {/* Type */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[11.5px] font-bold ${
                            capa.type === 'PREVENTIVE'
                              ? 'bg-[#EFF6FF] text-[#2563EB]'
                              : 'bg-[#FDF4FF] text-[#C026D3]'
                          }`}
                        >
                          {capa.type}
                        </span>
                      </td>

                      {/* Owner */}
                      <td className="py-3 px-3 text-[#64748B] whitespace-nowrap">
                        {capa.owner || '—'}
                      </td>

                      {/* Target Date */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div
                          className={`font-mono text-xs ${
                            capa.overdue ? 'text-[#DC2626] font-bold flex items-center space-x-1' : 'text-[#475569]'
                          }`}
                        >
                          {capa.overdue && <AlertTriangle className="w-3.5 h-3.5" />}
                          <span>{dayjs(capa.targetDate).format('DD/MM/YYYY')}</span>
                        </div>
                        {capa.overdue && <span className="text-[11px] text-[#DC2626] font-semibold">OVERDUE</span>}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11.5px] font-bold tracking-wide ${
                            capa.status === 'EFFECTIVE'
                              ? 'bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]'
                              : capa.status === 'DONE'
                              ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                              : 'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]'
                          }`}
                        >
                          {capa.status}
                        </span>
                      </td>

                      {/* Quality Audit */}
                      <td className="py-3 px-3 text-[#64748B] whitespace-nowrap">
                        {capa.reviewedBy ? (
                          <div>
                            <div className="text-[12.5px] font-semibold text-[#172033]">{capa.reviewedBy}</div>
                            <div className="text-[11px] text-[#94A3B8]">
                              {dayjs(capa.reviewedAt).format('DD/MM/YYYY')}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[#94A3B8] italic">Pending audit</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
