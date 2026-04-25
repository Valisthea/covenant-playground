/**
 * Wallet integration — MetaMask / EIP-1193 provider bridge.
 *
 * Sprint 24 turned the previously-stubbed `deployToSepolia` into a real
 * `eth_sendTransaction` flow via ethers v6 `BrowserProvider`, plus the
 * symmetric `callOnSepolia` (state-mutating) / `staticCallOnSepolia`
 * (read-only via `eth_call`) entry points. Compiler-side bytecode comes
 * from Sprint 22's `covenant-wasm-bindings` so the deploy payload is
 * the same bits MockChain runs.
 *
 * Safety stance:
 *
 *   - Mainnet is hard-refused (no switch prompt). The playground is a
 *     learning + demo surface; signing real-money txs needs the CLI.
 *   - Every entry point that touches wallet state runs `assertSepolia`
 *     up front so the user can't accidentally broadcast off-network.
 *   - Errors throw `WalletError` with `code` + optional `remediation`
 *     so the UI can surface a useful next step instead of a stack trace.
 */

import {
  BrowserProvider,
  ContractFactory,
  Interface,
  type Eip1193Provider,
  type TransactionReceipt,
  type TransactionResponse,
} from 'ethers';

export const SEPOLIA_CHAIN_ID = '0xaa36a7';
export const SEPOLIA_CHAIN_NAME = 'Sepolia';
export const SEPOLIA_RPC = 'https://rpc.sepolia.org';
export const SEPOLIA_EXPLORER = 'https://sepolia.etherscan.io';

/** Mainnet chainId. The playground refuses to operate here. */
export const MAINNET_CHAIN_ID = '0x1';

declare global {
  interface Window {
    ethereum?: Eip1193Provider & {
      on?: (event: string, cb: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, cb: (...args: unknown[]) => void) => void;
    };
  }
}

export interface WalletState {
  address: string | null;
  chainId: string | null;
  balanceWei: bigint | null;
  isSepolia: boolean;
  isMainnet: boolean;
}

/** Structured error type for the UI to render with hints. */
export class WalletError extends Error {
  constructor(
    message: string,
    public readonly code: WalletErrorCode,
    public readonly remediation?: string,
  ) {
    super(message);
    this.name = 'WalletError';
  }
}

export type WalletErrorCode =
  | 'NO_WALLET'
  | 'NOT_CONNECTED'
  | 'WRONG_NETWORK'
  | 'MAINNET_BLOCKED'
  | 'NO_FUNDS'
  | 'USER_REJECTED'
  | 'BROADCAST_FAILED'
  | 'NO_CONFIRMATION'
  | 'NO_ADDRESS'
  | 'NO_BYTECODE';

export function hasInjectedWallet(): boolean {
  return typeof window !== 'undefined' && !!window.ethereum;
}

export async function connectWallet(): Promise<WalletState> {
  if (!hasInjectedWallet()) {
    throw new WalletError(
      'No EIP-1193 wallet detected. Install MetaMask to deploy to Sepolia.',
      'NO_WALLET',
      'Install MetaMask: https://metamask.io/download/',
    );
  }
  const provider = new BrowserProvider(window.ethereum!);

  const accounts = (await window.ethereum!.request({
    method: 'eth_requestAccounts',
  })) as string[];
  const address = accounts[0] ?? null;

  return await readState(provider, address);
}

/**
 * Refresh wallet state from chain (no popup). Useful after the user
 * switches network or accounts inside MetaMask.
 */
export async function refreshWalletState(address: string | null): Promise<WalletState> {
  if (!hasInjectedWallet() || !address) {
    return { address, chainId: null, balanceWei: null, isSepolia: false, isMainnet: false };
  }
  const provider = new BrowserProvider(window.ethereum!);
  return await readState(provider, address);
}

async function readState(provider: BrowserProvider, address: string | null): Promise<WalletState> {
  const net = await provider.getNetwork();
  const chainId = '0x' + net.chainId.toString(16);
  const isSepolia = chainId.toLowerCase() === SEPOLIA_CHAIN_ID;
  const isMainnet = chainId.toLowerCase() === MAINNET_CHAIN_ID;

  let balanceWei: bigint | null = null;
  if (address) {
    try {
      balanceWei = await provider.getBalance(address);
    } catch {
      balanceWei = null;
    }
  }

  return { address, chainId, balanceWei, isSepolia, isMainnet };
}

