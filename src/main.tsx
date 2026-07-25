import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { AppStateProvider } from '@/contexts/AppStateContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { registerMutationDefaults } from '@/lib/mutationDefaults';
import { PERSIST_MAX_AGE_MS, persister, queryClient } from '@/lib/queryClient';
import App from './App.tsx';

// Before render: a hydrated mutation recovers its callbacks only from the
// defaults registered against its key.
registerMutationDefaults(queryClient);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      // The provider restores the cache but does not resume paused mutations,
      // so a write queued offline needs this to fire after a restart.
      onSuccess={() => queryClient.resumePausedMutations()}
      persistOptions={{ persister, maxAge: PERSIST_MAX_AGE_MS, buster: 'phase4-v1' }}
    >
      <AuthProvider>
        <AppStateProvider>
          <App />
        </AppStateProvider>
      </AuthProvider>
    </PersistQueryClientProvider>
  </StrictMode>
);
