const app = require('./app');
const env = require('./config/env');
const OrderService = require('./services/orderService');
const MoolreService = require('./services/moolreService');

const PORT = env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 Backend connected to Supabase: ${env.SUPABASE_URL}`);

  // Run initial auto-repair for any pending deposits already credited
  MoolreService.repairPendingCompletedTransactions().then(count => {
    if (count > 0) console.log(`[AutoRepair Startup] Marked ${count} credited deposit transaction(s) as completed.`);
  }).catch(() => {});

  // Start Background Order & Deposit Status Sync Worker (Runs every 60 seconds)
  const SYNC_INTERVAL_MS = 60000;
  setInterval(async () => {
    try {
      const updatedCount = await OrderService.syncAllNonFinalizedOrders();
      if (updatedCount > 0) {
        console.log(`[Background Sync] Successfully updated ${updatedCount} active order(s) in Supabase database.`);
      }
      await MoolreService.repairPendingCompletedTransactions();
    } catch (err) {
      console.error('[Background Sync Worker Error]:', err.message);
    }
  }, SYNC_INTERVAL_MS);
});
