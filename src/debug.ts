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

  // Query recent mint events (last 10000 blocks, ~5.5 hours on Polygon)
  const fromBlock = currentBlock - 10000;
  console.log(`Searching for mint events from block ${fromBlock} to ${currentBlock}...`);

  const filter = contract.filters.Transfer(
    ethers.ZeroAddress, // from = 0x0 (mints only)
    null,               // to = any
    null                // tokenId = any
  );

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
    console.log('No mint events found in the last 10000 blocks.');
    console.log('\nTroubleshooting:');
    console.log('1. Verify the contract address is correct');
    console.log('2. Check if the token was actually minted (not transferred)');
    console.log('3. Try checking a specific transaction hash with --tx option');
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

      // Parse logs
      for (const log of receipt.logs) {
        try {
          // Only parse logs from our contract
          if (log.address.toLowerCase() === contractAddress.toLowerCase()) {
            const parsed = contract.interface.parseLog({
              topics: [...log.topics],
              data: log.data
            });

            if (parsed && parsed.name === 'Transfer') {
              console.log('Transfer Event Found:');
              console.log(`  From: ${parsed.args[0]}`);
              console.log(`  To: ${parsed.args[1]}`);
              console.log(`  Token ID: ${parsed.args[2]?.toString()}`);

              if (parsed.args[0] === ethers.ZeroAddress) {
                console.log('  ✓ This is a MINT event (from = 0x0)');
              } else {
                console.log('  ✗ This is a TRANSFER event (not a mint)');
              }
            }
          }
        } catch (e) {
          // Skip logs that can't be parsed
        }
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
