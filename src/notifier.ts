import axios from 'axios';
import { MintEvent, NotificationPayload } from './types';

/**
 * Sends notification to Google Apps Script webhook
 */
export class Notifier {
  private gasWebhookUrl: string;
  private contractAddress: string;

  constructor(gasWebhookUrl: string, contractAddress: string) {
    this.gasWebhookUrl = gasWebhookUrl;
    this.contractAddress = contractAddress;
  }

  /**
   * Send mint notification to GAS
   */
  async sendNotification(event: MintEvent): Promise<void> {
    const payload: NotificationPayload = {
      tokenId: event.tokenId,
      toAddress: event.toAddress,
      transactionHash: event.transactionHash,
      blockNumber: event.blockNumber,
      timestamp: event.timestamp.toISOString(),
      openseaUrl: `https://opensea.io/assets/matic/${this.contractAddress}/${event.tokenId}`,
      polygonscanUrl: `https://polygonscan.com/tx/${event.transactionHash}`
    };

    try {
      console.log(`[Notifier] Sending notification for Token ID: ${event.tokenId}`);

      const response = await axios.post(this.gasWebhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 seconds timeout
      });

      if (response.status === 200) {
        console.log(`[Notifier] Successfully sent notification for Token ID: ${event.tokenId}`);
      } else {
        console.warn(`[Notifier] Unexpected response status: ${response.status}`);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`[Notifier] Failed to send notification:`, {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data
        });
      } else {
        console.error(`[Notifier] Unknown error:`, error);
      }
      throw error;
    }
  }

  /**
   * Test the GAS webhook connection
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('[Notifier] Testing GAS webhook connection...');
      const testPayload = {
        test: true,
        message: 'Connection test from mltg-mint-announce'
      };

      const response = await axios.post(this.gasWebhookUrl, testPayload, {
        timeout: 5000
      });

      console.log('[Notifier] Connection test successful');
      return response.status === 200;
    } catch (error) {
      console.error('[Notifier] Connection test failed:', error);
      return false;
    }
  }
}
