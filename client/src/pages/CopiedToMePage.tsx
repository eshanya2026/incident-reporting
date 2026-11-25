import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Forward } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader } from '../components/ui/primitives';
import IncidentTable from '../components/incident/IncidentTable';
import { SearchInput, TabBar } from '../components/ui/listKit';

export const COPIED_SEEN_KEY = 'statlog.copiedSeenAt';

/**
 * Incidents Quality copied (intimated / CC'd) this person on — for Intimation members, and for HODs
 * copied on another department's incident. Read-only; the reporter stays confidential.
 */
export default function CopiedToMePage() {
  const [tab, setTab] = useState<'open' | 'closed' | 'all'>('open');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const q = useQuery({
    queryKey: ['copied-to-me', tab, debounced],
    queryFn: () => api.get('/incidents/copied-to-me', { params: { status: tab === 'all' ? undefined : tab, search: debounced || undefined } }),
  });
  const rows: any[] = (q.data as any)?.data || [];
  const meta = (q.data as any)?.meta || {};

  // Seen: the menu stops counting these as new
  const queryClient = useQueryClient();
  useEffect(() => {
    try {
      localStorage.setItem(COPIED_SEEN_KEY, new Date().toISOString());
    } catch {
      // storage unavailable: the count just stays
    }
    void queryClient.invalidateQueries({ queryKey: ['queue-counts'] });
  }, [queryClient]);

  return (
    <div className="space-y-6 text-clinicalText-primary">
      <PageHeader
        icon={Forward}
        title="Copied to me"
        description="Incidents Quality copied you on (intimated / CC) for your information. You can read them and follow their progress; the department they were assigned to does the work."
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <TabBar
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'open', label: 'In progress', count: meta.open },
            { key: 'closed', label: 'Closed' },
            { key: 'all', label: 'All', count: meta.total },
          ]}
        />
        <div className="sm:ml-auto sm:w-72">
          <SearchInput value={search} onChange={setSearch} placeholder="Search incident no or title" />
        </div>
      </div>

      <IncidentTable
        incidents={rows}
        loading={q.isLoading}
        columns={['number', 'title', 'responsible', 'severity', 'status', 'copied']}
        empty={tab === 'open' ? 'Nothing you were copied on is in progress.' : 'No incidents here.'}
      />
    </div>
  );
}
