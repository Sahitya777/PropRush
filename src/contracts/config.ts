import { parseAbi } from 'viem';
import { baseSepolia } from 'viem/chains';

export const BASE_SEPOLIA_CHAIN = baseSepolia;

export const BASE_SEPOLIA_CONFIG = {
  chainId: 84532,
  name: 'Base Sepolia',
  network: 'base-sepolia',
  nativeCurrency: {
    name: 'Base Sepolia Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://sepolia.base.org'],
    },
    public: {
      http: ['https://sepolia.base.org', 'https://base-sepolia-rpc.publicnode.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'BaseScan',
      url: 'https://sepolia.basescan.org',
    },
  },
};

// Helper to safely read env in both browser Vite and Node environments
const getEnvVar = (key: string): string | undefined => {
  if (typeof import.meta !== 'undefined' && (import.meta as any)?.env) {
    return (import.meta as any).env[key];
  }
  if (typeof process !== 'undefined' && process?.env) {
    return process.env[key];
  }
  return undefined;
};

// Deployed addresses provided by user on Base Sepolia
export const FACTORY_ADDRESS: `0x${string}` = (
  getEnvVar('VITE_WAGER_POOL_FACTORY_ADDRESS') ||
  '0xb6Ed4A314112f0f771E34d0099E3eEd471683DFD'
) as `0x${string}`;

export const MOCK_USDC_ADDRESS: `0x${string}` = (
  getEnvVar('VITE_MOCK_USDC_ADDRESS') ||
  '0x6482c263a6F3f651Ab292443DC60B378482E5e17'
) as `0x${string}`;

export const DEFAULT_RPC_URL =
  getEnvVar('VITE_BASE_SEPOLIA_RPC_URL') ||
  getEnvVar('BASE_SEPOLIA_RPC_URL') ||
  'https://sepolia.base.org';

export const WAGER_POOL_STATUS_MAP: Record<number, 'Open' | 'Locked' | 'Proposed' | 'Disputed' | 'Settled' | 'Refunded'> = {
  0: 'Open',
  1: 'Locked',
  2: 'Proposed',
  3: 'Disputed',
  4: 'Settled',
  5: 'Refunded',
};

export const WAGER_POOL_FACTORY_ABI = parseAbi([
  'function usdc() view returns (address)',
  'function keeper() view returns (address)',
  'function treasury() view returns (address)',
  'function resolver() view returns (address)',
  'function disputeWindow() view returns (uint256)',
  'function lobbyTimeout() view returns (uint256)',
  'function matchTimeout() view returns (uint256)',
  'function poolCount() view returns (uint256)',
  'function getPools() view returns (address[])',
  'function isPool(address pool) view returns (bool)',
  'function createPool(uint256 buyIn, uint8 maxPlayers, uint16 feeBps) returns (address pool)',
  'event PoolCreated(address indexed pool, address indexed host, uint256 buyIn, uint8 maxPlayers, uint16 feeBps)',
]);

export const WAGER_POOL_ABI = parseAbi([
  'function usdc() view returns (address)',
  'function factory() view returns (address)',
  'function host() view returns (address)',
  'function keeper() view returns (address)',
  'function resolver() view returns (address)',
  'function treasury() view returns (address)',
  'function buyIn() view returns (uint256)',
  'function feeBps() view returns (uint16)',
  'function maxPlayers() view returns (uint8)',
  'function disputeWindow() view returns (uint256)',
  'function lobbyTimeout() view returns (uint256)',
  'function matchTimeout() view returns (uint256)',
  'function createdAt() view returns (uint256)',
  'function startedAt() view returns (uint256)',
  'function proposalTime() view returns (uint256)',
  'function winner() view returns (address)',
  'function claimed() view returns (bool)',
  'function status() view returns (uint8)',
  'function playerCount() view returns (uint256)',
  'function getPlayers() view returns (address[])',
  'function isJoined(address player) view returns (bool)',
  'function poolValue() view returns (uint256)',
  'function payoutAmount() view returns (uint256)',
  'function feeAmount() view returns (uint256)',
  'function poolBalance() view returns (uint256)',
  'function join()',
  'function leave()',
  'function kickPlayer(address player)',
  'function refund()',
  'function refundAfterTimeout()',
  'function start()',
  'function proposeResult(address _winner)',
  'function dispute()',
  'function resolveDispute(address _winner)',
  'function finalize()',
  'function emergencyRefund()',
  'function claim()',
  'event PoolJoined(address indexed player)',
  'event PlayerRemoved(address indexed player)',
  'event PoolRefunded()',
  'event PoolStarted(address indexed host)',
  'event ResultProposed(address indexed winner)',
  'event ResultDisputed(address indexed player)',
  'event ResultResolved(address indexed winner)',
  'event ResultFinalized(address indexed winner)',
  'event Claimed(address indexed winner, uint256 payout)',
]);

export const MOCK_USDC_ABI = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function mint(address to, uint256 amount)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
]);

export function formatUsdc(units: bigint | number | string): string {
  const b = BigInt(units || 0);
  const whole = b / 1_000_000n;
  const rem = (b % 1_000_000n).toString().padStart(6, '0').slice(0, 2);
  return `${whole.toString()}.${rem}`;
}

export function parseUsdc(dollars: number | string): bigint {
  const num = typeof dollars === 'string' ? parseFloat(dollars) || 0 : dollars;
  return BigInt(Math.round(num * 1_000_000));
}

export function getBaseScanAddressUrl(address: string): string {
  return `https://sepolia.basescan.org/address/${address}`;
}

export function getBaseScanTxUrl(txHash: string): string {
  return `https://sepolia.basescan.org/tx/${txHash}`;
}
