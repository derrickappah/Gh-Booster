const ServiceService = require('../services/serviceService');
const OrderService = require('../services/orderService');
const { supabase, supabaseAdmin } = require('../config/supabase');

class ApiV2Controller {
  static async handleV2Request(req, res, next) {
    const { key, action } = req.query.key ? req.query : req.body;

    if (!key) {
      return res.status(401).json({ error: 'API key is required' });
    }

    try {
      // Authenticate via API key in Supabase profiles table using admin client (bypasses RLS)
      const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('api_key', key)
        .maybeSingle();

      if (error || !profile) {
        return res.status(401).json({ error: 'Invalid API Key' });
      }

      const userId = profile.id;

      switch (action) {
        case 'services': {
          const { services } = await ServiceService.getAllServices();
          return res.json(services.map(s => ({
            service: s.id,
            name: s.name,
            category: s.category_name,
            rate: s.rate_per_1k.toFixed(2),
            min: s.min_quantity,
            max: s.max_quantity
          })));
        }

        case 'add': {
          const { service, link, quantity } = req.body.service ? req.body : req.query;
          const result = await OrderService.createOrder({
            userId,
            serviceId: service,
            link,
            quantity
          });
          return res.json({ order: result.order_id });
        }

        case 'status': {
          const { order } = req.query.order ? req.query : req.body;
          const { data: orderData } = await supabaseAdmin.from('orders').select('*').eq('id', order).maybeSingle();
          if (!orderData) return res.status(404).json({ error: 'Order not found' });
          
          if (orderData.user_id !== userId) {
            return res.status(403).json({ error: 'Access denied: You do not have permission to view this order' });
          }

          const chargeVal = parseFloat(orderData.total_price || orderData.charge || 0).toFixed(4);

          return res.json({
            charge: chargeVal,
            start_count: orderData.start_count || 0,
            status: orderData.status,
            remains: orderData.remains || 0,
            currency: 'GHS'
          });
        }

        case 'balance': {
          const { data: wallet } = await supabase.from('wallets').select('balance, currency').eq('user_id', userId).maybeSingle();
          return res.json({
            balance: wallet ? parseFloat(wallet.balance).toFixed(4) : '0.0000',
            currency: wallet?.currency || 'GHS'
          });
        }

        default:
          return res.status(400).json({ error: 'Invalid action parameter' });
      }
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
}

module.exports = ApiV2Controller;
