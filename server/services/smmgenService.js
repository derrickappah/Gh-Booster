class SmmgenService {
  static async _getCredentials(providerId = null) {
    if (process.env.SMMGEN_KEY) {
      return {
        url: process.env.SMMGEN_URL || 'https://my.smmgen.com/api/v2',
        key: process.env.SMMGEN_KEY
      };
    }

    try {
      const { supabaseAdmin } = require('../config/supabase');
      if (providerId) {
        const { data: p } = await supabaseAdmin
          .from('providers')
          .select('api_url, api_key')
          .eq('id', providerId)
          .maybeSingle();
        if (p && p.api_key) {
          return { url: p.api_url || 'https://my.smmgen.com/api/v2', key: p.api_key };
        }
      }

      // Try active provider with key
      const { data: activeProvider } = await supabaseAdmin
        .from('providers')
        .select('api_url, api_key')
        .eq('status', 'active')
        .not('api_key', 'is', null)
        .neq('api_key', '')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (activeProvider && activeProvider.api_key) {
        return { url: activeProvider.api_url || 'https://my.smmgen.com/api/v2', key: activeProvider.api_key };
      }

      // Fallback to any provider with non-empty key
      const { data: anyProvider } = await supabaseAdmin
        .from('providers')
        .select('api_url, api_key')
        .not('api_key', 'is', null)
        .neq('api_key', '')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (anyProvider && anyProvider.api_key) {
        return { url: anyProvider.api_url || 'https://my.smmgen.com/api/v2', key: anyProvider.api_key };
      }
    } catch (dbErr) {
      console.error('[SMMGen] Error fetching provider credentials from DB:', dbErr.message);
    }

    return {
      url: process.env.SMMGEN_URL || 'https://my.smmgen.com/api/v2',
      key: ''
    };
  }

  static async _fetchWithTimeout(url, options, timeoutMs = 10000) {
    const { validateSafeUrl } = require('../utils/urlValidator');
    const urlCheck = await validateSafeUrl(url);
    if (!urlCheck.safe) {
      console.error(`[SMMGen SSRF Blocked] URL: ${url} Reason: ${urlCheck.reason}`);
      throw new Error(`Outbound request blocked by security policy: ${urlCheck.reason}`);
    }

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

  static async getBalance(providerId = null) {
    try {
      const { url, key } = await SmmgenService._getCredentials(providerId);
      if (!key) return { error: 'Service is temporarily unavailable. Please try again later.' };
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
      console.error('[SMMGen] getBalance error:', err.message);
      return { error: 'Service is temporarily unavailable. Please try again later.' };
    }
  }

  static async placeOrder({ providerServiceId, link, quantity, comments = null, providerId = null }) {
    try {
      const { url, key } = await SmmgenService._getCredentials(providerId);
      if (!key) return { error: 'Service is temporarily unavailable. Please try again later.' };
      const bodyPayload = {
        key,
        action: 'add',
        service: providerServiceId,
        link: link,
        quantity: quantity
      };
      if (comments) {
        bodyPayload.comments = comments;
      }
      const response = await SmmgenService._fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
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
      console.error('[SMMGen] placeOrder error:', err.message);
      return { error: 'Your order could not be placed. Please try again.' };
    }
  }

  static async getOrderStatus(providerOrderId, providerId = null) {
    try {
      const { url, key } = await SmmgenService._getCredentials(providerId);
      if (!key) return { error: 'Service is temporarily unavailable. Please try again later.' };
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
      console.error('[SMMGen] getOrderStatus error:', err.message);
      return { error: 'Unable to retrieve order status. Please try again later.' };
    }
  }

  static async refillOrder(providerOrderId, providerId = null) {
    try {
      const { url, key } = await SmmgenService._getCredentials(providerId);
      if (!key) return { error: 'Service is temporarily unavailable. Please try again later.' };
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
      console.error('[SMMGen] refillOrder error:', err.message);
      return { error: 'Your refill request could not be processed. Please try again.' };
    }
  }
}

module.exports = SmmgenService;
