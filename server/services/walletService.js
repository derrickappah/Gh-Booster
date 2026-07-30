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
      .order('created_at', { ascending: false });

    return {
      balance: wallet ? parseFloat(wallet.balance) : 0.0,
      currency: wallet?.currency || 'GHS',
      transactions: transactions || []
    };
  }

}

module.exports = WalletService;
