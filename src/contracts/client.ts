import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  type Address,
  type WalletClient,
  type PublicClient,
  decodeEventLog,
} from 'viem';
import {
  BASE_SEPOLIA_CHAIN,
  BASE_SEPOLIA_CONFIG,
  FACTORY_ADDRESS,
  MOCK_USDC_ADDRESS,
  DEFAULT_RPC_URL,
  WAGER_POOL_FACTORY_ABI,
  WAGER_POOL_ABI,
  MOCK_USDC_ABI,
  WAGER_POOL_STATUS_MAP,
  parseUsdc,
} from './config';

// Public read-only client for Base Sepolia
export const publicClient: any = createPublicClient({
  chain: BASE_SEPOLIA_CHAIN,
  transport: http(DEFAULT_RPC_URL),
});

export interface WagerPoolState {
  address: `0x${string}`;
  statusNum: number;
  status: 'Open' | 'Locked' | 'Proposed' | 'Disputed' | 'Settled' | 'Refunded';
  host: `0x${string}`;
  keeper: `0x${string}`;
  resolver: `0x${string}`;
  treasury: `0x${string}`;
  usdc: `0x${string}`;
  buyIn: bigint;
  buyInFormatted: string;
  feeBps: number;
  maxPlayers: number;
  players: `0x${string}`[];
  playerCount: number;
  poolValue: bigint;
  payoutAmount: bigint;
  feeAmount: bigint;
  poolBalance: bigint;
  disputeWindow: bigint;
  lobbyTimeout: bigint;
  matchTimeout: bigint;
  createdAt: bigint;
  startedAt: bigint;
  proposalTime: bigint;
  winner: `0x${string}`;
  claimed: boolean;
}

/**
 * Ensures wallet is switched to Base Sepolia (Chain ID 84532)
 */
export async function ensureBaseSepolia(provider?: any): Promise<void> {
  const ethereum = provider || (typeof window !== 'undefined' ? (window as any).ethereum : null);
  if (!ethereum?.request) return;

  const chainIdHex = `0x${BASE_SEPOLIA_CONFIG.chainId.toString(16)}`;

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });
  } catch (switchError: any) {
    // 4902: Chain not added yet
    if (switchError?.code === 4902 || switchError?.message?.includes('4902')) {
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: chainIdHex,
            chainName: BASE_SEPOLIA_CONFIG.name,
            nativeCurrency: BASE_SEPOLIA_CONFIG.nativeCurrency,
            rpcUrls: BASE_SEPOLIA_CONFIG.rpcUrls.default.http,
            blockExplorerUrls: [BASE_SEPOLIA_CONFIG.blockExplorers.default.url],
          },
        ],
      });
    }
  }
}

/**
 * Gets a viable WalletClient from injected window.ethereum or passed provider
 */
export async function getWalletClient(customProvider?: any): Promise<{ walletClient: WalletClient; address: Address }> {
  const ethereum = customProvider || (typeof window !== 'undefined' ? (window as any).ethereum : null);
  if (!ethereum) {
    throw new Error('No crypto wallet detected. Please connect MetaMask, Coinbase Wallet, or Dynamic.');
  }

  await ensureBaseSepolia(ethereum);

  const accounts: string[] = await ethereum.request({ method: 'eth_requestAccounts' });
  if (!accounts || accounts.length === 0) {
    throw new Error('No wallet accounts authorized.');
  }

  const address = accounts[0] as Address;

  const walletClient = createWalletClient({
    account: address,
    chain: BASE_SEPOLIA_CHAIN,
    transport: custom(ethereum),
  });

  return { walletClient, address };
}

/**
 * Reads USDC token balance for an address
 */
export async function getMockUsdcBalance(address: Address): Promise<{ balance: bigint; formatted: string }> {
  try {
    const bal = (await publicClient.readContract({
      address: MOCK_USDC_ADDRESS,
      abi: MOCK_USDC_ABI,
      functionName: 'balanceOf',
      args: [address],
    })) as bigint;

    const whole = bal / 1_000_000n;
    const rem = (bal % 1_000_000n).toString().padStart(6, '0').slice(0, 2);
    return { balance: bal, formatted: `${whole}.${rem}` };
  } catch (err) {
    console.warn('Failed to read MockUSDC balance:', err);
    return { balance: 0n, formatted: '0.00' };
  }
}

/**
 * Reads token allowance granted to a spender (e.g. the WagerPool)
 */
export async function getMockUsdcAllowance(owner: Address, spender: Address): Promise<bigint> {
  try {
    const allowance = (await publicClient.readContract({
      address: MOCK_USDC_ADDRESS,
      abi: MOCK_USDC_ABI,
      functionName: 'allowance',
      args: [owner, spender],
    })) as bigint;
    return allowance;
  } catch (err) {
    console.warn('Failed to read allowance:', err);
    return 0n;
  }
}

/**
 * Mints testnet mUSDC from MockUSDC contract (Free Test Faucet)
 */
