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

  static async depositMoMo({ userId, amountUsd, gateway = 'Mobile Money (MoMo)' }) {
    const depositAmount = parseFloat(amountUsd);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      throw new Error('Deposit amount must be a positive number');
    }

    // Fetch existing wallet balance
    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const currentBalance = wallet ? parseFloat(wallet.balance) : 0.0;
    const newBalance = currentBalance + depositAmount;

    // Update wallet balance in Supabase
    if (wallet && wallet.id) {
      const { error: wErr } = await supabaseAdmin.from('wallets').update({
        balance: newBalance,
        currency: 'GHS',
        updated_at: new Date().toISOString()
      }).eq('user_id', userId);

      if (wErr) {
        throw new Error('Failed to credit wallet balance: ' + wErr.message);
      }
    } else {
      const { error: iErr } = await supabaseAdmin.from('wallets').insert({
        user_id: userId,
        balance: newBalance,
        currency: 'GHS',
        updated_at: new Date().toISOString()
      });

      if (iErr) {
        throw new Error('Failed to create wallet balance: ' + iErr.message);
      }
    }

    const reference = 'momo_' + Math.random().toString(36).substring(2, 10);

    // Record transaction log in Supabase
    await supabaseAdmin.from('transactions').insert({
      user_id: userId,
      amount: depositAmount,
      currency: 'GHS',
      gateway,
      reference,
      type: 'deposit',
      status: 'completed'
    });

    return {
      reference,
      deposit_amount: depositAmount,
      new_balance: newBalance,
      message: `GH₵${depositAmount.toFixed(2)} deposited successfully!`
    };
  }
}

module.exports = WalletService;
