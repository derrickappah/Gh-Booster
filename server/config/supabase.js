const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: false
  }
});

// Admin client for backend operations requiring elevated permissions
if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[Supabase] ⚠️  SUPABASE_SERVICE_ROLE_KEY is not set in .env — supabaseAdmin will use anon key and may be blocked by RLS.');
}
const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

module.exports = { supabase, supabaseAdmin };
