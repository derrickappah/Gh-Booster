const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdnpjbWV4cmtraXV0YndieG9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMzU0NTQsImV4cCI6MjEwMDgxMTQ1NH0.fWjlP1tWfJCNcREFqsE7GG8I2ohdc6OvD3Lv3iXxNfo';
const DEFAULT_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkdnpjbWV4cmtraXV0YndieG9zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTIzNTQ1NCwiZXhwIjoyMTAwODExNDU0fQ.svkHPYSpNoLTYG5cd8hnN2g9fiT2bR8Jry5V7XP3WaU';
const DEFAULT_JWT_SECRET = 'ZkwZlkqvEAVzu7G/20ReBP5Pw0AiERdSAR0rkfIETHEH1y6EeW+99Jvi1iiJMJDKaV5/hN3lDNHUwn5fEsz+Ng==';

const env = {
  PORT: process.env.PORT || 5000,
  SUPABASE_URL: process.env.SUPABASE_URL || 'https://jdvzcmexrkkiutbwbxos.supabase.co',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || DEFAULT_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SERVICE_ROLE_KEY,
  JWT_SECRET: process.env.JWT_SECRET || DEFAULT_JWT_SECRET,
  NODE_ENV: process.env.NODE_ENV || 'development'
};

module.exports = env;
