const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

const dummyUrl = 'https://placeholder.supabase.co';
const dummyKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy';

const supabaseUrl = env.SUPABASE_URL || dummyUrl;
const supabaseAnonKey = env.SUPABASE_ANON_KEY || dummyKey;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY || dummyKey;

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: false
  }
});

// Admin client for backend operations requiring elevated permissions
if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[FATAL] SUPABASE_SERVICE_ROLE_KEY is missing from environment variables.');
}
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkConnection() {
  try {
    const { error } = await supabaseAdmin.from('profiles').select('id').limit(1);
    if (error) {
      console.error('[Supabase] Connection check failed:', error.message);
      return false;
    }
    console.log('[Supabase] Connection verified successfully.');
    return true;
  } catch (err) {
    console.error('[Supabase] Connection check exception:', err.message);
    return false;
  }
}

module.exports = { supabase, supabaseAdmin, checkConnection };

