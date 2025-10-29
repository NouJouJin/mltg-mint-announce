import dotenv from 'dotenv';
import { NFTMonitor } from './monitor';
import { Notifier } from './notifier';
import { Config } from './types';

// Load environment variables
dotenv.config();

/**
 * Load configuration from environment variables
 */
function loadConfig(): Config {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  const polygonRpcUrl = process.env.POLYGON_RPC_URL;
  const gasWebhookUrl = process.env.GAS_WEBHOOK_URL;
  const startBlock = process.env.START_BLOCK ? parseInt(process.env.START_BLOCK) : undefined;
  const pollInterval = process.env.POLL_INTERVAL ? parseInt(process.env.POLL_INTERVAL) : 15000;

  // Validate required variables
  if (!contractAddress) {
    throw new Error('CONTRACT_ADDRESS is required in .env');
  }
  if (!polygonRpcUrl) {
    throw new Error('POLYGON_RPC_URL is required in .env');
  }
  if (!gasWebhookUrl) {
    throw new Error('GAS_WEBHOOK_URL is required in .env');
  }

  return {
    contractAddress,
    polygonRpcUrl,
    gasWebhookUrl,
    startBlock,
    pollInterval
  };
}

/**
 * Main application entry point
 */
async function main() {
  console.log('='.repeat(60));
  console.log('NFT Mint Notification System');
  console.log('MetaGriLabo Thanks Gift Farming 2025');
  console.log('='.repeat(60));
  console.log();

  try {
    // Load configuration
    const config = loadConfig();

    console.log('[Config] Loaded configuration:');
    console.log(`  Contract: ${config.contractAddress}`);
    console.log(`  RPC URL: ${config.polygonRpcUrl}`);
    console.log(`  GAS Webhook: ${config.gasWebhookUrl}`);
    console.log(`  Start Block: ${config.startBlock || 'latest'}`);
    console.log(`  Poll Interval: ${config.pollInterval}ms`);
    console.log();

    // Initialize components
    const notifier = new Notifier(config.gasWebhookUrl, config.contractAddress);
    const monitor = new NFTMonitor(
      config.polygonRpcUrl,
      config.contractAddress,
      notifier,
      config.startBlock,
      config.pollInterval
    );

    // Test connections
    console.log('[Startup] Testing connections...');
    const blockchainConnected = await monitor.testConnection();
    const gasConnected = await notifier.testConnection();

    if (!blockchainConnected) {
      throw new Error('Failed to connect to Polygon blockchain');
    }
    if (!gasConnected) {
      console.warn('[Startup] WARNING: GAS webhook test failed. Will retry on actual events.');
    }

    console.log();

    // Get contract info
    await monitor.getContractInfo();
    console.log();

    // Start monitoring
    console.log('[Startup] Starting monitoring...');
    await monitor.start();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log();
      console.log('[Shutdown] Received SIGINT, shutting down gracefully...');
      monitor.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log();
      console.log('[Shutdown] Received SIGTERM, shutting down gracefully...');
      monitor.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('[Error] Fatal error:', error);
    process.exit(1);
  }
}

// Start the application
main().catch((error) => {
  console.error('[Fatal] Unhandled error:', error);
  process.exit(1);
});
