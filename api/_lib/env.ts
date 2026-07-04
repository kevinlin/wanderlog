export interface AgentEnv {
  anthropicApiKey: string;
  anthropicBaseUrl: string | undefined;
  anthropicModel: string;
  googleGeocodingApiKey: string;
  supabaseAnonKey: string;
  supabaseUrl: string;
}

const REQUIRED = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_MODEL',
  'GOOGLE_GEOCODING_API_KEY',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
] as const;

export function loadAgentEnv(env: NodeJS.ProcessEnv = process.env): AgentEnv {
  const missing = REQUIRED.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
  return {
    anthropicApiKey: env.ANTHROPIC_API_KEY as string,
    anthropicBaseUrl: env.ANTHROPIC_BASE_URL || undefined,
    anthropicModel: env.ANTHROPIC_MODEL as string,
    googleGeocodingApiKey: env.GOOGLE_GEOCODING_API_KEY as string,
    supabaseUrl: env.VITE_SUPABASE_URL as string,
    supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY as string,
  };
}
