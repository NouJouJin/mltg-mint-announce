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
