import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hash,
  parseAbi,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';

export const serverPublicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL),
});

const WAGER_POOL_ABI = parseAbi([
  'function status() view returns (uint8)',
  'function keeper() view returns (address)',
  'function winner() view returns (address)',
  'function isJoined(address player) view returns (bool)',
  'function proposeResult(address _winner)',
  'function finalize()',
  'function getPlayers() view returns (address[])',
  'function buyIn() view returns (uint256)',
  'function poolValue() view returns (uint256)',
  'function proposalTime() view returns (uint256)',
  'function disputeWindow() view returns (uint256)',
  'function claimed() view returns (bool)',
]);

/**
 * Returns a server-side keeper wallet client if KEEPER_PRIVATE_KEY is present
 */
export function getServerKeeperWallet() {
  const privateKey = process.env.KEEPER_PRIVATE_KEY;
  if (!privateKey) {
    return null;
  }

  const cleanKey = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;
  try {
    const account = privateKeyToAccount(cleanKey);
    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(RPC_URL),
    });
    return { walletClient, account, address: account.address };
  } catch (err) {
    console.error('[Wager Keeper] Invalid KEEPER_PRIVATE_KEY format:', err);
    return null;
  }
}

/**
 * Server-authoritative Keeper: proposes the match winner on-chain
 */
export async function keeperProposeResult(
  poolAddress: string,
  winnerAddress: string
): Promise<{ success: boolean; txHash?: Hash; error?: string }> {
  try {
    const cleanPool = poolAddress.trim() as Address;
    const cleanWinner = winnerAddress.trim() as Address;

    const keeperWallet = getServerKeeperWallet();
    if (!keeperWallet) {
      return {
        success: false,
        error: 'KEEPER_PRIVATE_KEY not configured on server. Result can be proposed manually by the keeper wallet in UI.',
      };
    }

    // Check pool status
    const status = (await (serverPublicClient as any).readContract({
      address: cleanPool,
      abi: WAGER_POOL_ABI,
      functionName: 'status',
    })) as number;

    // 1 is Locked
    if (status !== 1) {
      if (status === 2) {
        return { success: true, error: 'Result already proposed.' };
      }
      return {
        success: false,
        error: `Cannot propose result: pool status is ${status} (expected 1: Locked).`,
      };
    }

    // Check if winner joined
    const joined = (await (serverPublicClient as any).readContract({
      address: cleanPool,
      abi: WAGER_POOL_ABI,
      functionName: 'isJoined',
      args: [cleanWinner],
    })) as boolean;

    if (!joined) {
      return {
        success: false,
        error: `Winner address ${cleanWinner} did not join this wager pool.`,
      };
    }

    console.log(`[Wager Keeper] Proposing winner ${cleanWinner} for pool ${cleanPool}...`);

    const txHash = await keeperWallet.walletClient.writeContract({
      address: cleanPool,
      abi: WAGER_POOL_ABI,
      functionName: 'proposeResult',
      args: [cleanWinner],
      account: keeperWallet.account,
      chain: baseSepolia,
    });

    console.log(`[Wager Keeper] ProposeResult tx submitted: ${txHash}. Waiting for receipt...`);
    await serverPublicClient.waitForTransactionReceipt({ hash: txHash });
    console.log(`[Wager Keeper] ProposeResult confirmed on Base Sepolia: ${txHash}`);

    return { success: true, txHash };
  } catch (err: any) {
    console.error('[Wager Keeper] Error proposing result:', err);
    return { success: false, error: err?.message || 'Failed to propose result on-chain' };
  }
}

/**
 * Reads on-chain pool status for server monitoring
 */
export async function getServerPoolStatus(poolAddress: string) {
  try {
    const cleanPool = poolAddress.trim() as Address;
    const [status, winner, players, buyIn, proposalTime, disputeWindow, claimed] = await Promise.all([
      (serverPublicClient as any).readContract({ address: cleanPool, abi: WAGER_POOL_ABI, functionName: 'status' }) as Promise<number>,
      (serverPublicClient as any).readContract({ address: cleanPool, abi: WAGER_POOL_ABI, functionName: 'winner' }) as Promise<Address>,
      (serverPublicClient as any).readContract({ address: cleanPool, abi: WAGER_POOL_ABI, functionName: 'getPlayers' }) as Promise<Address[]>,
      (serverPublicClient as any).readContract({ address: cleanPool, abi: WAGER_POOL_ABI, functionName: 'buyIn' }) as Promise<bigint>,
      (serverPublicClient as any).readContract({ address: cleanPool, abi: WAGER_POOL_ABI, functionName: 'proposalTime' }) as Promise<bigint>,
      (serverPublicClient as any).readContract({ address: cleanPool, abi: WAGER_POOL_ABI, functionName: 'disputeWindow' }) as Promise<bigint>,
      (serverPublicClient as any).readContract({ address: cleanPool, abi: WAGER_POOL_ABI, functionName: 'claimed' }) as Promise<boolean>,
    ]);

    return {
      status,
      winner,
      players,
      buyIn: buyIn.toString(),
      proposalTime: Number(proposalTime),
      disputeWindow: Number(disputeWindow),
      claimed,
    };
  } catch (err: any) {
    return { error: err?.message || 'Failed to read pool' };
  }
}

/**
 * Server-assisted Faucet: Mints testnet MockUSDC (mUSDC) to a recipient address
 */
export async function serverMintMockUsdc(
  recipientAddress: string,
  amountDollars: number = 50
): Promise<{ success: boolean; txHash?: Hash; error?: string }> {
  try {
    const cleanRecipient = recipientAddress.trim() as Address;
    const keeperWallet = getServerKeeperWallet();
    if (!keeperWallet) {
      return {
        success: false,
        error: 'KEEPER_PRIVATE_KEY is not configured on the server. Please mint directly using your connected Web3 wallet.',
      };
    }

    const mockUsdcAddress = (
      process.env.VITE_MOCK_USDC_ADDRESS ||
      process.env.MOCK_USDC_ADDRESS ||
      '0x6482c263a6F3f651Ab292443DC60B378482E5e17'
    ) as Address;

    const amountWei = BigInt(Math.round(amountDollars * 1_000_000));

    console.log(`[Server Faucet] Minting ${amountDollars} MockUSDC to ${cleanRecipient}...`);
    const txHash = await keeperWallet.walletClient.writeContract({
      address: mockUsdcAddress,
      abi: parseAbi(['function mint(address to, uint256 amount)']),
      functionName: 'mint',
      args: [cleanRecipient, amountWei],
      account: keeperWallet.account,
      chain: baseSepolia,
    });

    console.log(`[Server Faucet] Mint tx submitted: ${txHash}. Waiting for receipt...`);
    await serverPublicClient.waitForTransactionReceipt({ hash: txHash });
    console.log(`[Server Faucet] Mint tx confirmed: ${txHash}`);

    return { success: true, txHash };
  } catch (err: any) {
    console.error('[Server Faucet] Error minting MockUSDC:', err);
    return { success: false, error: err?.message || 'Failed to mint MockUSDC from server' };
  }
}

