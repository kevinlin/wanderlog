import { type UseMutationResult, useMutation } from '@tanstack/react-query';
import { VISIT_MUTATION_KEY, type VisitContext, type VisitVariables } from '@/lib/visitMutation';

// No callbacks here on purpose: they live in visitMutation at module scope so a
// write resumed from IndexedDB runs identical code. The per-item scope makes
// two queued writes to one item run in order rather than racing, which is why
// this is called per item rather than once per page.
export function useVisitRecord(itemId: string): UseMutationResult<void, Error, VisitVariables, VisitContext> {
  return useMutation<void, Error, VisitVariables, VisitContext>({
    mutationKey: [...VISIT_MUTATION_KEY],
    scope: { id: `visit-${itemId}` },
  });
}
