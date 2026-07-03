import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Support both Vite (import.meta.env) and Node.js (process.env) environments
const getEnvVar = (key: string): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] || '';
  }
  return process.env[key] || '';
};

let client: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient => {
  if (!client) {
    client = createClient(getEnvVar('VITE_SUPABASE_URL'), getEnvVar('VITE_SUPABASE_ANON_KEY'));
  }
  return client;
};
