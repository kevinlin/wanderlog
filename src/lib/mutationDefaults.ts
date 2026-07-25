import type { QueryClient } from '@tanstack/react-query';
import { buildVisitMutationDefaults, VISIT_MUTATION_KEY } from '@/lib/visitMutation';

// Hydration rebuilds a mutation through defaultMutationOptions, which recovers
// its callbacks only via getMutationDefaults(mutationKey). Without this a write
// queued offline is persisted and then never runs again.
export const registerMutationDefaults = (queryClient: QueryClient): void => {
  queryClient.setMutationDefaults([...VISIT_MUTATION_KEY], buildVisitMutationDefaults(queryClient));
};
