const { createClient } = require('@supabase/supabase-js');
const { getConfig, isConfiguredSupabaseUrl } = require('../config/env');
const SupabaseRepository = require('./supabaseRepository');

let cachedRepo = null;
let cachedKey = null;

function getRepository() {
  const cfg = getConfig();
  if (cfg.activeSource === 'supabase-unconfigured') {
    const err = new Error(
      'Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) in Vercel Environment Variables.'
    );
    err.status = 503;
    throw err;
  }

  const cacheSignature = `${cfg.activeSource}:${cfg.supabaseUrl}:${cfg.supabaseKey ? 'key' : 'none'}`;
  if (cachedRepo && cachedKey === cacheSignature) {
    return cachedRepo;
  }

  if (cfg.activeSource === 'supabase') {
    cachedRepo = new SupabaseRepository(cfg.supabaseUrl, cfg.supabaseKey);
    cachedKey = cacheSignature;
  } else {
    // Lazy-require SQLite only for local zero-config runs (never loaded on Vercel/Supabase)
    const SqliteRepository = require('./sqliteRepository');
    cachedRepo = new SqliteRepository();
    cachedKey = cacheSignature;
  }

  return cachedRepo;
}

function getBackendStatus() {
  const cfg = getConfig();
  return {
    activeSource: cfg.activeSource,
    label: cfg.activeSource === 'supabase'
      ? 'Supabase PostgreSQL Cloud'
      : cfg.activeSource === 'supabase-unconfigured'
        ? 'Supabase Required (Env Vars Missing)'
        : 'Local SQLite Mirror (Supabase-Compatible Schema)',
    isVercel: cfg.isVercel,
    supabaseConfigured: cfg.hasSupabase,
    supabaseUrl: cfg.hasSupabase ? cfg.supabaseUrl : null,
    aiKeysConfigured: {
      gemini: Boolean(cfg.geminiApiKey),
      openai: Boolean(cfg.openaiApiKey),
    },
  };
}

async function testSupabaseConnection({ url, key }) {
  if (!isConfiguredSupabaseUrl(url) || !key) {
    return { ok: false, message: 'Provide a valid Supabase project URL and anon/service_role key.' };
  }
  try {
    const client = createClient(url, key, { auth: { persistSession: false } });
    const { count, error } = await client.from('employees').select('*', { count: 'exact', head: true });
    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true, message: `Connected to Supabase! Found ${count || 0} employees.`, employeeCount: count || 0 };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

module.exports = {
  getRepository,
  getBackendStatus,
  testSupabaseConnection,
};
