const { supabaseAdmin } = require('../config/supabase');

class ServiceService {
  static async getAllServices() {
    let { data: services, error: sErr } = await supabaseAdmin
      .from('services')
      .select('*, categories(name, icon)')
      .order('name', { ascending: true });

    if (sErr) console.error('Error fetching services:', sErr.message);

    let { data: categories, error: cErr } = await supabaseAdmin
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (cErr) console.error('Error fetching categories:', cErr.message);

    // Format service data nicely for frontend consumption
    const formattedServices = (services || []).map(s => ({
      id: s.id,
      name: s.name,
      category_id: s.category_id,
      category_name: s.categories?.name || s.category_name || 'General Services',
      rate_per_1k: parseFloat(s.rate_per_1k || s.rate_per_1000 || s.our_price_per_1000 || 1.50),
      min_quantity: s.min_quantity || 10,
      max_quantity: s.max_quantity || 100000,
      description: s.description || 'Fast execution with high retention guarantee.',
      status: s.status || 'active'
    }));

    return {
      categories: categories || [],
      services: formattedServices
    };
  }
}

module.exports = ServiceService;
