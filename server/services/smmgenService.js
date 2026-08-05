class SmmgenService {
  static _getCredentials() {
    return {
      url: process.env.SMMGEN_URL || 'https://my.smmgen.com/api/v2',
      key: process.env.SMMGEN_KEY || ''
    };
  }

  static async _fetchWithTimeout(url, options, timeoutMs = 10000) {
    const httpFetch = globalThis.fetch || require('node-fetch');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await httpFetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return response;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  static async getBalance() {
    try {
      const { url, key } = SmmgenService._getCredentials();
      if (!key) return { error: 'SMMGen API key not configured' };
      const response = await SmmgenService._fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, action: 'balance' })
      });
      let data;
      try {
        data = await response.json();
      } catch (parseErr) {
        const text = await response.text().catch(() => '');
        console.error('[SMMGen] Non-JSON response:', text.substring(0, 200));
        return { error: 'Provider returned invalid response' };
      }
      if (!response.ok) {
        console.error('[SMMGen] HTTP Error:', response.status, data);
        return { error: data?.error || `Provider returned HTTP ${response.status}` };
      }
      return data;
    } catch (err) {
      console.error('SMMGen getBalance error:', err.message);
      return { error: err.message };
    }
  }

  static async placeOrder({ providerServiceId, link, quantity }) {
    try {
      const { url, key } = SmmgenService._getCredentials();
      if (!key) return { error: 'SMMGen API key not configured' };
      const response = await SmmgenService._fetchWithTimeout(url, {
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
      let data;
      try {
        data = await response.json();
      } catch (parseErr) {
        const text = await response.text().catch(() => '');
        console.error('[SMMGen] Non-JSON response:', text.substring(0, 200));
        return { error: 'Provider returned invalid response' };
      }
      if (!response.ok) {
        console.error('[SMMGen] HTTP Error:', response.status, data);
        return { error: data?.error || `Provider returned HTTP ${response.status}` };
      }
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
      const response = await SmmgenService._fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          action: 'status',
          order: providerOrderId
        })
      });
      let data;
      try {
        data = await response.json();
      } catch (parseErr) {
        const text = await response.text().catch(() => '');
        console.error('[SMMGen] Non-JSON response:', text.substring(0, 200));
        return { error: 'Provider returned invalid response' };
      }
      if (!response.ok) {
        console.error('[SMMGen] HTTP Error:', response.status, data);
        return { error: data?.error || `Provider returned HTTP ${response.status}` };
      }
      return data;
    } catch (err) {
      console.error('SMMGen getOrderStatus error:', err.message);
      return { error: err.message };
    }
  }

  static async refillOrder(providerOrderId) {
    try {
      const { url, key } = SmmgenService._getCredentials();
      if (!key) return { error: 'SMMGen API key not configured' };
      const response = await SmmgenService._fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          action: 'refill',
          order: providerOrderId
        })
      });
      let data;
      try {
        data = await response.json();
      } catch (parseErr) {
        const text = await response.text().catch(() => '');
        console.error('[SMMGen] Non-JSON response:', text.substring(0, 200));
        return { error: 'Provider returned invalid response' };
      }
      if (!response.ok) {
        console.error('[SMMGen] HTTP Error:', response.status, data);
        return { error: data?.error || `Provider returned HTTP ${response.status}` };
      }
      return data;
    } catch (err) {
      console.error('SMMGen refillOrder error:', err.message);
      return { error: err.message };
    }
  }
}

module.exports = SmmgenService;
