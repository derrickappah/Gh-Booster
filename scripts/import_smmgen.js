const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { supabaseAdmin } = require('../server/config/supabase');

const SMMGEN_URL = 'https://my.smmgen.com/api/v2';
const SMMGEN_KEY = '8cd0cb8c20e3d65e85280a858ad36964';
const PROVIDER_ID = '0f853b26-31e7-4345-8380-4576a8f913e4';

// Live Market Exchange Rate (July 2026): 1 USD = 11.65 GHS
// Option A (+20% profit margin): 11.65 * 1.20 = 13.98 GHS per USD
const USD_TO_GHS_MULTIPLIER = 13.98;
const BATCH_SIZE = 500;

async function runImport() {
  console.log('Fetching services from smmgen API (https://my.smmgen.com/api/v2)...');
  
  const httpFetch = globalThis.fetch || require('node-fetch');
  const response = await httpFetch(SMMGEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: SMMGEN_KEY, action: 'services' })
  });

  const rawServices = await response.json();
  if (!Array.isArray(rawServices)) {
    console.error('API response error or invalid array:', rawServices);
    return;
  }

  console.log(`Successfully fetched ${rawServices.length} services from smmgen!`);

  // Clear existing smmgen provider services to avoid duplicates
  console.log('Clearing old smmgen services from Supabase...');
  const { error: delErr } = await supabaseAdmin.from('services').delete().eq('provider_id', PROVIDER_ID);
  if (delErr) console.error('Error clearing old services:', delErr.message);

  // Fetch existing categories from DB
  const { data: dbCategories, error: catErr } = await supabaseAdmin.from('categories').select('*');
  if (catErr) console.error('Error fetching categories:', catErr.message);

  const catMap = new Map();
  (dbCategories || []).forEach(c => {
    catMap.set(c.name.toLowerCase().trim(), c);
  });

  function getIconForCategory(catName) {
    const lower = catName.toLowerCase();
    if (lower.includes('instagram')) return 'src/img/platforms/instagram.png';
    if (lower.includes('tiktok')) return 'src/img/platforms/tiktok.png';
    if (lower.includes('youtube')) return 'src/img/platforms/youtube.png';
    if (lower.includes('telegram')) return 'src/img/platforms/telegram.png';
    if (lower.includes('facebook')) return 'src/img/platforms/facebook.png';
    if (lower.includes('snapchat')) return 'src/img/platforms/snapchat.png';
    if (lower.includes('spotify')) return 'src/img/platforms/spotify.png';
    if (lower.includes('twitter') || lower.includes('x ')) return 'src/img/platforms/twitter.png';
    if (lower.includes('whatsapp')) return 'src/img/platforms/whatsapp.png';
    return 'src/img/platforms/instagram.png';
  }

  let importedCount = 0;
  let batch = [];

  for (const item of rawServices) {
    let cleanCatName = (item.category || 'General Services')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .trim();
    if (!cleanCatName) cleanCatName = 'General Services';
    const catKey = cleanCatName.toLowerCase();

    let catObj = catMap.get(catKey);

    if (!catObj) {
      const { data: newCat } = await supabaseAdmin.from('categories').insert([{
        name: cleanCatName,
        icon: getIconForCategory(cleanCatName),
        sort_order: catMap.size + 1
      }]).select().single();

      if (newCat) {
        catObj = newCat;
        catMap.set(catKey, catObj);
      }
    }

    const wholesaleUsd = parseFloat(item.rate || 0);
    // 1 USD = 11.65 GHS + 20% margin = 13.98 GHS/USD
    const rawGhs = wholesaleUsd * USD_TO_GHS_MULTIPLIER;
    const ghsRate = Math.min(99999.99, Math.max(0.01, parseFloat(rawGhs.toFixed(4))));

    const serviceRecord = {
      name: item.name,
      category_id: catObj ? catObj.id : null,
      category_name: cleanCatName,
      rate_per_1000: ghsRate,
      our_price_per_1000: ghsRate,
      min_quantity: parseInt(item.min || 100, 10),
      max_quantity: parseInt(item.max || 100000, 10),
      status: 'active',
      provider_id: PROVIDER_ID,
      provider_service_id: String(item.service),
      description: item.type ? `Service Type: ${item.type}. Fast & automated delivery.` : 'Fast execution with high retention guarantee.'
    };

    batch.push(serviceRecord);
    importedCount++;

    if (batch.length >= BATCH_SIZE) {
      console.log(`Inserting batch of ${batch.length} records... (${importedCount}/${rawServices.length})`);
      const { error: insertErr } = await supabaseAdmin.from('services').insert(batch);
      if (insertErr) {
        console.error('Batch insert error:', insertErr.message);
      }
      batch = [];
    }
  }

  if (batch.length > 0) {
    console.log(`Inserting final batch of ${batch.length} records... (${importedCount}/${rawServices.length})`);
    const { error: insertErr } = await supabaseAdmin.from('services').insert(batch);
    if (insertErr) console.error('Final batch insert error:', insertErr.message);
  }

  console.log(`🎉 RE-IMPORT COMPLETE: ${importedCount} smmgen services updated with accurate Option A prices (1 USD = 11.65 GHS + 20% margin)!`);
  process.exit(0);
}

runImport().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
