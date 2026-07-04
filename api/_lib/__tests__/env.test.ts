import { describe, expect, it } from 'vitest';
import { loadAgentEnv } from '../env';

const FULL_ENV = {
  ANTHROPIC_API_KEY: 'sk-test',
  ANTHROPIC_MODEL: 'test-model',
  ANTHROPIC_BASE_URL: 'https://example.com/anthropic',
  VITE_SUPABASE_URL: 'https://proj.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'anon-key',
} as NodeJS.ProcessEnv;

describe('loadAgentEnv', () => {
  it('maps all vars', () => {
    expect(loadAgentEnv(FULL_ENV)).toEqual({
      anthropicApiKey: 'sk-test',
      anthropicModel: 'test-model',
      anthropicBaseUrl: 'https://example.com/anthropic',
      supabaseUrl: 'https://proj.supabase.co',
      supabaseAnonKey: 'anon-key',
    });
  });

  it('treats ANTHROPIC_BASE_URL as optional', () => {
    const { ANTHROPIC_BASE_URL: _omitted, ...rest } = FULL_ENV;
    expect(loadAgentEnv(rest).anthropicBaseUrl).toBeUndefined();
  });

  it('throws naming every missing required var', () => {
    expect(() => loadAgentEnv({} as NodeJS.ProcessEnv)).toThrow(
      /ANTHROPIC_API_KEY.*ANTHROPIC_MODEL.*VITE_SUPABASE_URL.*VITE_SUPABASE_ANON_KEY/s
    );
  });
});
