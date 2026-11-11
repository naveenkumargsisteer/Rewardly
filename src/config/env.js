const dotenv = require('dotenv');
const path = require('node:path');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function isConfiguredSupabaseUrl(url) {
  return Boolean(url && url.startsWith('http') && !url.includes('your-project-ref'));
}

function isPlaceholderKey(key) {
  return !key || key.includes('your-supabase') || key.includes('your_anon_key');
}

function getConfig() {
  const supabaseUrl = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ''
  ).trim();

  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const anonKey = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  const supabaseKey = !isPlaceholderKey(serviceRoleKey) ? serviceRoleKey : anonKey;
  const hasSupabase = isConfiguredSupabaseUrl(supabaseUrl) && !isPlaceholderKey(supabaseKey);
  const isVercel = Boolean(process.env.VERCEL);

  const requestedSource = (process.env.DATA_SOURCE || (isVercel ? 'supabase' : 'auto')).toLowerCase();
  const activeSource = requestedSource === 'sqlite' && !isVercel
    ? 'sqlite'
    : hasSupabase
      ? 'supabase'
      : (isVercel ? 'supabase-unconfigured' : 'sqlite');

  return {
    port: Number(process.env.PORT || 3000),
    nodeEnv: process.env.NODE_ENV || 'development',
    isVercel,
    requestedSource,
    activeSource,
    hasSupabase,
    supabaseUrl,
    supabaseKey,
    supabaseAnonKey: !isPlaceholderKey(anonKey) ? anonKey : supabaseKey,
    usingServiceRole: !isPlaceholderKey(serviceRoleKey),
    geminiApiKey: (process.env.GEMINI_API_KEY || '').trim(),
    openaiApiKey: (process.env.OPENAI_API_KEY || '').trim(),
  };
}

module.exports = {
  getConfig,
  isConfiguredSupabaseUrl,
};
