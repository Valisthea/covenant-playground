/**
 * Wallet integration — MetaMask / EIP-1193 provider bridge.
 *
 * Tier 2 exposes a *stub* Sepolia deploy target. Covenant's EVM backend
 * isn't plumbed through the wasm bindings yet, so the "Deploy to Sepolia"
 * button can't actually broadcast a contract creation transaction
 * today — the compiler output is WASM, not EVM bytecode. What this
 * module does do:
 *
 *   1. Detect `window.ethereum` and expose a stable connect() flow.
 *   2. Enforce Sepolia (chainId 0xaa36a7). Offer to switch or add it.
 *   3. Fetch the connected account + balance for UI display.
 *   4. Sign an EIP-191 "playground handshake" message so the user has
 *      something tangible to confirm the wallet is wired up.
 *
 * When the EVM backend ships, `deployToSepolia(bytecode, abi)` below
 * grows a real `eth_sendTransaction` call. Until then it throws a
 * structured error that the UI renders as a toast.
 */

import { BrowserProvider, type Eip1193Provider } from 'ethers';

export const SEPOLIA_CHAIN_ID = '0xaa36a7';
export const SEPOLIA_CHAIN_NAME = 'Sepolia';
export const SEPOLIA_RPC = 'https://rpc.sepolia.org';
export const SEPOLIA_EXPLORER = 'https://sepolia.etherscan.io';

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
}

export function hasInjectedWallet(): boolean {
  return typeof window !== 'undefined' && !!window.ethereum;
}

export async function connectWallet(): Promise<WalletState> {
  if (!hasInjectedWallet()) {
    throw new Error(
      'No EIP-1193 wallet detected. Install MetaMask to deploy to Sepolia.',
    );
  }
  const provider = new BrowserProvider(window.ethereum!);

  // eth_requestAccounts prompts the MetaMask approval UI.
  const accounts = (await window.ethereum!.request({
    method: 'eth_requestAccounts',
  })) as string[];
  const address = accounts[0] ?? null;

  const net = await provider.getNetwork();
  const chainId = '0x' + net.chainId.toString(16);
  const isSepolia = chainId.toLowerCase() === SEPOLIA_CHAIN_ID;

  let balanceWei: bigint | null = null;
  if (address) {
    try {
      balanceWei = await provider.getBalance(address);
    } catch {
      balanceWei = null;
    }
  }

  return { address, chainId, balanceWei, isSepolia };
}

export async function switchToSepolia(): Promise<void> {
  if (!hasInjectedWallet()) throw new Error('No wallet');
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
 * Deploy a compiled Covenant contract to Sepolia.
 *
 * NOT YET IMPLEMENTED — Covenant's EVM backend emits WASM only at the
 * current compiler revision. Throws a structured error that the UI
 * surfaces verbatim so the user understands why the button didn't do
 * anything.
 */
export async function deployToSepolia(
  _bytecode: string | null,
  _abi: unknown[] | null,
): Promise<never> {
  throw new Error(
    'Sepolia deploy unavailable in Tier 2: Covenant currently compiles to WASM, not EVM bytecode. The EVM backend bridge is planned for Tier 3. Use the MockChain target to iterate on contract behaviour today.',
  );
}

/**
 * Sign a static playground handshake message so the user can verify
 * the wallet is connected end-to-end. Cheap, no chain interaction.
 */
export async function signHandshake(address: string): Promise<string> {
  if (!hasInjectedWallet()) throw new Error('No wallet');
  const message = `Covenant Playground handshake — ${new Date().toISOString().slice(0, 10)}`;
  return (await window.ethereum!.request({
    method: 'personal_sign',
    params: [message, address],
  })) as string;
}
