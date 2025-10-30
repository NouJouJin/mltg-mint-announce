import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const TRANSFER_EVENT_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
];

async function debugMintEvent() {
  const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
  const contractAddress = process.env.CONTRACT_ADDRESS;

  if (!contractAddress) {
    console.error('CONTRACT_ADDRESS not set in .env file');
    process.exit(1);
  }

  console.log('=== NFT Mint Event Debugger ===');
  console.log(`RPC URL: ${rpcUrl}`);
  console.log(`Contract: ${contractAddress}`);
  console.log('');

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(contractAddress, TRANSFER_EVENT_ABI, provider);

  // Get current block
  const currentBlock = await provider.getBlockNumber();
  console.log(`Current block: ${currentBlock}`);
  console.log('');

  // Skip broad search if specific tx/block is provided
  const hasSpecificQuery = process.argv[2] === '--tx' || process.argv[2] === '--block';

  if (!hasSpecificQuery) {
    // Query recent mint events (last 1000 blocks, ~33 minutes on Polygon)
    // Reduced from 10000 to avoid RPC limitations
    const fromBlock = currentBlock - 1000;
    console.log(`Searching for mint events from block ${fromBlock} to ${currentBlock}...`);

    const filter = contract.filters.Transfer(
      ethers.ZeroAddress, // from = 0x0 (mints only)
      null,               // to = any
      null                // tokenId = any
    );

    try {
      const events = await contract.queryFilter(filter, fromBlock, currentBlock);

      console.log(`Found ${events.length} mint event(s)\n`);

      if (events.length > 0) {
        console.log('=== Mint Events ===');
        for (const event of events) {
          if ('args' in event && event.args) {
            const tokenId = event.args[2]?.toString();
            const toAddress = event.args[1];
            const blockNumber = event.blockNumber;
            const txHash = event.transactionHash;

            console.log(`Token ID: ${tokenId}`);
            console.log(`To: ${toAddress}`);
            console.log(`Block: ${blockNumber}`);
            console.log(`Tx Hash: ${txHash}`);
            console.log(`PolygonScan: https://polygonscan.com/tx/${txHash}`);
            console.log('---');
          }
        }
      } else {
        console.log('No mint events found in the last 1000 blocks (~33 minutes).');
        console.log('\nTroubleshooting:');
        console.log('1. Verify the contract address is correct');
        console.log('2. Check if the token was actually minted (not transferred)');
        console.log('3. Try checking a specific transaction hash with --tx option');
      }
    } catch (error: any) {
      console.error('Error querying events:', error.message);
      console.log('\nNote: Public RPC endpoints have block range limitations.');
      console.log('Use --tx <hash> to check a specific transaction instead.');
    }
  }

  // If a specific transaction is provided
  if (process.argv[2] === '--tx' && process.argv[3]) {
    const txHash = process.argv[3];
    console.log(`\n=== Checking specific transaction: ${txHash} ===`);

    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if (!receipt) {
        console.log('Transaction not found');
        return;
      }

      console.log(`Block: ${receipt.blockNumber}`);
      console.log(`Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
      console.log(`Logs count: ${receipt.logs.length}`);
      console.log('');

      // Show all logs first
      console.log('=== All Transaction Logs ===');
      for (let i = 0; i < receipt.logs.length; i++) {
        const log = receipt.logs[i];
        console.log(`\nLog #${i}:`);
        console.log(`  Address: ${log.address}`);
        console.log(`  Topics: ${log.topics.length} topic(s)`);
        if (log.topics.length > 0) {
          console.log(`    Topic[0] (Event Signature): ${log.topics[0]}`);
        }
        console.log(`  Is from our contract: ${log.address.toLowerCase() === contractAddress.toLowerCase()}`);
      }

      console.log('\n=== Parsing Transfer Events ===');
      let foundTransfer = false;

      // Parse logs
      for (const log of receipt.logs) {
        try {
          // Check all logs, not just from our contract
          const parsed = contract.interface.parseLog({
            topics: [...log.topics],
            data: log.data
          });

          if (parsed && parsed.name === 'Transfer') {
            foundTransfer = true;
            console.log('\n✓ Transfer Event Found:');
            console.log(`  Contract: ${log.address}`);
            console.log(`  From: ${parsed.args[0]}`);
            console.log(`  To: ${parsed.args[1]}`);
            console.log(`  Token ID: ${parsed.args[2]?.toString()}`);

            if (log.address.toLowerCase() !== contractAddress.toLowerCase()) {
              console.log(`  ⚠ WARNING: Event is from ${log.address}, not from expected contract ${contractAddress}`);
            }

            if (parsed.args[0] === ethers.ZeroAddress) {
              console.log('  ✓ This is a MINT event (from = 0x0)');
            } else {
              console.log('  ✗ This is a TRANSFER event (not a mint)');
              console.log(`    From address: ${parsed.args[0]}`);
            }
          }
        } catch (e) {
          // This log is not a Transfer event or can't be parsed
        }
      }

      if (!foundTransfer) {
        console.log('\n✗ No Transfer events found in this transaction');
        console.log('This might not be a mint/transfer transaction, or uses a different event signature.');
      }
    } catch (error) {
      console.error('Error fetching transaction:', error);
    }
  }

  // If a specific block is provided
  if (process.argv[2] === '--block' && process.argv[3]) {
    const blockNum = parseInt(process.argv[3]);
    console.log(`\n=== Checking specific block: ${blockNum} ===`);

    const blockFilter = contract.filters.Transfer(ethers.ZeroAddress, null, null);
    const blockEvents = await contract.queryFilter(blockFilter, blockNum, blockNum);

    console.log(`Found ${blockEvents.length} mint event(s) in block ${blockNum}`);

    for (const event of blockEvents) {
      if ('args' in event && event.args) {
        console.log(`Token ID: ${event.args[2]?.toString()}`);
        console.log(`To: ${event.args[1]}`);
        console.log(`Tx: ${event.transactionHash}`);
      }
    }
  }
}

debugMintEvent().catch(console.error);
