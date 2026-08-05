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
        'moolre_enabled',
        'moolre_webhook_secret'
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
      webhookSecret: settings.moolre_webhook_secret || process.env.MOOLRE_WEBHOOK_SECRET || '',
      environment,
      baseUrl,
      enabled: settings.moolre_enabled !== 'false'
    };
  }

  /**
   * Save / update Moolre gateway configuration in system settings.
   */
  static async saveCredentials({ apiUser, apiKey, apiPubkey, accountNumber, environment, enabled, minDeposit, webhookSecret }) {
    const updates = {
      moolre_api_user: apiUser || '',
      moolre_api_key: apiKey || '',
      moolre_api_pubkey: apiPubkey || '',
      moolre_account_number: accountNumber || '',
      moolre_environment: environment || 'sandbox',
      moolre_enabled: enabled !== undefined ? String(enabled) : 'true',
      moolre_min_deposit: minDeposit ? String(minDeposit) : '1',
      moolre_webhook_secret: webhookSecret || ''
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

    // Check minimum deposit amount
    const { data: minDepositRow } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'moolre_min_deposit')
      .maybeSingle();
    const minDeposit = parseFloat(minDepositRow?.value || '1');
    if (amountGHS < minDeposit) {
      throw new Error(`Minimum deposit amount is GH₵${minDeposit.toFixed(2)}.`);
    }
    const maxDeposit = 10000; // GH₵10,000 maximum single deposit
    if (amountGHS > maxDeposit) {
      throw new Error(`Maximum single deposit amount is GH₵${maxDeposit.toFixed(2)}.`);
    }

    // Unique reference for this transaction
    const reference = 'GHB-' + require('crypto').randomUUID().replace(/-/g, '').substring(0, 16).toUpperCase();

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
      console.log('[Moolre] Payment link request sent for reference:', reference);
      const response = await MoolreService._request({
        baseUrl: creds.baseUrl,
        path: '/embed/link',
        method: 'POST',
        apiUser: creds.apiUser,
        apiKey: creds.apiKey,
        apiPubkey: creds.apiPubkey,
        body: requestBody
      });
      console.log('[Moolre] Response status:', response.statusCode);

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
        const fallbackUrl = `${resolvedAppUrl}/dashboard.html?deposit=success&ref=${reference}`;
        return {
          success: true,
          reference,
          transaction_id: txn.id,
          authorization_url: fallbackUrl,
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
        const fallbackUrl = `${resolvedAppUrl}/dashboard.html?deposit=success&ref=${reference}`;
        return {
          success: true,
          reference,
          transaction_id: txn.id,
          authorization_url: fallbackUrl,
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
   * Helper to resolve transaction record by reference or payment_ref.
   */
  static async _findTransactionByRef(ref, select = '*') {
    if (!ref) return null;
    let { data: txn } = await supabaseAdmin
      .from('transactions')
      .select(select)
      .eq('reference', ref)
      .maybeSingle();

    if (!txn) {
      const fb = await supabaseAdmin.from('transactions').select(select).eq('payment_ref', ref).maybeSingle();
      txn = fb.data;
    }
    return txn;
  }

  /**
   * Verify payment status by reference from Moolre.
   */
  static async verifyPayment({ reference, userId }) {
    const creds = await MoolreService.getCredentials();

    // Look up our local transaction using helper
    const txn = await MoolreService._findTransactionByRef(reference);

    if (!txn) throw new Error('Transaction not found: ' + reference);

    if (txn.user_id !== userId) {
      throw new Error('Access denied: Transaction does not belong to this user.');
    }

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

      const gatewayStatus = (response.body?.data?.status || response.body?.status || '').toLowerCase();
      const isCompleted = gatewayStatus === 'completed' || gatewayStatus === 'successful' || gatewayStatus === 'success';

      if (isCompleted) {
        await MoolreService._creditUserWallet(txn.user_id, txn.amount, reference);
        return { success: true, status: 'completed', reference, transaction: txn };
      }

      const isFailed = gatewayStatus === 'failed' || gatewayStatus === 'expired' || gatewayStatus === 'cancelled';
      if (isFailed) {
        await supabaseAdmin.from('transactions').update({ status: gatewayStatus }).eq('id', txn.id);
        return { success: true, status: gatewayStatus, reference, transaction: { ...txn, status: gatewayStatus } };
      }

      return { success: true, status: gatewayStatus || 'pending', reference, transaction: txn };
    } catch {
      // Network/gateway error: return existing local status without marking expired prematurely
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

    // Already credited — ensure status is completed and return updated balance
    if (txn.status === 'completed') {
      const { data: wallet } = await supabaseAdmin.from('wallets').select('balance').eq('user_id', userId).maybeSingle();
      return { success: true, already_completed: true, balance: wallet?.balance ?? 0, amount: txn.amount };
    }

    // Verify status with gateway first before crediting
    const verification = await MoolreService.verifyPayment({ reference, userId });
    if (verification.status !== 'completed') {
      throw new Error('Payment status has not been confirmed as completed by gateway yet.');
    }

    const { data: wallet } = await supabaseAdmin.from('wallets').select('balance').eq('user_id', userId).maybeSingle();
    return {
      success: true,
      credited: true,
      amount: txn.amount,
      balance: wallet?.balance ?? 0
    };
  }

  /**
   * Handle incoming webhook from Moolre to automatically credit wallets.
   */
  static async handleWebhook(payload, signatureHeader) {
    const creds = await MoolreService.getCredentials();

    const validSecret = creds.webhookSecret || creds.apiKey;
    const bodySecret = payload?.data?.secret || payload?.secret;

    if (!validSecret) {
      console.error('[Moolre Webhook] Gateway credentials are not configured on server');
      throw new Error('Moolre gateway credentials are not configured on server');
    }

    let isVerified = false;

    // 1. Verify via payload body secret if supplied
    if (bodySecret && bodySecret === validSecret) {
      isVerified = true;
      console.log('[Moolre Webhook] Valid secret confirmed from payload body');
    }

    // 2. Verify via HMAC signature header if supplied
    if (signatureHeader && creds.apiKey) {
      try {
        const crypto = require('crypto');
        const expectedSig = crypto
          .createHmac('sha256', creds.apiKey)
          .update(typeof payload === 'string' ? payload : JSON.stringify(payload))
          .digest('hex');
        const sigBuffer = Buffer.from(signatureHeader, 'utf8');
        const expectedBuffer = Buffer.from(expectedSig, 'utf8');
        if (sigBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
          isVerified = true;
          console.log('[Moolre Webhook] Valid HMAC signature confirmed from header');
        }
      } catch (sigErr) {
        console.error('[Moolre Webhook] Signature check error:', sigErr.message);
      }
    }

    if (!isVerified) {
      console.error('[Moolre Webhook] Request rejected: missing or invalid webhook signature / secret');
      throw new Error('Invalid or missing webhook signature or secret verification');
    }

    // Support all common reference field names sent by Moolre (externalref, reference, etc.)
    const reference = payload?.externalref ||
                      payload?.external_ref ||
                      payload?.reference ||
                      payload?.tx_ref ||
                      payload?.transaction_ref ||
                      payload?.transid ||
                      payload?.data?.externalref ||
                      payload?.data?.external_ref ||
                      payload?.data?.reference ||
                      payload?.data?.tx_ref ||
                      payload?.metadata?.externalref ||
                      payload?.metadata?.reference;

    if (!reference) {
      console.warn('[Moolre Webhook] Payload missing reference field:', JSON.stringify(payload));
      throw new Error('Webhook payload missing reference field');
    }

    // Extract status code/string from payload
    const rawStatus = payload?.status ?? payload?.data?.status ?? payload?.code ?? payload?.data?.code ?? payload?.transaction_status ?? payload?.payment_status;

    let { data: txn } = await supabaseAdmin.from('transactions').select('*').eq('reference', reference).maybeSingle();
    if (!txn) {
      const fb = await supabaseAdmin.from('transactions').select('*').eq('payment_ref', reference).maybeSingle();
      txn = fb.data;
    }

    if (!txn) {
      console.warn('[Moolre Webhook] Transaction not found for reference:', reference);
      return { received: true, message: 'Transaction not found, ignoring' };
    }

    // Already processed
    if (txn.status === 'completed') {
      return { received: true, message: 'Transaction already completed' };
    }

    // Check status matching string and numeric codes (e.g. 1, '1', 200, 'completed', 'successful', 'success', 'paid')
    const normalizedStatus = String(rawStatus ?? '').toLowerCase().trim();
    const isSuccess = normalizedStatus === 'completed' ||
                      normalizedStatus === 'successful' ||
                      normalizedStatus === 'success' ||
                      normalizedStatus === 'paid' ||
                      rawStatus === 1 ||
                      normalizedStatus === '1' ||
                      rawStatus === 200 ||
                      normalizedStatus === '200' ||
                      normalizedStatus === '00';

    const isFailed = normalizedStatus === 'failed' ||
                     normalizedStatus === 'cancelled' ||
                     normalizedStatus === 'declined' ||
                     rawStatus === -1 ||
                     normalizedStatus === '-1' ||
                     rawStatus === 2 ||
                     normalizedStatus === '2';

    if (isSuccess) {
      await MoolreService._creditUserWallet(txn.user_id, txn.amount, reference);
      return { received: true, credited: true, amount: txn.amount, user_id: txn.user_id };
    }

    // Fallback: If status is unclear or pending, perform direct gateway status check with Moolre API to verify payment
    if (creds.apiUser && creds.apiKey) {
      try {
        const verifyRes = await MoolreService._request({
          baseUrl: creds.baseUrl,
          path: `/collections/status/${reference}`,
          method: 'GET',
          apiUser: creds.apiUser,
          apiKey: creds.apiKey,
          apiPubkey: creds.apiPubkey
        });
        const gStatus = String(verifyRes.body?.data?.status || verifyRes.body?.status || verifyRes.body?.code || '').toLowerCase().trim();
        const gIsSuccess = gStatus === 'completed' || gStatus === 'successful' || gStatus === 'success' || gStatus === 'paid' || verifyRes.body?.status === 1 || gStatus === '1' || gStatus === '200';
        if (gIsSuccess) {
          await MoolreService._creditUserWallet(txn.user_id, txn.amount, reference);
          return { received: true, credited: true, verifiedViaGateway: true, amount: txn.amount, user_id: txn.user_id };
        }
      } catch (vErr) {
        console.warn('[Moolre Webhook Fallback Verification Warning]', vErr.message);
      }
    }

    if (isFailed) {
      await supabaseAdmin.from('transactions').update({ status: 'failed' }).eq('id', txn.id);
      return { received: true, failed: true };
    }

    return { received: true, status: 'pending' };
  }

  /**
   * Credit a user's wallet and mark the transaction as completed.
   */
  static async _creditUserWallet(userId, amount, reference) {
    const depositAmount = parseFloat(amount);

    // Atomically check transaction status and mark completed first to prevent race condition
    if (reference) {
      let { data: targetTxn } = await supabaseAdmin
        .from('transactions')
        .select('id, status, metadata')
        .eq('reference', reference)
        .maybeSingle();

      if (!targetTxn) {
        const fb = await supabaseAdmin.from('transactions').select('id, status, metadata').eq('payment_ref', reference).maybeSingle();
        targetTxn = fb.data;
      }

      if (targetTxn) {
        if (targetTxn.status === 'completed') {
          const { data: currentWallet } = await supabaseAdmin.from('wallets').select('balance').eq('user_id', userId).maybeSingle();
          return { newBalance: currentWallet ? parseFloat(currentWallet.balance) : 0, depositAmount };
        }

        // Conditional atomic status claim to prevent concurrent processing
        const { data: claimedTxn, error: claimErr } = await supabaseAdmin
          .from('transactions')
          .update({
            status: 'processing',
            updated_at: new Date().toISOString(),
            metadata: { ...(targetTxn.metadata || {}), processing_at: new Date().toISOString() }
          })
          .eq('id', targetTxn.id)
          .eq('status', targetTxn.status)
          .select('id')
          .maybeSingle();

        if (claimErr) {
          console.error('[_creditUserWallet] Failed to update transaction status:', claimErr.message);
          throw new Error(`Database error while claiming transaction: ${claimErr.message}`);
        }

        if (!claimedTxn) {
          // Another concurrent request claimed it first
          const { data: currentWallet } = await supabaseAdmin.from('wallets').select('balance').eq('user_id', userId).maybeSingle();
          return { newBalance: currentWallet ? parseFloat(currentWallet.balance) : 0, depositAmount };
        }
      }
    }

    // Atomic wallet credit via PostgreSQL function (prevents race conditions)
    let newBalance;
    try {
      const { data: rpcBalance, error: rpcErr } = await supabaseAdmin.rpc('credit_wallet', {
        p_user_id: userId,
        p_amount: depositAmount
      });
      if (rpcErr) throw rpcErr;
      newBalance = parseFloat(rpcBalance);
    } catch (rpcError) {
      console.error('[_creditUserWallet] credit_wallet RPC failed:', rpcError.message);
      // Revert transaction claim so it can be safely retried
      if (reference) {
        let { data: targetTxn } = await supabaseAdmin
          .from('transactions')
          .select('id, metadata')
          .eq('reference', reference)
          .maybeSingle();
        if (!targetTxn) {
          const fb = await supabaseAdmin.from('transactions').select('id, metadata').eq('payment_ref', reference).maybeSingle();
          targetTxn = fb.data;
        }
        if (targetTxn && targetTxn.id) {
          await supabaseAdmin
            .from('transactions')
            .update({ status: 'pending', updated_at: new Date().toISOString() })
            .eq('id', targetTxn.id);
        }
      }
      throw new Error('Wallet credit operation failed. Please retry or contact support.');
    }

    // Mark transaction completed safely
    if (reference) {
      let { data: targetTxn } = await supabaseAdmin
        .from('transactions')
        .select('id, metadata')
        .eq('reference', reference)
        .maybeSingle();

      if (!targetTxn) {
        const fb = await supabaseAdmin.from('transactions').select('id, metadata').eq('payment_ref', reference).maybeSingle();
        targetTxn = fb.data;
      }

      if (targetTxn && targetTxn.id) {
        const existingMeta = targetTxn.metadata || {};
        await supabaseAdmin
          .from('transactions')
          .update({
            status: 'completed',
            updated_at: new Date().toISOString(),
            metadata: { ...existingMeta, credited_at: new Date().toISOString() }
          })
          .eq('id', targetTxn.id);
      } else {
        await supabaseAdmin
          .from('transactions')
          .update({
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('reference', reference);
      }
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

  /**
   * Self-healing repair: Find all pending deposit transactions whose audit log confirms wallet credit,
   * and update their status to 'completed'.
   */
  static async repairPendingCompletedTransactions(userId = null) {
    try {
      let query = supabaseAdmin
        .from('transactions')
        .select('*')
        .eq('status', 'pending')
        .eq('type', 'deposit');

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data: pendingTxns } = await query;

      if (!pendingTxns || pendingTxns.length === 0) return 0;

      let repairedCount = 0;
      for (const txn of pendingTxns) {
        const ref = txn.reference || txn.payment_ref;
        if (!ref) continue;

        // Check if audit log specifically records that this deposit was credited
        const { data: logs } = await supabaseAdmin
          .from('audit_logs')
          .select('id')
          .eq('user_id', txn.user_id)
          .eq('action', 'MOOLRE_DEPOSIT_COMPLETED')
          .like('details', `%${ref}%`);

        if (logs && logs.length > 0) {
          // Double-check wallet balance exists for user before updating status
          const { data: userWallet } = await supabaseAdmin.from('wallets').select('balance').eq('user_id', txn.user_id).maybeSingle();
          if (userWallet) {
            await supabaseAdmin
              .from('transactions')
              .update({ status: 'completed', updated_at: new Date().toISOString() })
              .eq('id', txn.id);
            repairedCount++;
            console.log(`[AutoRepair] Marked pending deposit #${txn.id} (${ref}) as completed.`);
          }
        }
      }
      return repairedCount;
    } catch (err) {
      console.warn('[AutoRepair Error]', err.message);
      return 0;
    }
  }

  /**
   * Expire pending deposit transactions that are older than 30 minutes.
   */
  static async expirePendingDeposits() {
    try {
      // 1. Try invoking stored procedure if available in Supabase
      const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('expire_old_pending_deposits');
      if (!rpcErr && typeof rpcRes === 'number') {
        if (rpcRes > 0) console.log(`[AutoExpire] Expired ${rpcRes} pending deposit(s) via database function.`);
        return rpcRes;
      }

      // 2. Fallback query if RPC procedure is not executed directly
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: oldPendingTxns, error } = await supabaseAdmin
        .from('transactions')
        .select('*')
        .eq('type', 'deposit')
        .eq('status', 'pending')
        .lt('created_at', thirtyMinsAgo);

      if (error || !oldPendingTxns || oldPendingTxns.length === 0) return 0;

      let expiredCount = 0;
      for (const txn of oldPendingTxns) {
        // Double check audit logs to ensure wallet was not credited
        const ref = txn.reference || txn.payment_ref;
        if (ref) {
          const { data: logs } = await supabaseAdmin
            .from('audit_logs')
            .select('id')
            .eq('user_id', txn.user_id)
            .eq('action', 'MOOLRE_DEPOSIT_COMPLETED')
            .like('details', `%${ref}%`);

          if (logs && logs.length > 0) {
            // Was actually credited, mark completed
            await supabaseAdmin.from('transactions').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', txn.id);
            continue;
          }
        }

        const { error: updateErr } = await supabaseAdmin
          .from('transactions')
          .update({ status: 'expired' })
          .eq('id', txn.id);

        if (!updateErr) {
          expiredCount++;
          console.log(`[AutoExpire] Expired pending deposit #${txn.id} (${ref || 'no-ref'}).`);
        }
      }
      return expiredCount;
    } catch (err) {
      console.warn('[AutoExpire Error]', err.message);
      return 0;
    }
  }
}

module.exports = MoolreService;
