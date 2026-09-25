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
 * Resolves the best available Ethereum provider.
 * When multiple extensions (e.g. MetaMask and Phantom) are installed,
 * prioritizes genuine MetaMask, Dynamic injected provider, or passed wallet connector.
 */
export function getInjectedProvider(preferred?: any): any {
  if (preferred?.request) return preferred;
  if (preferred?.connector?.provider?.request) return preferred.connector.provider;
  if (preferred?.provider?.request) return preferred.provider;

  if (typeof preferred?.connector?.findProvider === 'function') {
    try {
      const p = preferred.connector.findProvider();
      if (p?.request) return p;
    } catch {}
  }

  if (typeof preferred?.connector?.getProvider === 'function') {
    try {
      const p = preferred.connector.getProvider();
      if (p?.request) return p;
    } catch {}
  }

  if (typeof window === 'undefined') return null;

  const win = window as any;

  // 1. Multiple providers array (EIP-5749 / EIP-6963 standard in modern extensions)
  if (win.ethereum?.providers && Array.isArray(win.ethereum.providers)) {
    // Prefer MetaMask
    const mm = win.ethereum.providers.find((p: any) => p.isMetaMask && !p.isPhantom);
    if (mm) return mm;
    const anyMm = win.ethereum.providers.find((p: any) => p.isMetaMask);
    if (anyMm) return anyMm;
    return win.ethereum.providers[0];
  }

  // 2. Window provider map
  if (win.ethereum?.providerMap?.get?.('MetaMask')) {
    return win.ethereum.providerMap.get('MetaMask');
  }

  // 3. Fallback to window.ethereum
  if (win.ethereum) {
    return win.ethereum;
  }

  return null;
}

/**
 * Ensures wallet is switched to Base Sepolia (Chain ID 84532)
 */
export async function ensureBaseSepolia(provider?: any): Promise<void> {
  const ethereum = getInjectedProvider(provider);
  if (!ethereum?.request) return;

  const chainIdHex = `0x${BASE_SEPOLIA_CONFIG.chainId.toString(16)}`;

  try {
    const currentChain = await ethereum.request({ method: 'eth_chainId' }).catch(() => null);
    if (currentChain && currentChain.toLowerCase() === chainIdHex.toLowerCase()) {
      // Already on Base Sepolia, do not send redundant switch requests
      return;
    }

    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });
  } catch (switchError: any) {
    // 4902: Chain not added yet
    if (
      switchError?.code === 4902 ||
      switchError?.message?.includes('4902') ||
      switchError?.data?.originalError?.code === 4902
    ) {
      try {
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
      } catch (addErr) {
        console.warn('addEthereumChain warning:', addErr);
      }
    } else {
      console.warn('Switch chain warning:', switchError);
    }
  }
}

/**
 * Helper to retrieve known connected wallet address from active session, localStorage, or injected window
 */
export function getActiveSessionWalletAddress(custom?: any): string | undefined {
  if (custom?.address && typeof custom.address === 'string' && custom.address.startsWith('0x')) {
    return custom.address;
  }
  if (custom?.account?.address && typeof custom.account.address === 'string' && custom.account.address.startsWith('0x')) {
    return custom.account.address;
  }
  if (typeof custom?.account === 'string' && custom.account.startsWith('0x')) {
    return custom.account;
  }
  if (typeof window !== 'undefined') {
    const win = window as any;
    if (win.__proprush_connected_wallet && typeof win.__proprush_connected_wallet === 'string' && win.__proprush_connected_wallet.startsWith('0x')) {
      return win.__proprush_connected_wallet;
    }
    if (win.ethereum?.selectedAddress && typeof win.ethereum.selectedAddress === 'string' && win.ethereum.selectedAddress.startsWith('0x')) {
      return win.ethereum.selectedAddress;
    }
    try {
      const saved = localStorage.getItem('proprush_user_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.walletAddress && typeof parsed.walletAddress === 'string' && parsed.walletAddress.startsWith('0x')) {
          return parsed.walletAddress;
        }
      }
    } catch {}
    try {
      const explicit = localStorage.getItem('proprush_wallet_address');
      if (explicit && explicit.startsWith('0x')) return explicit;
    } catch {}
  }
  return undefined;
}

