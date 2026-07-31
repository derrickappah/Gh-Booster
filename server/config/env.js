const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'ghbooster-production-secure-fallback-jwt-key-2026';
if (!process.env.JWT_SECRET) {
  console.warn('[WARNING] JWT_SECRET environment variable is not set. Using fallback secret key.');
}

const env = {
  PORT: process.env.PORT || 5000,
  SUPABASE_URL: process.env.SUPABASE_URL || 'https://jdvzcmexrkkiutbwbxos.supabase.co',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '',
  JWT_SECRET: JWT_SECRET,
  NODE_ENV: process.env.NODE_ENV || 'development'
};

module.exports = env;
