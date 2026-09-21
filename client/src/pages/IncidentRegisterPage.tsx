import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, Search } from 'lucide-react';
import { api } from '../lib/api';
import { STATUS_META, STATUS_ORDER, SEVERITY_META } from '../lib/incidentMeta';
import { PageHeader } from '../components/ui/primitives';
import IncidentTable from '../components/incident/IncidentTable';
import { departmentOptions } from '../components/ui/DepartmentOptions';
import { SearchableSelect } from '../components/ui/SearchableSelect';

/** Quality and Admin: every incident, with search and filters. */
export default function IncidentRegisterPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [severity, setSeverity] = useState('');
  const [page, setPage] = useState(1);

  // Queries
  const { data: departmentsData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments'),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories'),
  });

  const { data: incidentsData, isLoading } = useQuery({
    queryKey: ['incidents', page, search, status, departmentId, categoryId, severity],
    queryFn: () =>
      api.get('/incidents', {
        params: {
          page,
          limit: 15,
          search: search || undefined,
          status: status || undefined,
          departmentId: departmentId || undefined,
          categoryId: categoryId || undefined,
          severity: severity || undefined,
        },
      }),
  });

  const departments = (departmentsData as any)?.data || [];
  const categories = (categoriesData as any)?.data || [];
  const incidents = (incidentsData as any)?.data || [];
  const meta = (incidentsData as any)?.meta || { page: 1, totalPages: 1, total: 0 };

  const categoryOptions = useMemo(
    () => categories.map((cat: any) => ({ value: cat._id, label: cat.name, group: cat.domain || 'General / Other' })),
    [categories]
  );

  return (
    <div className="space-y-6 text-clinicalText-primary">
      <PageHeader
        icon={FileSpreadsheet}
        title="All Incidents"
        description="Every reported incident with its responsible department and current status."
      />

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-clinicalBorder shadow-sm grid grid-cols-1 sm:grid-cols-5 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-clinicalText-muted absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search INC #, title, UHID..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
          />
        </div>

        <div>
          <SearchableSelect
            value={departmentId}
            onChange={(v) => { setDepartmentId(v); setPage(1); }}
            options={[{ value: '', label: '-- Responsible department (all) --' }, ...departmentOptions(departments)]}
            searchPlaceholder="Search departments..."
            className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
          />
        </div>

        <div>
          <SearchableSelect
            value={categoryId}
            onChange={(v) => { setCategoryId(v); setPage(1); }}
            options={[{ value: '', label: '-- All Categories --' }, ...categoryOptions]}
            searchPlaceholder="Search categories..."
            className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
          />
        </div>

        <div>
          <SearchableSelect
            value={status}
            onChange={(v) => { setStatus(v); setPage(1); }}
            options={[
              { value: '', label: '-- All Statuses --' },
              ...STATUS_ORDER.map((st) => ({ value: st, label: STATUS_META[st].label })),
            ]}
            searchPlaceholder="Search statuses..."
            className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
          />
        </div>

        <div>
          <SearchableSelect
            value={severity}
            onChange={(v) => { setSeverity(v); setPage(1); }}
            options={[
              { value: '', label: '-- All Severities --' },
              ...[1, 2, 3, 4, 5].map((lvl) => ({ value: String(lvl), label: SEVERITY_META[lvl].label })),
            ]}
            searchPlaceholder="Search severities..."
            className="w-full px-3 py-1.5 bg-slate-50 border border-clinicalBorder rounded-lg text-xs focus:ring-2 focus:ring-brandRed-500/20 focus:border-maroon-600 focus:bg-white transition"
          />
        </div>
      </div>

      <div>
        <IncidentTable
          incidents={incidents}
          loading={isLoading}
          columns={['number', 'occurred', 'title', 'occurredIn', 'responsible', 'severity', 'status']}
          empty="No incidents match the filters."
        />

        {/* Pagination Footer */}
        <div className="mt-2 px-4 py-3 bg-white rounded-xl border border-clinicalBorder flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing page {meta.page} of {meta.totalPages} ({meta.total} records)
          </span>
          <div className="flex space-x-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 bg-white border border-slate-200 rounded disabled:opacity-50 hover:bg-slate-100 font-medium"
            >
              Previous
            </button>
            <button
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 bg-white border border-slate-200 rounded disabled:opacity-50 hover:bg-slate-100 font-medium"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
