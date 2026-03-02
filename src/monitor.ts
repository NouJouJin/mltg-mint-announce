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

  constructor(
    rpcUrl: string,
    contractAddress: string,
    notifier: Notifier,
    startBlock: number = 0,
    pollInterval: number = 43200000 // 12時間
  ) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.contractAddress = contractAddress;
    this.contract = new ethers.Contract(contractAddress, NFT_EVENT_ABI, this.provider);
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
    console.log(`[Monitor] Polling interval: ${this.pollInterval / 1000} seconds (${this.pollInterval / 60000} minutes)`);

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

      // Query both ERC721 and ERC1155 mint events
      const allEvents: ethers.EventLog[] = [];

      // ERC721 Transfer events (from = 0x0)
      try {
        const erc721Filter = this.contract.filters.Transfer(
          ethers.ZeroAddress, // from address = 0x0 (mint only)
          null, // to address = any
          null  // tokenId = any
        );
        const erc721Events = await this.contract.queryFilter(
          erc721Filter,
          this.lastProcessedBlock + 1,
          currentBlock
        );
        console.log(`[Monitor] Found ${erc721Events.length} ERC721 mint event(s)`);

        for (const event of erc721Events) {
          if ('args' in event && event.args) {
            allEvents.push(event as ethers.EventLog);
          }
        }
      } catch (error) {
        console.log('[Monitor] No ERC721 events or error querying:', (error as Error).message);
      }

      // ERC1155 TransferSingle events (from = 0x0)
      try {
        const erc1155SingleFilter = this.contract.filters.TransferSingle(
          null, // operator = any
          ethers.ZeroAddress, // from = 0x0 (mint only)
          null, // to = any
          null, // id = any
          null  // value = any
        );
        const erc1155SingleEvents = await this.contract.queryFilter(
          erc1155SingleFilter,
          this.lastProcessedBlock + 1,
          currentBlock
        );
        console.log(`[Monitor] Found ${erc1155SingleEvents.length} ERC1155 TransferSingle mint event(s)`);

        for (const event of erc1155SingleEvents) {
          if ('args' in event && event.args) {
            allEvents.push(event as ethers.EventLog);
          }
        }
      } catch (error) {
        console.log('[Monitor] No ERC1155 events or error querying:', (error as Error).message);
      }

      // ERC1155 TransferBatch events (from = 0x0)
      try {
        const erc1155BatchFilter = this.contract.filters.TransferBatch(
          null, // operator = any
          ethers.ZeroAddress, // from = 0x0 (mint only)
          null, // to = any
          null, // ids = any
          null  // values = any
        );
        const erc1155BatchEvents = await this.contract.queryFilter(
          erc1155BatchFilter,
          this.lastProcessedBlock + 1,
          currentBlock
        );
        console.log(`[Monitor] Found ${erc1155BatchEvents.length} ERC1155 TransferBatch mint event(s)`);

        for (const event of erc1155BatchEvents) {
          if ('args' in event && event.args) {
            allEvents.push(event as ethers.EventLog);
          }
        }
      } catch (error) {
        console.log('[Monitor] No ERC1155 batch events or error querying:', (error as Error).message);
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
