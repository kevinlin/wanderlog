import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { AppStateProvider } from '@/contexts/AppStateContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { PERSIST_MAX_AGE_MS, persister, queryClient } from '@/lib/queryClient';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: PERSIST_MAX_AGE_MS, buster: 'phase2-v1' }}>
      <AuthProvider>
        <AppStateProvider>
          <App />
        </AppStateProvider>
      </AuthProvider>
    </PersistQueryClientProvider>
  </StrictMode>
);
