/**
 * EIP-1193 event subscription hook.
 *
 * KSR-CVN-PRELIM-001 (Sprint 26 audit): pre-fix, the playground cached
 * wallet state at connect time and never refreshed when the user
 * changed networks or accounts inside MetaMask. The `assertSepolia`
 * preflight always read fresh chain state from the provider, so the
 * mainnet refusal barrier held — but the UI displayed stale information,
 * causing a "green Sepolia ✓ banner → red MAINNET_BLOCKED at deploy"
 * UX gap. This hook closes that gap by listening to the EIP-1193
 * `chainChanged` and `accountsChanged` events and refreshing the
 * Zustand wallet state on each.
 *
 * Mount once at the App root. Idempotent re-mounts are safe because
 * the `useEffect` cleanup removes the listener.
 */

import { useEffect } from 'react';

import { useStore } from './store';

/**
 * EIP-1193 provider event names we subscribe to. Using a typed list
 * makes it easy to add (e.g. `disconnect`) without forgetting the
 * cleanup mirror.
 */
type EthEvent = 'chainChanged' | 'accountsChanged';

interface ListenableProvider {
  on?: (event: EthEvent, cb: (...args: unknown[]) => void) => void;
  removeListener?: (event: EthEvent, cb: (...args: unknown[]) => void) => void;
}

export function useWalletEvents(): void {
  useEffect(() => {
    const eth = (window.ethereum ?? null) as ListenableProvider | null;
    if (!eth?.on) return;

    const onChain = () => {
      // The chain changed inside the wallet (user clicked the network
      // dropdown). Re-read state so the UI badge / refusal banner are
      // accurate before the user's next click. No-op if no wallet
      // is currently connected.
      void useStore.getState().refreshWallet();
    };

    const onAccounts = (...args: unknown[]) => {
      const accounts = args[0] as string[] | undefined;
      if (!accounts || accounts.length === 0) {
        // User disconnected from inside MetaMask. Drop the cached
        // wallet so the UI returns to its "Connect wallet" state.
        useStore.setState({ wallet: null });
        return;
      }
      // User switched account; re-read state so balance + address
      // reflect the new active account.
      void useStore.getState().refreshWallet();
    };

    eth.on('chainChanged', onChain);
    eth.on('accountsChanged', onAccounts);

    return () => {
      eth.removeListener?.('chainChanged', onChain);
      eth.removeListener?.('accountsChanged', onAccounts);
    };
    // Empty deps: mount once for the app's lifetime. The store and the
    // window.ethereum reference are both stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