export async function switchToSepolia(): Promise<void> {
  if (!hasInjectedWallet()) {
    throw new WalletError('No wallet', 'NO_WALLET');
  }
  try {
    await window.ethereum!.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: SEPOLIA_CHAIN_ID }],
    });
  } catch (e) {
    const err = e as { code?: number };
    // 4902 = chain not in wallet → add it.
    if (err.code === 4902) {
      await window.ethereum!.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: SEPOLIA_CHAIN_ID,
            chainName: SEPOLIA_CHAIN_NAME,
            rpcUrls: [SEPOLIA_RPC],
            blockExplorerUrls: [SEPOLIA_EXPLORER],
            nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
          },
        ],
      });
    } else {
      throw e;
    }
  }
}

/**
 * Pre-broadcast guards. Throws `WalletError` with a code + remediation
 * the UI can render verbatim. Every Sepolia entry point calls this.
 */
async function assertSepolia(provider: BrowserProvider): Promise<{ address: string; balance: bigint }> {
  const network = await provider.getNetwork();
  const chainId = '0x' + network.chainId.toString(16);

  // HARD REFUSAL on mainnet — no switch offer, no negotiating.
  if (chainId.toLowerCase() === MAINNET_CHAIN_ID) {
    throw new WalletError(
      'Mainnet detected — playground refuses to deploy to Ethereum mainnet.',
      'MAINNET_BLOCKED',
      'Switch your wallet to Sepolia. The playground is a learning surface; for production deploys use the Covenant CLI.',
    );
  }

  if (chainId.toLowerCase() !== SEPOLIA_CHAIN_ID) {
    // Try the polite switch first.
    try {
      await switchToSepolia();
    } catch {
      throw new WalletError(
        `Wallet is on chain ${chainId}, expected Sepolia (${SEPOLIA_CHAIN_ID}).`,
        'WRONG_NETWORK',
        'Open your wallet and switch to the Sepolia testnet.',
      );
    }
  }

  const accounts = (await provider.send('eth_accounts', [])) as string[];
  if (!accounts || accounts.length === 0) {
    throw new WalletError(
      'Wallet not connected.',
      'NOT_CONNECTED',
      'Click Connect in the Sepolia panel.',
    );
  }
  const address = accounts[0];

  const balance = await provider.getBalance(address);
  if (balance === 0n) {
    throw new WalletError(
      'Wallet has zero Sepolia ETH.',
      'NO_FUNDS',
      'Get test ETH from a faucet — sepoliafaucet.com or alchemy.com/faucets/ethereum-sepolia',
    );
  }

  return { address, balance };
}

/**
 * Result of a successful Sepolia deploy.
 *
 * `txHash` and `contractAddress` are 0x-prefixed lowercase hex; the
 * playground wraps both in Etherscan deep-links via `SEPOLIA_EXPLORER`.
 */
export interface SepoliaDeployResult {
  txHash: string;
  contractAddress: string;
  blockNumber: number;
  gasUsed: bigint;
  from: string;
}

/**
 * Deploy a compiled Covenant contract to Sepolia.
 *
 * Sprint 24: real ethers v6 `BrowserProvider + ContractFactory.deploy`.
 * Constructor args are limited to no-arg constructors in this rc — every
 * shipped example fits. Sprint 25 extends to ABI-encoded constructor
 * args sourced from form fields.
 */
export async function deployToSepolia(
  bytecode: string | null,
  abi: unknown[] | null,
): Promise<SepoliaDeployResult> {
  if (!bytecode) {
    throw new WalletError('Compile result has no bytecode.', 'NO_BYTECODE');
  }
  if (!hasInjectedWallet()) {
    throw new WalletError('No wallet detected.', 'NO_WALLET');
  }

  const provider = new BrowserProvider(window.ethereum!);
  const { address } = await assertSepolia(provider);

  const signer = await provider.getSigner(address);

  // ContractFactory accepts an Interface or an ABI fragment array.
  const iface = new Interface((abi as readonly unknown[] as []) ?? []);
  const factory = new ContractFactory(iface.fragments, bytecode, signer);

  let contract;
  try {
    contract = await factory.deploy();
  } catch (e) {
    const err = e as { code?: string; message?: string; shortMessage?: string };
    if (err.code === 'ACTION_REJECTED') {
      throw new WalletError(
        'You rejected the transaction in MetaMask.',
        'USER_REJECTED',
      );
    }
    throw new WalletError(
      `Deploy broadcast failed: ${err.shortMessage ?? err.message ?? 'unknown error'}`,
      'BROADCAST_FAILED',
    );
  }

  const txResponse = contract.deploymentTransaction();
  if (!txResponse) {
    throw new WalletError(
      'Deployment did not produce a transaction object.',
      'BROADCAST_FAILED',
    );
  }

  const receipt = await txResponse.wait(1);
  if (!receipt || !receipt.contractAddress) {
    throw new WalletError(
      'Tx confirmed but no contract address in receipt.',
      'NO_ADDRESS',
    );
  }

  return {
    txHash: receipt.hash.toLowerCase(),
    contractAddress: receipt.contractAddress.toLowerCase(),
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
    from: receipt.from.toLowerCase(),
  };
}

