const { createClient } = require('@supabase/supabase-js');
const { getConfig, isConfiguredSupabaseUrl } = require('../config/env');
const SqliteRepository = require('./sqliteRepository');
const SupabaseRepository = require('./supabaseRepository');

let cachedRepo = null;
let cachedSource = null;

function getRepository() {
  const cfg = getConfig();
  if (cachedRepo && cachedSource === cfg.activeSource) {
    return cachedRepo;
  }

  if (cfg.activeSource === 'supabase') {
    cachedRepo = new SupabaseRepository(cfg.supabaseUrl, cfg.supabaseKey);
    cachedSource = 'supabase';
  } else {
    cachedRepo = new SqliteRepository();
    cachedSource = 'sqlite';
  }

  return cachedRepo;
}

function getBackendStatus() {
  const cfg = getConfig();
  return {
    activeSource: cfg.activeSource,
    label: cfg.activeSource === 'supabase'
      ? 'Supabase PostgreSQL Cloud'
      : 'Local SQLite Mirror (Supabase-Compatible Schema)',
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

