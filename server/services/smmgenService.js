const SMMGEN_URL = process.env.SMMGEN_URL || 'https://my.smmgen.com/api/v2';
const SMMGEN_KEY = process.env.SMMGEN_KEY || '8cd0cb8c20e3d65e85280a858ad36964';

class SmmgenService {
  static async getBalance() {
    try {
      const httpFetch = globalThis.fetch || require('node-fetch');
      const response = await httpFetch(SMMGEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: SMMGEN_KEY, action: 'balance' })
      });
      return await response.json();
    } catch (err) {
      console.error('SMMGen getBalance error:', err.message);
      return { error: err.message };
    }
  }

  static async placeOrder({ providerServiceId, link, quantity }) {
    try {
      const httpFetch = globalThis.fetch || require('node-fetch');
      const response = await httpFetch(SMMGEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: SMMGEN_KEY,
          action: 'add',
          service: providerServiceId,
          link: link,
          quantity: quantity
        })
      });
      const data = await response.json();
      console.log('SMMGen API Place Order Result:', data);
      return data;
    } catch (err) {
      console.error('SMMGen placeOrder error:', err.message);
      return { error: err.message };
    }
  }

  static async getOrderStatus(providerOrderId) {
    try {
      const httpFetch = globalThis.fetch || require('node-fetch');
      const response = await httpFetch(SMMGEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: SMMGEN_KEY,
          action: 'status',
          order: providerOrderId
        })
      });
      return await response.json();
    } catch (err) {
      console.error('SMMGen getOrderStatus error:', err.message);
      return { error: err.message };
    }
  }

  static async refillOrder(providerOrderId) {
    try {
      const httpFetch = globalThis.fetch || require('node-fetch');
      const response = await httpFetch(SMMGEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: SMMGEN_KEY,
          action: 'refill',
          order: providerOrderId
        })
      });
      return await response.json();
    } catch (err) {
      console.error('SMMGen refillOrder error:', err.message);
      return { error: err.message };
    }
  }
}

module.exports = SmmgenService;
