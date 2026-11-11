const { createClient } = require('@supabase/supabase-js');
const { createServerClient, parseCookieHeader, serializeCookieHeader } = require('@supabase/ssr');

/**
 * Creates a Supabase client for server/API usage.
 * Uses @supabase/ssr createServerClient when HTTP req/res context & anon key are provided,
 * and falls back to @supabase/supabase-js createClient for service-role or background queries.
 */
function createSupabaseClient({ url, key, req = null, res = null, useSsr = false } = {}) {
  if (useSsr && req && res) {
    return createServerClient(url, key, {
      cookies: {
        getAll() {
          return parseCookieHeader(req.headers.cookie ?? '');
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.appendHeader('Set-Cookie', serializeCookieHeader(name, value, options));
          });
        },
      },
    });
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

module.exports = {
  createSupabaseClient,
};

