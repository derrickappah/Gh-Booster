const app = require('./app');
const env = require('./config/env');
const OrderService = require('./services/orderService');
const MoolreService = require('./services/moolreService');

const PORT = env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 Backend connected to Supabase: ${env.SUPABASE_URL}`);

  // Run initial auto-repair for any pending deposits already credited
  MoolreService.repairPendingCompletedTransactions().then(count => {
    if (count > 0) console.log(`[AutoRepair Startup] Marked ${count} credited deposit transaction(s) as completed.`);
  }).catch(() => {});

  // Start Background Order & Deposit Status Sync Worker (Runs every 60 seconds with overlap protection)
  const SYNC_INTERVAL_MS = 60000;
  let isSyncing = false;
  setInterval(async () => {
    if (isSyncing) return;
    isSyncing = true;
    try {
      const updatedCount = await OrderService.syncAllNonFinalizedOrders();
      if (updatedCount > 0) {
        console.log(`[Background Sync] Successfully updated ${updatedCount} active order(s) in Supabase database.`);
      }
      await MoolreService.repairPendingCompletedTransactions();
    } catch (err) {
      console.error('[Background Sync Worker Error]:', err.message);
    } finally {
      isSyncing = false;
    }
  }, SYNC_INTERVAL_MS);
});

// Graceful shutdown
function shutdown(signal) {
  console.log(`${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
