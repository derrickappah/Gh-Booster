const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const env = {
  PORT: process.env.PORT || 5000,
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  JWT_SECRET: process.env.JWT_SECRET || '',
  NODE_ENV: process.env.NODE_ENV || 'development'
};

if (!env.JWT_SECRET) {
  if (env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET environment variable must be set in production!');
  } else {
    env.JWT_SECRET = 'ZkwZlkqvEAVzu7G/20ReBP5Pw0AiERdSAR0rkfIETHEH1y6EeW+99Jvi1iiJMJDKaV5/hN3lDNHUwn5fEsz+Ng==';
  }
}

module.exports = env;


