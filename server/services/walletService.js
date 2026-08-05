const { supabaseAdmin } = require('../config/supabase');

class WalletService {
  static async getWalletDetails(userId) {
    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('balance, currency')
      .eq('user_id', userId)
      .maybeSingle();

    const { data: transactions } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200);

    return {
      balance: wallet ? parseFloat(wallet.balance) : 0.0,
      currency: wallet?.currency || 'GHS',
      transactions: transactions || []
    };
  }

  /**
   * Credit a user's wallet atomically via the database RPC function.
   * @param {string} userId - The user's UUID
   * @param {number} amount - The amount to credit (must be > 0)
   * @param {string} [description] - Optional description for logging
   * @returns {Promise<{newBalance: number}>}
   */
  static async credit(userId, amount, description = '') {
    if (!userId) throw new Error('User ID is required for wallet credit');
    if (typeof amount !== 'number' || amount <= 0) throw new Error('Credit amount must be a positive number');

    const { data: rpcBalance, error: rpcErr } = await supabaseAdmin.rpc('credit_wallet', {
      p_user_id: userId,
      p_amount: amount
    });

    if (rpcErr) {
      console.error('[WalletService.credit] RPC failed:', rpcErr.message);
      throw new Error('Wallet credit operation failed: ' + rpcErr.message);
    }

    return { newBalance: parseFloat(rpcBalance) };
  }

  /**
   * Debit a user's wallet atomically via the database RPC function.
   * @param {string} userId - The user's UUID
   * @param {number} amount - The amount to debit (must be > 0)
   * @param {string} [description] - Optional description for logging
   * @returns {Promise<{newBalance: number}>}
   */
  static async debit(userId, amount, description = '') {
    if (!userId) throw new Error('User ID is required for wallet debit');
    if (typeof amount !== 'number' || amount <= 0) throw new Error('Debit amount must be a positive number');

    const { data: rpcBalance, error: rpcErr } = await supabaseAdmin.rpc('debit_wallet', {
      p_user_id: userId,
      p_amount: amount
    });

    if (rpcErr) {
      const errMsg = rpcErr.message || '';
      if (errMsg.toLowerCase().includes('insufficient') || errMsg.toLowerCase().includes('balance')) {
        throw new Error('Insufficient wallet balance');
      }
      console.error('[WalletService.debit] RPC failed:', errMsg);
      throw new Error('Wallet debit operation failed: ' + errMsg);
    }

    return { newBalance: parseFloat(rpcBalance) };
  }
}

module.exports = WalletService;
