import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AgentEnv } from './env.js';

export function createUserClient(env: AgentEnv, accessToken: string): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) {
    return null;
  }
  return header.slice('Bearer '.length) || null;
}

export async function getAuthenticatedUserId(client: SupabaseClient, accessToken: string): Promise<string | null> {
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) {
    return null;
  }
  return data.user.id;
}
