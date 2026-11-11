const dotenv = require('dotenv');
const path = require('node:path');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function isConfiguredSupabaseUrl(url) {
  return Boolean(url && url.startsWith('http') && !url.includes('your-project-ref'));
}

function getConfig() {
  const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
  const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  const hasSupabase = isConfiguredSupabaseUrl(supabaseUrl) && Boolean(supabaseKey && !supabaseKey.includes('your-supabase'));

  const requestedSource = (process.env.DATA_SOURCE || 'auto').toLowerCase();
  const activeSource = requestedSource === 'sqlite'
    ? 'sqlite'
    : requestedSource === 'supabase'
      ? (hasSupabase ? 'supabase' : 'sqlite')
      : (hasSupabase ? 'supabase' : 'sqlite');

  return {
    port: Number(process.env.PORT || 3000),
    nodeEnv: process.env.NODE_ENV || 'development',
    requestedSource,
    activeSource,
    hasSupabase,
    supabaseUrl,
    supabaseKey,
    geminiApiKey: (process.env.GEMINI_API_KEY || '').trim(),
    openaiApiKey: (process.env.OPENAI_API_KEY || '').trim(),
  };
}

module.exports = {
  getConfig,
  isConfiguredSupabaseUrl,
};

