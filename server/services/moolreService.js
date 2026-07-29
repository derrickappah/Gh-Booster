const https = require('https');
const http = require('http');
const { supabase, supabaseAdmin } = require('../config/supabase');

/**
 * MoolreService — Integration with Moolre Payment Gateway (Ghana)
 * API Docs: https://moolre.com
 * Supports: Mobile Money (MTN, Telecel, AirtelTigo), Bank Cards
 */
class MoolreService {
  /**
   * Load Moolre credentials from the settings table dynamically.
   * Admin can update these via /admin-payments.html
   */
  static async getCredentials() {
    const { data: rows } = await supabaseAdmin
      .from('settings')
      .select('key, value')
      .in('key', [
        'moolre_api_user',
        'moolre_api_key',
        'moolre_api_pubkey',
        'moolre_account_number',
        'moolre_environment',
        'moolre_enabled'
      ]);

    const settings = {};
    (rows || []).forEach(r => { settings[r.key] = r.value; });

    const environment = settings.moolre_environment || 'sandbox';
    const baseUrl = environment === 'live'
      ? 'https://api.moolre.com'
      : 'https://sandbox.moolre.com';

    return {
      apiUser: settings.moolre_api_user || '',
      apiKey: settings.moolre_api_key || '',
      apiPubkey: settings.moolre_api_pubkey || '',
      accountNumber: settings.moolre_account_number || '',
      environment,
      baseUrl,
      enabled: settings.moolre_enabled !== 'false'
    };
  }

  /**
   * Save / update Moolre gateway configuration in system settings.
   */
  static async saveCredentials({ apiUser, apiKey, apiPubkey, accountNumber, environment, enabled, minDeposit }) {
    const updates = {
      moolre_api_user: apiUser || '',
      moolre_api_key: apiKey || '',
      moolre_api_pubkey: apiPubkey || '',
      moolre_account_number: accountNumber || '',
      moolre_environment: environment || 'sandbox',
      moolre_enabled: enabled !== undefined ? String(enabled) : 'true',
      moolre_min_deposit: minDeposit ? String(minDeposit) : '1'
    };

    for (const [key, value] of Object.entries(updates)) {
      const { error } = await supabaseAdmin
        .from('settings')
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw new Error(`Failed to save setting ${key}: ${error.message}`);
    }

    return { success: true, message: 'Moolre gateway configuration saved successfully.' };
  }

  /**
   * Load all payment gateway display configs for the admin panel.
   */
  static async getGatewayConfigs() {
    const { data: rows } = await supabaseAdmin
      .from('settings')
      .select('key, value');

    const settings = {};
    (rows || []).forEach(r => { settings[r.key] = r.value; });

    return {
      moolre: {
        name: 'Moolre',
        description: 'Mobile Money & Cards – MTN, Telecel, AirtelTigo',
        enabled: settings.moolre_enabled !== 'false',
        environment: settings.moolre_environment || 'sandbox',
        api_user: settings.moolre_api_user ? '••••' + (settings.moolre_api_user || '').slice(-4) : '',
        api_key: settings.moolre_api_key ? '••••' + (settings.moolre_api_key || '').slice(-4) : '',
        api_pubkey: settings.moolre_api_pubkey ? '••••' + (settings.moolre_api_pubkey || '').slice(-4) : '',
        account_number: settings.moolre_account_number || '',
        min_deposit: parseFloat(settings.moolre_min_deposit || '1'),
        fee_percent: 0,
        configured: !!(settings.moolre_api_user && settings.moolre_api_key)
      },
      mtn_momo: {
        name: 'MTN Mobile Money',
        description: 'Local Ghana – via Moolre',
        enabled: settings.moolre_enabled !== 'false',
        min_deposit: parseFloat(settings.moolre_min_deposit || '1'),
        fee_percent: 0
      },
      telecel: {
        name: 'Telecel Cash',
        description: 'Local Ghana – via Moolre',
        enabled: settings.moolre_enabled !== 'false',
        min_deposit: parseFloat(settings.moolre_min_deposit || '1'),
        fee_percent: 0
      },
      airteltigo: {
        name: 'AirtelTigo Money',
        description: 'Local Ghana – via Moolre',
        enabled: settings.moolre_enabled !== 'false',
        min_deposit: parseFloat(settings.moolre_min_deposit || '1'),
        fee_percent: 0
      }
    };
  }

