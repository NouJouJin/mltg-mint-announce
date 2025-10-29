import { ethers } from 'ethers';
import { MintEvent } from './types';
import { Notifier } from './notifier';

/**
 * ERC721 Transfer event ABI
 */
const TRANSFER_EVENT_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
];

/**
 * Monitors blockchain for NFT mint events
 */
export class NFTMonitor {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private notifier: Notifier;
  private contractAddress: string;
  private pollInterval: number;
  private lastProcessedBlock: number;
  private isRunning: boolean = false;

  constructor(
    rpcUrl: string,
    contractAddress: string,
    notifier: Notifier,
    startBlock: number = 0,
    pollInterval: number = 15000 // 15 seconds default
  ) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.contractAddress = contractAddress;
    this.contract = new ethers.Contract(contractAddress, TRANSFER_EVENT_ABI, this.provider);
    this.notifier = notifier;
    this.lastProcessedBlock = startBlock;
    this.pollInterval = pollInterval;
  }

  /**
   * Start monitoring for mint events
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[Monitor] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[Monitor] Starting NFT mint monitor...');
    console.log(`[Monitor] Contract: ${this.contractAddress}`);
    console.log(`[Monitor] Starting from block: ${this.lastProcessedBlock || 'latest'}`);

    // If no start block specified, get current block
    if (this.lastProcessedBlock === 0) {
      this.lastProcessedBlock = await this.provider.getBlockNumber();
      console.log(`[Monitor] Current block: ${this.lastProcessedBlock}`);
    }

    // Start polling
    this.poll();
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    console.log('[Monitor] Stopping NFT mint monitor...');
    this.isRunning = false;
  }

  /**
   * Poll for new events
   */
  private async poll(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.checkForNewMints();
      } catch (error) {
        console.error('[Monitor] Error during polling:', error);
      }

      // Wait for next poll
      await this.sleep(this.pollInterval);
    }
  }

  /**
   * Check for new mint events
   */
  private async checkForNewMints(): Promise<void> {
    try {
      const currentBlock = await this.provider.getBlockNumber();

      if (currentBlock <= this.lastProcessedBlock) {
        // No new blocks
        return;
      }

      console.log(`[Monitor] Checking blocks ${this.lastProcessedBlock + 1} to ${currentBlock}`);

      // Query Transfer events
      const filter = this.contract.filters.Transfer(
        ethers.ZeroAddress, // from address = 0x0 (mint only)
        null, // to address = any
        null  // tokenId = any
      );

      const events = await this.contract.queryFilter(
        filter,
        this.lastProcessedBlock + 1,
        currentBlock
      );

      console.log(`[Monitor] Found ${events.length} mint event(s)`);

      // Process each mint event
      for (const event of events) {
        await this.processMintEvent(event);
      }

      // Update last processed block
      this.lastProcessedBlock = currentBlock;

    } catch (error) {
      console.error('[Monitor] Error checking for mints:', error);
      throw error;
    }
  }

  /**
   * Process a single mint event
   */
  private async processMintEvent(event: ethers.EventLog): Promise<void> {
    try {
      const args = event.args;
      if (!args) {
        console.warn('[Monitor] Event has no args');
        return;
      }

      const tokenId = args[2].toString(); // tokenId is the 3rd argument
      const toAddress = args[1]; // to address is the 2nd argument

      console.log(`[Monitor] Processing mint: Token ID ${tokenId} -> ${toAddress}`);

      // Get block timestamp
      const block = await event.getBlock();
      const timestamp = new Date(block.timestamp * 1000);

      const mintEvent: MintEvent = {
        tokenId,
        toAddress,
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        timestamp
      };

      // Send notification
      await this.notifier.sendNotification(mintEvent);

    } catch (error) {
      console.error('[Monitor] Error processing mint event:', error);
      // Don't throw - continue processing other events
    }
  }

  /**
   * Test blockchain connection
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('[Monitor] Testing blockchain connection...');
      const blockNumber = await this.provider.getBlockNumber();
      console.log(`[Monitor] Connected! Current block: ${blockNumber}`);
      return true;
    } catch (error) {
      console.error('[Monitor] Connection test failed:', error);
      return false;
    }
  }

  /**
   * Get contract info
   */
  async getContractInfo(): Promise<void> {
    try {
      console.log('[Monitor] Fetching contract info...');
      const code = await this.provider.getCode(this.contractAddress);

      if (code === '0x') {
        console.warn('[Monitor] WARNING: No contract code found at this address!');
      } else {
        console.log('[Monitor] Contract verified at address');
      }
    } catch (error) {
      console.error('[Monitor] Error fetching contract info:', error);
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
