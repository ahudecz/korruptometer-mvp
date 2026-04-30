import { createClient } from '@supabase/supabase-js';

/**
 * Service-role client. Only call this from route handlers, server actions,
 * or scripts — NEVER from a client component or a server component that
 * renders for an unauthenticated viewer.
 */
export function createSupabaseServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase service-role env vars missing');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
