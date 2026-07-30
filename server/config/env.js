const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

// Validate critical environment variables at startup
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'super-secret-jwt-key') {
  console.error('[FATAL] JWT_SECRET environment variable is not set or is using the insecure default. Set a strong, unique secret in your .env file.');
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

const env = {
  PORT: process.env.PORT || 5000,
  SUPABASE_URL: process.env.SUPABASE_URL || 'https://jdvzcmexrkkiutbwbxos.supabase.co',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '',
  JWT_SECRET: JWT_SECRET || 'dev-only-insecure-fallback-' + Date.now(),
  NODE_ENV: process.env.NODE_ENV || 'development'
};

module.exports = env;
