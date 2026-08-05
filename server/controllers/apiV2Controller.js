const ServiceService = require('../services/serviceService');
const OrderService = require('../services/orderService');
const { supabase, supabaseAdmin } = require('../config/supabase');

class ApiV2Controller {
  static async handleV2Request(req, res, next) {
    const params = { ...req.query, ...(req.body || {}) };
    const { key, action } = params;

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
            rate: (parseFloat(s.rate_per_1k) || 0).toFixed(2),
            min: s.min_quantity,
            max: s.max_quantity
          })));
        }

        case 'add': {
          if (req.method !== 'POST') {
            return res.status(405).json({ error: 'POST method required for order creation' });
          }
          const { service, link, quantity } = params;
          const qty = parseInt(quantity, 10);
          if (!service || typeof service !== 'string' || service.trim().length === 0) {
            return res.status(400).json({ error: 'Service ID is required' });
          }
          if (!link || typeof link !== 'string' || link.trim().length < 5) {
            return res.status(400).json({ error: 'Valid link is required' });
          }
          if (isNaN(qty) || qty <= 0) {
            return res.status(400).json({ error: 'Quantity must be a positive integer' });
          }
          const result = await OrderService.createOrder({
            userId,
            serviceId: service.trim(),
            link: link.trim(),
            quantity: qty
          });
          return res.json({ order: result.order_id });
        }

        case 'status': {
          const { order } = params;
          if (!order) return res.status(400).json({ error: 'Order ID is required' });
          const strOrder = String(order).trim();
          const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(strOrder);
          const isNumeric = /^\d+$/.test(strOrder);

          if (!isUuid && !isNumeric) {
            return res.status(400).json({ error: 'Invalid order ID format' });
          }

          let { data: orderData } = await supabaseAdmin.from('orders').select('*').eq('id', strOrder).maybeSingle();
          if (!orderData) {
            const fb = await supabaseAdmin.from('orders').select('*').eq('provider_order_id', strOrder).maybeSingle();
            orderData = fb.data;
          }

          if (!orderData) return res.status(404).json({ error: 'Order not found' });
          
          if (orderData.user_id !== userId) {
            return res.status(403).json({ error: 'Access denied: You do not have permission to view this order' });
          }

          const chargeVal = parseFloat(orderData.charge || orderData.total_price || 0).toFixed(4);

          return res.json({
            charge: chargeVal,
            start_count: orderData.start_count || 0,
            status: orderData.status,
            remains: orderData.remains || 0,
            currency: 'GHS'
          });
        }

        case 'balance': {
          const { data: wallet } = await supabaseAdmin.from('wallets').select('balance, currency').eq('user_id', userId).maybeSingle();
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