export async function mintTestUsdc(
  walletClient: WalletClient,
  recipient: Address,
  amountInDollars = 100
): Promise<string> {
  const amountWei = parseUsdc(amountInDollars);
  const account = walletClient.account || recipient;

  const hash = await walletClient.writeContract({
    address: MOCK_USDC_ADDRESS,
    abi: MOCK_USDC_ABI,
    functionName: 'mint',
    args: [recipient, amountWei],
    account,
    chain: BASE_SEPOLIA_CHAIN,
  });

  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Approves a spender (the WagerPool contract) to transfer buyIn
 */
export async function approveMockUsdc(
  walletClient: WalletClient,
  spender: Address,
  amountWei: bigint
): Promise<string> {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet account required');

  const hash = await walletClient.writeContract({
    address: MOCK_USDC_ADDRESS,
    abi: MOCK_USDC_ABI,
    functionName: 'approve',
    args: [spender, amountWei],
    account,
    chain: BASE_SEPOLIA_CHAIN,
  });

  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Deploys a new WagerPool via WagerPoolFactory
 * Returns the newly created pool address & transaction hash
 */
export async function createWagerPoolOnChain(
  walletClient: WalletClient,
  buyInUsdc: number,
  maxPlayers = 4,
  feeBps = 500 // 5%
): Promise<{ poolAddress: Address; txHash: string }> {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet account required');

  const buyInWei = parseUsdc(buyInUsdc);

  const hash = await walletClient.writeContract({
    address: FACTORY_ADDRESS,
    abi: WAGER_POOL_FACTORY_ABI,
    functionName: 'createPool',
    args: [buyInWei, maxPlayers, feeBps],
    account,
    chain: BASE_SEPOLIA_CHAIN,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  // Find the PoolCreated event in receipt logs
  let poolAddress: Address | null = null;
  for (const log of receipt.logs) {
    try {
      const decoded: any = decodeEventLog({
        abi: WAGER_POOL_FACTORY_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === 'PoolCreated') {
        poolAddress = (decoded.args as any).pool as Address;
        break;
      }
    } catch {
      // ignore other logs
    }
  }

  if (!poolAddress) {
    // Fallback: read latest pool from factory
    const count = (await publicClient.readContract({
      address: FACTORY_ADDRESS,
      abi: WAGER_POOL_FACTORY_ABI,
      functionName: 'poolCount',
    })) as bigint;

    if (count > 0n) {
      const pools = (await publicClient.readContract({
        address: FACTORY_ADDRESS,
        abi: WAGER_POOL_FACTORY_ABI,
        functionName: 'getPools',
      })) as Address[];
      poolAddress = pools[pools.length - 1];
    }
  }

  if (!poolAddress) {
    throw new Error('Could not identify created WagerPool address from transaction receipt.');
  }

  return { poolAddress, txHash: hash };
}

/**
 * Reads complete on-chain state of a WagerPool
 */
export async function getWagerPoolState(poolAddress: Address): Promise<WagerPoolState> {
  const [
    statusNum,
    host,
    keeper,
    resolver,
    treasury,
    usdc,
    buyIn,
    feeBps,
    maxPlayers,
    players,
    poolValue,
    payoutAmount,
    feeAmount,
    poolBalance,
    disputeWindow,
    lobbyTimeout,
    matchTimeout,
    createdAt,
    startedAt,
    proposalTime,
    winner,
    claimed,
  ] = await Promise.all([
    publicClient.readContract({ address: poolAddress, abi: WAGER_POOL_ABI, functionName: 'status' }) as Promise<number>,
    publicClient.readContract({ address: poolAddress, abi: WAGER_POOL_ABI, functionName: 'host' }) as Promise<Address>,
    publicClient.readContract({ address: poolAddress, abi: WAGER_POOL_ABI, functionName: 'keeper' }) as Promise<Address>,
    publicClient.readContract({ address: poolAddress, abi: WAGER_POOL_ABI, functionName: 'resolver' }) as Promise<Address>,
    publicClient.readContract({ address: poolAddress, abi: WAGER_POOL_ABI, functionName: 'treasury' }) as Promise<Address>,
    publicClient.readContract({ address: poolAddress, abi: WAGER_POOL_ABI, functionName: 'usdc' }) as Promise<Address>,
    publicClient.readContract({ address: poolAddress, abi: WAGER_POOL_ABI, functionName: 'buyIn' }) as Promise<bigint>,
    publicClient.readContract({ address: poolAddress, abi: WAGER_POOL_ABI, functionName: 'feeBps' }) as Promise<number>,
    publicClient.readContract({ address: poolAddress, abi: WAGER_POOL_ABI, functionName: 'maxPlayers' }) as Promise<number>,
    publicClient.readContract({ address: poolAddress, abi: WAGER_POOL_ABI, functionName: 'getPlayers' }) as Promise<Address[]>,
    publicClient.readContract({ address: poolAddress, abi: WAGER_POOL_ABI, functionName: 'poolValue' }) as Promise<bigint>,
    publicClient.readContract({ address: poolAddress, abi: WAGER_POOL_ABI, functionName: 'payoutAmount' }) as Promise<bigint>,
    publicClient.readContract({ address: poolAddress, abi: WAGER_POOL_ABI, functionName: 'feeAmount' }) as Promise<bigint>,
    publicClient.readContract({ address: poolAddress, abi: WAGER_POOL_ABI, functionName: 'poolBalance' }) as Promise<bigint>,
    publicClient.readContract({ address: poolAddress, abi: WAGER_POOL_ABI, functionName: 'disputeWindow' }) as Promise<bigint>,
    publicClient.readContract({ address: poolAddress, abi: WAGER_POOL_ABI, functionName: 'lobbyTimeout' }) as Promise<bigint>,
    publicClient.readContract({ address: poolAddress, abi: WAGER_POOL_ABI, functionName: 'matchTimeout' }) as Promise<bigint>,
    publicClient.readContract({ address: poolAddress, abi: WAGER_POOL_ABI, functionName: 'createdAt' }) as Promise<bigint>,
    publicClient.readContract({ address: poolAddress, abi: WAGER_POOL_ABI, functionName: 'startedAt' }) as Promise<bigint>,
    publicClient.readContract({ address: poolAddress, abi: WAGER_POOL_ABI, functionName: 'proposalTime' }) as Promise<bigint>,
    publicClient.readContract({ address: poolAddress, abi: WAGER_POOL_ABI, functionName: 'winner' }) as Promise<Address>,
    publicClient.readContract({ address: poolAddress, abi: WAGER_POOL_ABI, functionName: 'claimed' }) as Promise<boolean>,
  ]);

  const whole = buyIn / 1_000_000n;
  const rem = (buyIn % 1_000_000n).toString().padStart(6, '0').slice(0, 2);

  return {
    address: poolAddress,
    statusNum,
    status: WAGER_POOL_STATUS_MAP[statusNum] || 'Open',
    host,
    keeper,
    resolver,
    treasury,
    usdc,
    buyIn,
    buyInFormatted: `${whole}.${rem}`,
    feeBps,
    maxPlayers,
    players: (players || []) as Address[],
    playerCount: players ? players.length : 0,
    poolValue,
    payoutAmount,
    feeAmount,
    poolBalance,
    disputeWindow,
    lobbyTimeout,
    matchTimeout,
    createdAt,
    startedAt,
    proposalTime,
    winner,
    claimed,
  };
}

/**
 * Player joins WagerPool escrow
 */
export async function joinWagerPool(
  walletClient: WalletClient,
  poolAddress: Address
): Promise<string> {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet account required');

  const hash = await walletClient.writeContract({
    address: poolAddress,
    abi: WAGER_POOL_ABI,
    functionName: 'join',
    account,
    chain: BASE_SEPOLIA_CHAIN,
  });

  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Player leaves WagerPool (refunded buy-in)
 */
export async function leaveWagerPool(
  walletClient: WalletClient,
  poolAddress: Address
): Promise<string> {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet account required');

  const hash = await walletClient.writeContract({
    address: poolAddress,
    abi: WAGER_POOL_ABI,
    functionName: 'leave',
    account,
    chain: BASE_SEPOLIA_CHAIN,
  });

  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Host cancels the lobby, refunding everyone
 */
export async function refundWagerPool(
  walletClient: WalletClient,
  poolAddress: Address
): Promise<string> {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet account required');

  const hash = await walletClient.writeContract({
    address: poolAddress,
    abi: WAGER_POOL_ABI,
    functionName: 'refund',
    account,
    chain: BASE_SEPOLIA_CHAIN,
  });

  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Host locks the pool when match begins (money committed)
 */
export async function startWagerPool(
  walletClient: WalletClient,
  poolAddress: Address
): Promise<string> {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet account required');

  const hash = await walletClient.writeContract({
    address: poolAddress,
    abi: WAGER_POOL_ABI,
    functionName: 'start',
    account,
    chain: BASE_SEPOLIA_CHAIN,
  });

  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Player disputes a proposed result during the dispute window
 */
export async function disputeWagerResult(
  walletClient: WalletClient,
  poolAddress: Address
): Promise<string> {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet account required');

  const hash = await walletClient.writeContract({
    address: poolAddress,
    abi: WAGER_POOL_ABI,
    functionName: 'dispute',
    account,
    chain: BASE_SEPOLIA_CHAIN,
  });

  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Anyone can finalize a proposed result once dispute window has expired
 */
export async function finalizeWagerResult(
  walletClient: WalletClient,
  poolAddress: Address
): Promise<string> {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet account required');

  const hash = await walletClient.writeContract({
    address: poolAddress,
    abi: WAGER_POOL_ABI,
    functionName: 'finalize',
    account,
    chain: BASE_SEPOLIA_CHAIN,
  });

  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Winner claims their 95% payout from settled pool
 */
export async function claimWagerPayout(
  walletClient: WalletClient,
  poolAddress: Address
): Promise<string> {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet account required');

  const hash = await walletClient.writeContract({
    address: poolAddress,
    abi: WAGER_POOL_ABI,
    functionName: 'claim',
    account,
    chain: BASE_SEPOLIA_CHAIN,
  });

  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}
