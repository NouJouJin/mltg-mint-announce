/**
 * NFT Mint event data structure
 */
export interface MintEvent {
  tokenId: string;
  toAddress: string;
  transactionHash: string;
  blockNumber: number;
  timestamp: Date;
}

/**
 * Configuration for the notification system
 */
export interface Config {
  contractAddress: string;
  polygonRpcUrl: string;
  gasWebhookUrl: string;
  startBlock?: number;
  pollInterval: number; // milliseconds
  gasTimeoutMs: number; // webhook timeout in milliseconds
  maxBlockRange: number; // max block span per eth_getLogs query
  monitorEndDate?: Date; // Stop monitoring after this date
}

/**
 * Notification payload sent to GAS
 */
export interface NotificationPayload {
  tokenId: string;
  toAddress: string;
  transactionHash: string;
  blockNumber: number;
  timestamp: string;
  openseaUrl: string;
  polygonscanUrl: string;
}