/**
 * Requests wallet account authorization with automatic fallback to permissions prompt
 * if dApp interaction is disabled or disconnected in MetaMask.
 * If knownAddress is provided and the wallet is already connected in the session,
 * it avoids throwing spurious connection errors.
 */
export async function requestWalletAccounts(provider?: any, knownAddressInput?: string): Promise<Address[]> {
  const knownAddress = knownAddressInput || getActiveSessionWalletAddress(provider);
  const ethereum = getInjectedProvider(provider);
  if (!ethereum?.request) {
    if (knownAddress && knownAddress.startsWith('0x')) {
      return [knownAddress as Address];
    }
    throw new Error('No crypto wallet detected. Please install or unlock MetaMask.');
  }

  // 1. If wallet is ALREADY connected, return active account immediately without prompting or throwing!
  if (ethereum.selectedAddress && ethereum.selectedAddress.startsWith('0x')) {
    return [ethereum.selectedAddress as Address];
  }

  try {
    const existingAccounts: string[] = await ethereum.request({ method: 'eth_accounts' });
    if (existingAccounts && existingAccounts.length > 0) {
      return existingAccounts.map((a: string) => a as Address);
    }
  } catch (err) {
    console.debug('Passive eth_accounts check:', err);
  }

  // If we already know the connected account from the user's active session, return immediately
  if (knownAddress && knownAddress.startsWith('0x')) {
    try {
      const accounts: string[] = await ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts && accounts.length > 0) {
        return accounts.map((a: string) => a as Address);
      }
    } catch {
      // Do not throw! User is already authenticated and has an active address
      return [knownAddress as Address];
    }
    return [knownAddress as Address];
  }

  // 2. Not yet connected: request user authorization
  try {
    const accounts: string[] = await ethereum.request({ method: 'eth_requestAccounts' });
    if (accounts && accounts.length > 0) {
      return accounts.map((a: string) => a as Address);
    }
  } catch (err: any) {
    const errMsg = (err?.message || '').toLowerCase();
    
    // Check again if accounts became available despite error (e.g. pending request already approved)
    try {
      const fallbackAccounts: string[] = await ethereum.request({ method: 'eth_accounts' });
      if (fallbackAccounts && fallbackAccounts.length > 0) {
        return fallbackAccounts.map((a: string) => a as Address);
      }
      if (ethereum.selectedAddress) {
        return [ethereum.selectedAddress as Address];
      }
    } catch {}

    // When "DApp interaction is disabled" or 4100 (unauthorized), try to request permissions
    if (
      errMsg.includes('disabled') ||
      errMsg.includes('unauthorized') ||
      err?.code === 4100
    ) {
      try {
        await ethereum.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }],
        });
        const accounts: string[] = await ethereum.request({ method: 'eth_accounts' });
        if (accounts && accounts.length > 0) {
          return accounts.map((a: string) => a as Address);
        }
      } catch (permErr: any) {
        if (ethereum.selectedAddress) {
          return [ethereum.selectedAddress as Address];
        }
        if (knownAddress && knownAddress.startsWith('0x')) {
          return [knownAddress as Address];
        }
        throw new Error(
          permErr?.message?.includes('User rejected')
            ? 'Wallet connection request was rejected. Please approve the connection in MetaMask.'
            : 'MetaMask connection prompt was dismissed. Please check MetaMask to allow connection.'
        );
      }
    } else if (errMsg.includes('user rejected') || err?.code === 4001) {
      if (knownAddress && knownAddress.startsWith('0x')) {
        return [knownAddress as Address];
      }
      throw new Error('Connection request was cancelled in wallet.');
    } else if (errMsg.includes('already pending') || err?.code === -32603) {
      if (ethereum.selectedAddress) {
        return [ethereum.selectedAddress as Address];
      }
      if (knownAddress && knownAddress.startsWith('0x')) {
        return [knownAddress as Address];
      }
      throw new Error('A wallet connection request is already pending. Please click the MetaMask extension icon to approve.');
    } else {
      if (knownAddress && knownAddress.startsWith('0x')) {
        return [knownAddress as Address];
      }
      throw err;
    }
  }

  // Fallback to eth_accounts or selectedAddress
  if (ethereum.selectedAddress) {
    return [ethereum.selectedAddress as Address];
  }

  const fallbackAccounts: string[] = await ethereum.request({ method: 'eth_accounts' });
  if (fallbackAccounts && fallbackAccounts.length > 0) {
    return fallbackAccounts.map((a: string) => a as Address);
  }

  if (knownAddress && knownAddress.startsWith('0x')) {
    return [knownAddress as Address];
  }

  throw new Error('No wallet accounts authorized. Please unlock MetaMask and approve the connection.');
}

