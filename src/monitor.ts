import { ethers } from 'ethers';
import { MintEvent } from './types';
import { Notifier } from './notifier';

/**
 * NFT event ABIs supporting both ERC721 and ERC1155
 */
const NFT_EVENT_ABI = [
  // ERC721 Transfer event
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  // ERC1155 TransferSingle event
  'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
  // ERC1155 TransferBatch event
  'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)'
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
  private maxBlockRange: number;
  private monitorEndDate?: Date;

  constructor(
    rpcUrl: string,
    contractAddress: string,
    notifier: Notifier,
    startBlock: number = 0,
    pollInterval: number = 43200000, // 12時間
    maxBlockRange: number = 1000,
    monitorEndDate?: Date
  ) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.contractAddress = contractAddress;
    this.contract = new ethers.Contract(contractAddress, NFT_EVENT_ABI, this.provider);
    this.notifier = notifier;
    this.lastProcessedBlock = startBlock;
    this.pollInterval = pollInterval;
    this.maxBlockRange = Math.max(1, maxBlockRange);
    this.monitorEndDate = monitorEndDate;
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
    console.log(`[Monitor] Polling interval: ${this.pollInterval / 1000} seconds (${this.pollInterval / 60000} minutes)`);
    console.log(`[Monitor] Max block range/query: ${this.maxBlockRange}`);
    if (this.monitorEndDate) {
      console.log(`[Monitor] Monitoring until: ${this.monitorEndDate.toISOString().slice(0, 10)}`);
    }

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
      // Check if monitoring period has ended
      if (this.monitorEndDate && new Date() > this.monitorEndDate) {
        console.log(`[Monitor] Monitoring period ended (${this.monitorEndDate.toISOString().slice(0, 10)}). Stopping.`);
        this.isRunning = false;
        break;
      }

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

      const allEvents: ethers.EventLog[] = [];
      const fromBlock = this.lastProcessedBlock + 1;
      console.log(`[Monitor] Checking blocks ${fromBlock} to ${currentBlock}`);

      for (let rangeStart = fromBlock; rangeStart <= currentBlock; rangeStart += this.maxBlockRange) {
        const rangeEnd = Math.min(rangeStart + this.maxBlockRange - 1, currentBlock);
        console.log(`[Monitor] Querying block range ${rangeStart}-${rangeEnd}`);

        // ERC721 Transfer events (from = 0x0)
        const erc721Filter = this.contract.filters.Transfer(
          ethers.ZeroAddress,
          null,
          null
        );
        const erc721Events = await this.queryFilterWithRetry(erc721Filter, rangeStart, rangeEnd, 'ERC721');
        for (const event of erc721Events) {
          if ('args' in event && event.args) {
            allEvents.push(event as ethers.EventLog);
          }
        }

        // ERC1155 TransferSingle events (from = 0x0)
        const erc1155SingleFilter = this.contract.filters.TransferSingle(
          null,
          ethers.ZeroAddress,
          null,
          null,
          null
        );
        const erc1155SingleEvents = await this.queryFilterWithRetry(erc1155SingleFilter, rangeStart, rangeEnd, 'ERC1155 TransferSingle');
        for (const event of erc1155SingleEvents) {
          if ('args' in event && event.args) {
            allEvents.push(event as ethers.EventLog);
          }
        }

        // ERC1155 TransferBatch events (from = 0x0)
        const erc1155BatchFilter = this.contract.filters.TransferBatch(
          null,
          ethers.ZeroAddress,
          null,
          null,
          null
        );
        const erc1155BatchEvents = await this.queryFilterWithRetry(erc1155BatchFilter, rangeStart, rangeEnd, 'ERC1155 TransferBatch');
        for (const event of erc1155BatchEvents) {
          if ('args' in event && event.args) {
            allEvents.push(event as ethers.EventLog);
          }
        }
      }

      console.log(`[Monitor] Total: ${allEvents.length} mint event(s) to process`);

      // Process each mint event
      for (const event of allEvents) {
        await this.processMintEvent(event);
      }

      // Update last processed block
      this.lastProcessedBlock = currentBlock;

    } catch (error) {
      console.error('[Monitor] Error checking for mints:', error);
      throw error;
    }
  }

  private async queryFilterWithRetry(
    filter: ethers.DeferredTopicFilter,
    fromBlock: number,
    toBlock: number,
    label: string
  ): Promise<Array<ethers.Log | ethers.EventLog>> {
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const events = await this.contract.queryFilter(filter, fromBlock, toBlock);
        console.log(`[Monitor] Found ${events.length} ${label} mint event(s) in ${fromBlock}-${toBlock}`);
        return events;
      } catch (error) {
        const message = (error as Error).message;
        console.warn(`[Monitor] ${label} query failed (attempt ${attempt}/${maxAttempts}) in ${fromBlock}-${toBlock}: ${message}`);

        if (attempt < maxAttempts) {
          await this.sleep(1000 * attempt);
          continue;
        }
      }
    }

    return [];
  }

  /**
   * Process a single mint event (supports ERC721 and ERC1155)
   */
  private async processMintEvent(event: ethers.EventLog): Promise<void> {
    try {
      const args = event.args;
      if (!args) {
        console.warn('[Monitor] Event has no args');
        return;
      }

      const eventName = event.eventName || event.fragment?.name;

      // Get block timestamp
      const block = await event.getBlock();
      const timestamp = new Date(block.timestamp * 1000);

      if (eventName === 'Transfer') {
        // ERC721: Transfer(address from, address to, uint256 tokenId)
        const tokenId = args[2].toString();
        const toAddress = args[1];

        console.log(`[Monitor] Processing ERC721 mint: Token ID ${tokenId} -> ${toAddress}`);

        const mintEvent: MintEvent = {
          tokenId,
          toAddress,
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
          timestamp
        };

        await this.notifier.sendNotification(mintEvent);

      } else if (eventName === 'TransferSingle') {
        // ERC1155: TransferSingle(address operator, address from, address to, uint256 id, uint256 value)
        const tokenId = args[3].toString();
        const toAddress = args[2];
        const amount = args[4].toString();

        console.log(`[Monitor] Processing ERC1155 mint: Token ID ${tokenId} (×${amount}) -> ${toAddress}`);

        const mintEvent: MintEvent = {
          tokenId,
          toAddress,
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
          timestamp
        };

        await this.notifier.sendNotification(mintEvent);

      } else if (eventName === 'TransferBatch') {
        // ERC1155: TransferBatch(address operator, address from, address to, uint256[] ids, uint256[] values)
        const tokenIds = args[3]; // array of token IDs
        const toAddress = args[2];
        const amounts = args[4]; // array of amounts

        console.log(`[Monitor] Processing ERC1155 batch mint: ${tokenIds.length} tokens -> ${toAddress}`);

        // Process each token in the batch
        for (let i = 0; i < tokenIds.length; i++) {
          const tokenId = tokenIds[i].toString();
          const amount = amounts[i].toString();

          console.log(`[Monitor]   Token ID ${tokenId} (×${amount})`);

          const mintEvent: MintEvent = {
            tokenId,
            toAddress,
            transactionHash: event.transactionHash,
            blockNumber: event.blockNumber,
            timestamp
          };

          await this.notifier.sendNotification(mintEvent);
        }

      } else {
        console.warn(`[Monitor] Unknown event type: ${eventName}`);
      }

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
