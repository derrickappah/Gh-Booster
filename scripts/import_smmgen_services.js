const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { supabaseAdmin } = require('../server/config/supabase');

const PROVIDER_ID = '0f853b26-31e7-4345-8380-4576a8f913e4';

function getIconForPlatform(platformStr) {
  const p = (platformStr || '').toLowerCase();
  if (p.includes('instagram')) return 'src/img/platforms/instagram.png';
  if (p.includes('tiktok')) return 'src/img/platforms/tiktok.png';
  if (p.includes('youtube')) return 'src/img/platforms/youtube.png';
  if (p.includes('telegram')) return 'src/img/platforms/telegram.png';
  if (p.includes('facebook')) return 'src/img/platforms/facebook.png';
  if (p.includes('snapchat')) return 'src/img/platforms/snapchat.png';
  if (p.includes('spotify')) return 'src/img/platforms/spotify.png';
  if (p.includes('twitter') || p.includes('x')) return 'src/img/platforms/twitter.png';
  if (p.includes('whatsapp')) return 'src/img/platforms/whatsapp.png';
  return 'src/img/platforms/instagram.png';
}

function formatCategoryName(platform, serviceType) {
  let pName = (platform || 'General').trim();
  pName = pName.charAt(0).toUpperCase() + pName.slice(1);
  if (pName.toLowerCase() === 'twitter' || pName.toLowerCase() === 'x') pName = 'Twitter / X';
  if (pName.toLowerCase() === 'youtube') pName = 'Youtube';
  if (pName.toLowerCase() === 'tiktok') pName = 'Tiktok';
  if (pName.toLowerCase() === 'whatsapp') pName = 'Whatsapp';
  if (pName.toLowerCase() === 'instagram') pName = 'Instagram';
  if (pName.toLowerCase() === 'facebook') pName = 'Facebook';
  if (pName.toLowerCase() === 'telegram') pName = 'Telegram';
  return `${pName} Services`;
}

async function runImport() {
  const jsonPath = path.join(__dirname, 'filtered_smmgen_items.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('filtered_smmgen_items.json not found!');
    process.exit(1);
  }

  const items = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`Starting import of ${items.length} SMMGen services...`);

  // 1. Fetch categories from Supabase DB
  const { data: dbCategories, error: catErr } = await supabaseAdmin.from('categories').select('*');
  if (catErr) console.error('Error fetching categories:', catErr.message);

  const catMap = new Map();
  (dbCategories || []).forEach(c => catMap.set(c.name.toLowerCase().trim(), c));

  // 2. Ensure all needed categories exist
  for (const item of items) {
    const catName = formatCategoryName(item.platform, item.service_type);
    const catKey = catName.toLowerCase().trim();

    if (!catMap.has(catKey)) {
      console.log(`Creating missing category: ${catName}`);
      const { data: newCat, error: insCatErr } = await supabaseAdmin.from('categories').insert([{
        name: catName,
        icon: getIconForPlatform(item.platform),
        sort_order: catMap.size + 1
      }]).select().single();

      if (newCat) {
        catMap.set(catKey, newCat);
      } else if (insCatErr) {
        console.error(`Failed to create category ${catName}:`, insCatErr.message);
      }
    }
  }

  // 3. Construct service records
  const serviceRecords = items.map(item => {
    const catName = formatCategoryName(item.platform, item.service_type);
    const catObj = catMap.get(catName.toLowerCase().trim());
    const rateVal = parseFloat(item.rate || 0);

    const safeName = (item.name || 'Service').length > 245
      ? (item.name || '').substring(0, 240) + '...'
      : item.name;

    return {
      id: item.id,
      name: safeName,
      category_id: catObj ? catObj.id : null,
      category_name: catName,
      rate_per_1000: rateVal,
      our_price_per_1000: rateVal,
      min_quantity: parseInt(item.min_quantity || 10, 10),
      max_quantity: parseInt(item.max_quantity || 100000, 10),
      status: item.enabled ? 'active' : 'inactive',
      provider_id: PROVIDER_ID,
      provider_service_id: String(item.smmgen_service_id),
      description: item.description || 'Fast execution with high quality retention.'
    };
  });

  // 4. Upsert services into database in batches
  const BATCH_SIZE = 50;
  let successCount = 0;

  for (let i = 0; i < serviceRecords.length; i += BATCH_SIZE) {
    const batch = serviceRecords.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabaseAdmin.from('services').upsert(batch, { onConflict: 'id' }).select();

    if (error) {
      console.error(`Error upserting batch ${i / BATCH_SIZE + 1}:`, error.message);
    } else {
      successCount += (data || []).length;
      console.log(`Upserted batch ${i / BATCH_SIZE + 1}: ${data ? data.length : 0} items`);
    }
  }

  console.log(`\n🎉 IMPORT COMPLETE! Successfully added ${successCount} services with SMMGen service IDs to the database.`);
  process.exit(0);
}

runImport().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