/**
 * Gets a viable WalletClient from injected window.ethereum, Dynamic primaryWallet, or passed provider
 */
export async function getWalletClient(
  customProviderOrWallet?: any
): Promise<{ walletClient: WalletClient; address: Address }> {
  // Extract known address if available on the wallet object or active session
  const knownAddress: string | undefined = getActiveSessionWalletAddress(customProviderOrWallet);

  // 1. If a Dynamic primaryWallet with getWalletClient is passed:
  const clientGetter =
    (typeof customProviderOrWallet?.getWalletClient === 'function' ? customProviderOrWallet.getWalletClient.bind(customProviderOrWallet) : null) ||
    (typeof customProviderOrWallet?.connector?.getWalletClient === 'function' ? customProviderOrWallet.connector.getWalletClient.bind(customProviderOrWallet.connector) : null);

  if (clientGetter) {
    for (const chainParam of ['84532', undefined, 84532]) {
      try {
        const dynClient = await clientGetter(chainParam);
        if (dynClient) {
          const clientAddress =
            (typeof dynClient.account === 'string' ? dynClient.account : dynClient.account?.address) ||
            knownAddress;
          if (clientAddress && clientAddress.startsWith('0x')) {
            return {
              walletClient: dynClient as WalletClient,
              address: clientAddress as Address,
            };
          }
        }
      } catch (e) {
        console.warn(`Dynamic getWalletClient(${chainParam}) attempt:`, e);
      }
    }
  }

  const ethereum = getInjectedProvider(customProviderOrWallet);
  if (!ethereum) {
    // If window.ethereum is not present, but we have a known address from session, check window fallback or transport
    const winEth = typeof window !== 'undefined' ? (window as any).ethereum : null;
    if (winEth?.request && knownAddress && knownAddress.startsWith('0x')) {
      const walletClient = createWalletClient({
        account: knownAddress as Address,
        chain: BASE_SEPOLIA_CHAIN,
        transport: custom(winEth),
      });
      return { walletClient, address: knownAddress as Address };
    }
    if (knownAddress && knownAddress.startsWith('0x')) {
      const walletClient = createWalletClient({
        account: knownAddress as Address,
        chain: BASE_SEPOLIA_CHAIN,
        transport: http(DEFAULT_RPC_URL),
      });
      return { walletClient, address: knownAddress as Address };
    }
    throw new Error('No crypto wallet detected. Please connect MetaMask, Coinbase Wallet, or Dynamic.');
  }

  // 1. Authorize accounts FIRST (opens wallet popup if needed, or wakes up disabled interaction)
  const accounts = await requestWalletAccounts(ethereum, knownAddress);
  const address = accounts[0] || (knownAddress as Address);

  // 2. Ensure chain is Base Sepolia
  try {
    await ensureBaseSepolia(ethereum);
  } catch (e) {
    console.warn('ensureBaseSepolia caught:', e);
  }

  // 3. Create wallet client
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
 * Explicit gas limit ensures the wallet popup (MetaMask) is triggered immediately
 * without pre-flight client-side RPC simulation blocking the user prompt.
 */
export async function mintTestUsdc(
  walletClient: WalletClient,
  recipient: Address,
  amountInDollars = 50
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
    gas: 120000n,
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

export const createWagerPool = createWagerPoolOnChain;

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