  /**
   * Make an authenticated HTTP request to the Moolre API.
   */
  static async _request({ baseUrl, path, method = 'POST', apiUser, apiKey, apiPubkey, body }) {
    return new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : '';
      const url = new URL(path, baseUrl);
      const isHttps = url.protocol === 'https:';
      const lib = isHttps ? https : http;

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-API-USER': apiUser,
          'X-API-KEY': apiKey,
          ...(apiPubkey ? { 'X-API-PUBKEY': apiPubkey } : {}),
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
        }
      };

      const req = lib.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
          } catch {
            resolve({ statusCode: res.statusCode, body: { raw: data } });
          }
        });
      });

      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  /**
   * Generate a Moolre hosted payment link.
   * Uses POST /embed/link to create a Web POS URL the user is redirected to.
   * Docs: https://moolre.com — "Generate Payment Link API"
   */
  static async generatePaymentLink({ userId, amount, email, description, appUrl }) {
    const creds = await MoolreService.getCredentials();

    if (!creds.enabled) {
      throw new Error('Moolre payment gateway is currently disabled.');
    }
    if (!creds.apiUser) {
      throw new Error('Moolre API credentials are not configured. Please contact the administrator.');
    }

    const amountGHS = parseFloat(amount);
    if (isNaN(amountGHS) || amountGHS <= 0) {
      throw new Error('Invalid payment amount.');
    }

    // Unique reference for this transaction
    const reference = 'GHB-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7).toUpperCase();

    // Log transaction as pending BEFORE API call
    const { data: txn, error: txnErr } = await supabaseAdmin.from('transactions').insert({
      user_id: userId,
      amount: amountGHS,
      currency: 'GHS',
      payment_method: 'Moolre',
      gateway: 'Moolre',
      payment_ref: reference,
      reference,
      type: 'deposit',
      status: 'pending',
      description: description || 'GhBooster wallet top-up',
      metadata: { email, description }
    }).select().single();

    if (txnErr) {
      throw new Error('Failed to create transaction record: ' + txnErr.message);
    }

    const resolvedAppUrl = appUrl || process.env.APP_URL || 'http://localhost:5000';

    // Build the /embed/link request body
    const requestBody = {
      type: 1,
      amount: String(amountGHS.toFixed(2)),
      email: email || creds.apiUser,
      externalref: reference,
      callback: `${resolvedAppUrl}/api/payments/moolre/webhook`,
      redirect: `${resolvedAppUrl}/dashboard.html?deposit=success&ref=${reference}`,
      reusable: '0',
      currency: 'GHS',
      accountnumber: creds.accountNumber,
      metadata: { user_id: userId, source: 'GhBooster' }
    };

    try {
      console.log('[Moolre] Sending request body:', JSON.stringify({
        ...requestBody,
        accountnumber: requestBody.accountnumber ? '***' : '(missing)'
      }));
      const response = await MoolreService._request({
        baseUrl: creds.baseUrl,
        path: '/embed/link',
        method: 'POST',
        apiUser: creds.apiUser,
        apiKey: creds.apiKey,
        apiPubkey: creds.apiPubkey,
        body: requestBody
      });
      console.log('[Moolre] Response status:', response.statusCode, JSON.stringify(response.body));

      const isSuccess = response.statusCode >= 200 && response.statusCode < 300
        && response.body?.status === 1;

      if (isSuccess) {
        const authUrl = response.body?.data?.authorization_url;

        // Store the hosted URL in metadata
        await supabaseAdmin.from('transactions').update({
          metadata: { email, description, authorization_url: authUrl, gateway_response: response.body }
        }).eq('reference', reference);

        return {
          success: true,
          reference,
          transaction_id: txn.id,
          authorization_url: authUrl,
          message: 'Payment link generated. Redirecting to Moolre checkout...',
          environment: creds.environment
        };
      }

      // Duplicate reference error — rethrow with helpful message
      if (response.body?.code === 'INP02') {
        throw new Error('A payment with this reference already exists. Please try again.');
      }

      // In sandbox, simulate a hosted link if API rejects
      if (creds.environment === 'sandbox') {
        return {
          success: true,
          reference,
          transaction_id: txn.id,
          authorization_url: null,
          sandbox: true,
          message: `[SANDBOX] Payment link simulated. Reference: ${reference}`,
          environment: 'sandbox'
        };
      }

      await supabaseAdmin.from('transactions').update({ status: 'failed' }).eq('reference', reference);
      console.error('[Moolre] API error response:', JSON.stringify(response.body));
      throw new Error(response.body?.message || response.body?.error || 'Moolre API returned an error. Please try again.');

    } catch (apiError) {
      if (apiError.message.includes('already exists')) throw apiError;

      if (creds.environment === 'sandbox') {
        return {
          success: true,
          reference,
          transaction_id: txn.id,
          authorization_url: null,
          sandbox: true,
          message: `[SANDBOX] API unreachable. Reference: ${reference}.`,
          environment: 'sandbox'
        };
      }

      await supabaseAdmin.from('transactions').update({ status: 'failed' }).eq('reference', reference);
      console.error('[Moolre] Caught API error:', apiError.message);
      throw new Error('Failed to reach Moolre API: ' + apiError.message);
    }
  }

  /**
   * Verify payment status by reference from Moolre.
   */
  static async verifyPayment({ reference }) {
    const creds = await MoolreService.getCredentials();

    // Look up our local transaction (try reference first, fallback to payment_ref)
    let { data: txn } = await supabase
      .from('transactions')
      .select('*')
      .eq('reference', reference)
      .maybeSingle();

    if (!txn) {
      const fallback = await supabaseAdmin.from('transactions').select('*').eq('payment_ref', reference).maybeSingle();
      txn = fallback.data;
    }

    if (!txn) throw new Error('Transaction not found: ' + reference);

    // If already completed, return current status
    if (txn.status === 'completed') {
      return { success: true, status: 'completed', reference, transaction: txn };
    }

    // Query Moolre API for status
    try {
      const response = await MoolreService._request({
        baseUrl: creds.baseUrl,
        path: `/collections/status/${reference}`,
        method: 'GET',
        apiUser: creds.apiUser,
        apiKey: creds.apiKey,
        apiPubkey: creds.apiPubkey
      });

      const gatewayStatus = response.body?.data?.status || response.body?.status;
      const isCompleted = gatewayStatus === 'completed' || gatewayStatus === 'successful' || gatewayStatus === 'success';

      if (isCompleted) {
        await MoolreService._creditUserWallet(txn.user_id, txn.amount, reference);
        return { success: true, status: 'completed', reference, transaction: txn };
      }

      return { success: true, status: gatewayStatus || 'pending', reference, transaction: txn };
    } catch {
      return { success: true, status: txn.status, reference, transaction: txn };
    }
  }

  /**
   * Complete a payment when the user is redirected back from Moolre's hosted page.
   * The redirect URL itself is issued by Moolre only on successful payment,
   * so we treat it as confirmation and credit the wallet immediately.
   */
  static async completePaymentFromRedirect({ reference, userId }) {
    // Look up the transaction
    let { data: txn } = await supabaseAdmin.from('transactions').select('*').eq('reference', reference).maybeSingle();
    if (!txn) {
      const fb = await supabaseAdmin.from('transactions').select('*').eq('payment_ref', reference).maybeSingle();
      txn = fb.data;
    }
    if (!txn) throw new Error('Transaction not found: ' + reference);

    // Ensure it belongs to the requesting user
    if (txn.user_id !== userId) throw new Error('Transaction does not belong to this user.');

    // Already credited — just return updated balance
    if (txn.status === 'completed') {
      const { data: wallet } = await supabaseAdmin.from('wallets').select('balance').eq('user_id', userId).maybeSingle();
      return { success: true, already_completed: true, balance: wallet?.balance ?? 0, amount: txn.amount };
    }

    // Credit the wallet
    const result = await MoolreService._creditUserWallet(txn.user_id, txn.amount, reference);
    return {
      success: true,
      credited: true,
      amount: txn.amount,
      balance: result.newBalance
    };
  }

  /**
   * Handle incoming webhook from Moolre to automatically credit wallets.
   */
  static async handleWebhook(payload) {
    const reference = payload?.reference || payload?.data?.reference;
    const status = payload?.status || payload?.data?.status;

    if (!reference) {
      throw new Error('Webhook payload missing reference field');
    }

    let { data: txn } = await supabaseAdmin.from('transactions').select('*').eq('reference', reference).maybeSingle();
    if (!txn) {
      const fb = await supabaseAdmin.from('transactions').select('*').eq('payment_ref', reference).maybeSingle();
      txn = fb.data;
    }

    if (!txn) {
      return { received: true, message: 'Transaction not found, ignoring' };
    }

    // Already processed
    if (txn.status === 'completed') {
      return { received: true, message: 'Transaction already completed' };
    }

    const isSuccess = status === 'completed' || status === 'successful' || status === 'success';
    const isFailed = status === 'failed' || status === 'cancelled';

    if (isSuccess) {
      await MoolreService._creditUserWallet(txn.user_id, txn.amount, reference);
      return { received: true, credited: true, amount: txn.amount, user_id: txn.user_id };
    }

    if (isFailed) {
      await supabaseAdmin.from('transactions').update({ status: 'failed' }).eq('reference', reference);
      return { received: true, failed: true };
    }

    return { received: true, status: 'pending' };
  }

  /**
   * Credit a user's wallet and mark the transaction as completed.
   */
  static async _creditUserWallet(userId, amount, reference) {
    const depositAmount = parseFloat(amount);

    // Get current wallet balance
    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const currentBalance = wallet ? parseFloat(wallet.balance) : 0.0;
    const newBalance = currentBalance + depositAmount;

    // Update wallet
    if (wallet && wallet.id) {
      const { error: wErr } = await supabaseAdmin
        .from('wallets')
        .update({
          balance: newBalance,
          currency: 'GHS',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (wErr) {
        console.error('Wallet update error in _creditUserWallet:', wErr.message);
        throw new Error('Failed to credit wallet balance: ' + wErr.message);
      }
    } else {
      const { error: iErr } = await supabaseAdmin
        .from('wallets')
        .insert({
          user_id: userId,
          balance: newBalance,
          currency: 'GHS',
          updated_at: new Date().toISOString()
        });

      if (iErr) {
        console.error('Wallet insert error in _creditUserWallet:', iErr.message);
        throw new Error('Failed to create wallet balance: ' + iErr.message);
      }
    }

    // Mark transaction completed
    if (reference) {
      await supabaseAdmin.from('transactions').update({
        status: 'completed',
        updated_at: new Date().toISOString(),
        metadata: { credited_at: new Date().toISOString() }
      }).or(`reference.eq.${reference},payment_ref.eq.${reference},id.eq.${reference}`);
    }

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      user_id: userId,
      action: 'MOOLRE_DEPOSIT_COMPLETED',
      details: `Moolre deposit of GH₵${depositAmount.toFixed(2)} credited via reference ${reference}`
    });

    return { newBalance, depositAmount };
  }

  /**
   * Manually approve a sandbox/pending transaction (admin use only).
   */
  static async adminApproveTransaction({ reference, adminId }) {
    let { data: txn } = await supabaseAdmin.from('transactions').select('*').eq('reference', reference).maybeSingle();
    if (!txn) {
      const fb = await supabaseAdmin.from('transactions').select('*').eq('payment_ref', reference).maybeSingle();
      txn = fb.data;
    }

    if (!txn) throw new Error('Transaction not found: ' + reference);
    if (txn.status === 'completed') throw new Error('Transaction already completed.');

    const result = await MoolreService._creditUserWallet(txn.user_id, txn.amount, reference);

    await supabaseAdmin.from('audit_logs').insert({
      user_id: adminId,
      action: 'ADMIN_APPROVE_TRANSACTION',
      details: `Admin manually approved transaction ${reference} – GH₵${result.depositAmount.toFixed(2)}`
    });

    return {
      success: true,
      message: `Transaction ${reference} approved. GH₵${result.depositAmount.toFixed(2)} credited to user.`,
      new_balance: result.newBalance
    };
  }
}

module.exports = MoolreService;
