import { describe, expect, it, vi } from 'vitest';

const getUserMock = vi.fn();
const createClientMock = vi.fn(() => ({ auth: { getUser: getUserMock } }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

import { createUserClient, extractBearerToken, getAuthenticatedUserId } from '../supabase';

const ENV = {
  anthropicApiKey: 'k',
  anthropicBaseUrl: undefined,
  anthropicModel: 'm',
  supabaseUrl: 'https://proj.supabase.co',
  supabaseAnonKey: 'anon',
};

describe('createUserClient', () => {
  it('binds the caller token as Authorization header with no session persistence', () => {
    createUserClient(ENV, 'jwt-123');
    expect(createClientMock).toHaveBeenCalledWith('https://proj.supabase.co', 'anon', {
      global: { headers: { Authorization: 'Bearer jwt-123' } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  });
});

describe('extractBearerToken', () => {
  it('parses a bearer header', () => {
    const req = new Request('http://x', { headers: { Authorization: 'Bearer abc' } });
    expect(extractBearerToken(req)).toBe('abc');
  });
  it('returns null when absent or malformed', () => {
    expect(extractBearerToken(new Request('http://x'))).toBeNull();
    expect(extractBearerToken(new Request('http://x', { headers: { Authorization: 'Basic abc' } }))).toBeNull();
  });
});

describe('getAuthenticatedUserId', () => {
  it('returns the user id for a valid token', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    const client = createUserClient(ENV, 't');
    expect(await getAuthenticatedUserId(client, 't')).toBe('user-1');
  });
  it('returns null on auth error', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } });
    const client = createUserClient(ENV, 'bad');
    expect(await getAuthenticatedUserId(client, 'bad')).toBeNull();
  });
});
