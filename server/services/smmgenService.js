class SmmgenService {
  static _getCredentials() {
    return {
      url: process.env.SMMGEN_URL || 'https://my.smmgen.com/api/v2',
      key: process.env.SMMGEN_KEY || ''
    };
  }

  static async getBalance() {
    try {
      const { url, key } = SmmgenService._getCredentials();
      if (!key) return { error: 'SMMGen API key not configured' };
      const httpFetch = globalThis.fetch || require('node-fetch');
      const response = await httpFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, action: 'balance' })
      });
      return await response.json();
    } catch (err) {
      console.error('SMMGen getBalance error:', err.message);
      return { error: err.message };
    }
  }

  static async placeOrder({ providerServiceId, link, quantity }) {
    try {
      const { url, key } = SmmgenService._getCredentials();
      if (!key) return { error: 'SMMGen API key not configured' };
      const httpFetch = globalThis.fetch || require('node-fetch');
      const response = await httpFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          action: 'add',
          service: providerServiceId,
          link: link,
          quantity: quantity
        })
      });
      const data = await response.json();
      console.log('[SMMGen] Order placed, ID:', data?.order || 'unknown');
      return data;
    } catch (err) {
      console.error('SMMGen placeOrder error:', err.message);
      return { error: err.message };
    }
  }

  static async getOrderStatus(providerOrderId) {
    try {
      const { url, key } = SmmgenService._getCredentials();
      if (!key) return { error: 'SMMGen API key not configured' };
      const httpFetch = globalThis.fetch || require('node-fetch');
      const response = await httpFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
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
      const { url, key } = SmmgenService._getCredentials();
      if (!key) return { error: 'SMMGen API key not configured' };
      const httpFetch = globalThis.fetch || require('node-fetch');
      const response = await httpFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
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
