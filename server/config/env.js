const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const env = {
  PORT: process.env.PORT || 5000,
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  JWT_SECRET: process.env.JWT_SECRET || '',
  NODE_ENV: process.env.NODE_ENV || 'development',
  APP_URL: process.env.APP_URL || ''
};

const missingVars = [];
if (!env.SUPABASE_URL) missingVars.push('SUPABASE_URL');
if (!env.SUPABASE_ANON_KEY) missingVars.push('SUPABASE_ANON_KEY');
if (!env.SUPABASE_SERVICE_ROLE_KEY) missingVars.push('SUPABASE_SERVICE_ROLE_KEY');
if (!env.JWT_SECRET) missingVars.push('JWT_SECRET');

if (missingVars.length > 0) {
  console.error(`[FATAL CONFIG ERROR] Missing required environment variable(s) on server: ${missingVars.join(', ')}. Please configure them in Vercel project Environment Variables.`);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

module.exports = env;