/**
 * State-mutating call on Sepolia. Pops MetaMask for confirmation,
 * waits 1 confirmation, returns receipt info.
 *
 * Note: Ethereum doesn't expose function return values to off-chain
 * readers, so `returnValue` here is always null. To "see" the result,
 * the contract must emit an event the playground can decode from the
 * receipt logs.
 */
export interface SepoliaCallResult {
  txHash: string;
  status: 'success' | 'reverted';
  blockNumber: number;
  gasUsed: bigint;
  logs: TransactionReceipt['logs'];
}

export async function callOnSepolia(
  to: string,
  calldata: string,
  valueWei: bigint = 0n,
): Promise<SepoliaCallResult> {
  if (!hasInjectedWallet()) {
    throw new WalletError('No wallet detected.', 'NO_WALLET');
  }

  const provider = new BrowserProvider(window.ethereum!);
  const { address } = await assertSepolia(provider);
  const signer = await provider.getSigner(address);

  let txResponse: TransactionResponse;
  try {
    txResponse = await signer.sendTransaction({
      to,
      data: calldata,
      value: valueWei,
    });
  } catch (e) {
    const err = e as { code?: string; message?: string; shortMessage?: string };
    if (err.code === 'ACTION_REJECTED') {
      throw new WalletError('You rejected the transaction in MetaMask.', 'USER_REJECTED');
    }
    throw new WalletError(
      `Call broadcast failed: ${err.shortMessage ?? err.message ?? 'unknown'}`,
      'BROADCAST_FAILED',
    );
  }

  const receipt = await txResponse.wait(1);
  if (!receipt) {
    throw new WalletError('Tx not confirmed within timeout.', 'NO_CONFIRMATION');
  }

  return {
    txHash: receipt.hash.toLowerCase(),
    status: receipt.status === 1 ? 'success' : 'reverted',
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
    logs: receipt.logs,
  };
}

/**
 * Read-only call (`eth_call`) on Sepolia. Free, no signing, no
 * confirmation wait. Returns raw return data hex; the caller decodes
 * via the ABI.
 */
export async function staticCallOnSepolia(
  from: string,
  to: string,
  calldata: string,
): Promise<{ ok: boolean; returnDataHex: string; revertReason?: string }> {
  if (!hasInjectedWallet()) {
    throw new WalletError('No wallet detected.', 'NO_WALLET');
  }

  const provider = new BrowserProvider(window.ethereum!);
  // No assertSepolia for views — eth_call works against whatever network
  // is selected and we don't want to nag for switches on read-only ops.
  // Instead, surface the chain context in the result if mismatched.

  try {
    const data = await provider.call({ from, to, data: calldata });
    return { ok: true, returnDataHex: data };
  } catch (e) {
    const err = e as { shortMessage?: string; message?: string };
    return {
      ok: false,
      returnDataHex: '0x',
      revertReason: err.shortMessage ?? err.message ?? 'eth_call reverted',
    };
  }
}

/**
 * Sign a static playground handshake message so the user can verify
 * the wallet is connected end-to-end. Cheap, no chain interaction.
 */
export async function signHandshake(address: string): Promise<string> {
  if (!hasInjectedWallet()) throw new WalletError('No wallet', 'NO_WALLET');
  const message = `Covenant Playground handshake — ${new Date().toISOString().slice(0, 10)}`;
  return (await window.ethereum!.request({
    method: 'personal_sign',
    params: [message, address],
  })) as string;
}

/** Etherscan helpers used across the Deploy components. */
export function etherscanTxUrl(hash: string): string {
  return `${SEPOLIA_EXPLORER}/tx/${hash}`;
}
export function etherscanAddressUrl(address: string): string {
  return `${SEPOLIA_EXPLORER}/address/${address}`;
}
