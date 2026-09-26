import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, X } from 'lucide-react';
import { api } from '../lib/api';
import { STATUS_META, STATUS_ORDER, SEVERITY_META } from '../lib/incidentMeta';
import { PageHeader } from '../components/ui/primitives';
import IncidentTable from '../components/incident/IncidentTable';
import { departmentOptions } from '../components/ui/DepartmentOptions';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { FilterBar, Pagination, SearchInput, filterControlClass } from '../components/ui/listKit';

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

  const activeFilters = [search, status, departmentId, categoryId, severity].filter(Boolean).length;
  const clearFilters = () => {
    setSearch('');
    setStatus('');
    setDepartmentId('');
    setCategoryId('');
    setSeverity('');
    setPage(1);
  };

  return (
    <div className="space-y-6 text-clinicalText-primary">
      <PageHeader
        icon={FileSpreadsheet}
        title="All Incidents"
        description="Every reported incident with its responsible department and current status."
      >
        <div className="self-start md:self-auto shrink-0 px-5 py-3 rounded-2xl bg-black/20 border border-white/15 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
          <div className="text-2xl font-extrabold text-white leading-none">{meta.total}</div>
          <div className="text-[11.5px] font-semibold uppercase tracking-wider text-[#FBC9CB] mt-1">
            {activeFilters ? 'Matching' : 'Total'} incidents
          </div>
        </div>
      </PageHeader>

      {/* Search & Filter Bar */}
      <FilterBar>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search INC #, title, UHID..."
          />

          <SearchableSelect
            value={departmentId}
            onChange={(v) => {
              setDepartmentId(v);
              setPage(1);
            }}
            containerClassName="block w-full"
            options={[{ value: '', label: 'Responsible department (all)' }, ...departmentOptions(departments)]}
            searchPlaceholder="Search departments..."
            className={filterControlClass}
          />

          <SearchableSelect
            value={categoryId}
            onChange={(v) => {
              setCategoryId(v);
              setPage(1);
            }}
            containerClassName="block w-full"
            options={[{ value: '', label: 'All categories' }, ...categoryOptions]}
            searchPlaceholder="Search categories..."
            className={filterControlClass}
          />

          <SearchableSelect
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            containerClassName="block w-full"
            options={[
              { value: '', label: 'All statuses' },
              ...STATUS_ORDER.map((st) => ({ value: st, label: STATUS_META[st].label })),
            ]}
            searchPlaceholder="Search statuses..."
            className={filterControlClass}
          />

          <SearchableSelect
            value={severity}
            onChange={(v) => {
              setSeverity(v);
              setPage(1);
            }}
            containerClassName="block w-full"
            options={[
              { value: '', label: 'All severities' },
              ...[1, 2, 3, 4, 5].map((lvl) => ({ value: String(lvl), label: SEVERITY_META[lvl].label })),
            ]}
            searchPlaceholder="Search severities..."
            className={filterControlClass}
          />
        </div>

        {activeFilters > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
            <span className="text-slate-500">
              <strong className="text-slate-800">{activeFilters}</strong> filter{activeFilters > 1 ? 's' : ''} applied
            </span>
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-semibold text-[#8B1E23] hover:bg-[#FFF5F5] transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> Clear all
            </button>
          </div>
        )}
      </FilterBar>

      <div className="space-y-3">
        <IncidentTable
          incidents={incidents}
          loading={isLoading}
          columns={['number', 'occurred', 'title', 'occurredIn', 'responsible', 'severity', 'status']}
          empty="No incidents match the filters."
        />

        <div className="px-5 py-3 bg-white rounded-2xl border border-slate-200 shadow-card text-sm text-slate-500">
          <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onChange={setPage} />
        </div>
      </div>
    </div>
  );
}
