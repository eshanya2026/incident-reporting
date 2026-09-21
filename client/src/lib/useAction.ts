import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/** Formats an API error (see lib/api.ts) including field-level validation details. */
export const errorMessage = (err: any, fallback = 'Something went wrong'): string => {
  const details = Array.isArray(err?.details) ? err.details.map((d: any) => d.message).filter(Boolean) : [];
  return details.length ? details.join('. ') : err?.message || fallback;
};

/**
 * Runs a write action with a busy flag and an inline error message, then refreshes the
 * incident page data and the work queues.
 */
export function useAction(incidentId?: string) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (fn: () => Promise<unknown>): Promise<boolean> => {
    setBusy(true);
    setError('');
    try {
      await fn();
      const keys = [
        ['incident', incidentId],
        ['timeline', incidentId],
        ['investigation', incidentId],
        ['rca', incidentId],
        ['capas', incidentId],
        ['triage-queue'],
        ['review-queue'],
        ['my-department'],
        ['my-reports'],
        ['incidents'],
        ['all-capas'],
        ['queue-counts'],
      ];
      await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      return true;
    } catch (err: any) {
      setError(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { run, busy, error, setError };
}
