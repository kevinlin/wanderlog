import { defaultShouldDehydrateMutation, type Mutation, type QueryClient } from '@tanstack/react-query';
import { buildVisitMutationDefaults, VISIT_MUTATION_KEY } from '@/lib/visitMutation';

// Hydration rebuilds a mutation through defaultMutationOptions, which recovers
// its callbacks only via getMutationDefaults(mutationKey). Without this a write
// queued offline is persisted and then never runs again.
export const registerMutationDefaults = (queryClient: QueryClient): void => {
  queryClient.setMutationDefaults([...VISIT_MUTATION_KEY], buildVisitMutationDefaults(queryClient));
};

// Only a mutation whose key has defaults registered above can run again after a
// reload. Any other paused write - a todo queued behind its trip scope, an
// activity edit made offline - would be restored with no function and no
// rollback, so it is never persisted in the first place.
export const shouldPersistMutation = (mutation: Mutation): boolean =>
  defaultShouldDehydrateMutation(mutation) && mutation.options.mutationKey?.[0] === VISIT_MUTATION_KEY[0];
