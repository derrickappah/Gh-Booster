const supabase = require('./server/supabase');

async function testConn() {
  try {
    const { data: services, error: sErr } = await supabase.from('services').select('id, name, rate_per_1000, category_name').limit(3);
    if (sErr) throw sErr;
    console.log('✅ Connected to GhBooster Supabase! Sample Services:', services);

    const { data: categories, error: cErr } = await supabase.from('categories').select('*').limit(3);
    if (cErr) throw cErr;
    console.log('✅ Categories sample count:', categories.length);

    const { data: profiles, error: pErr } = await supabase.from('profiles').select('*').limit(2);
    if (pErr) throw pErr;
    console.log('✅ Profiles table status: OK (rows: ' + profiles.length + ')');
  } catch (err) {
    console.error('❌ Supabase connection error:', err.message);
  }
}

testConn();
