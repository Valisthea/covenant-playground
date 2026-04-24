import { useStore } from '../../lib/store';
import { hasInjectedWallet, switchToSepolia } from '../../lib/wallet';
import { formatEther } from 'ethers';
import { shortAddress } from '../../lib/mockchain';

/**
 * Sepolia panel. Today it connects the wallet and displays balance;
 * the actual deploy call returns a structured error because the EVM
 * backend isn't wired yet (see wallet.ts `deployToSepolia`).
 */
export function WalletPanel() {
  const wallet = useStore((s) => s.wallet);
  const isConnecting = useStore((s) => s.isConnectingWallet);
  const walletError = useStore((s) => s.walletError);
  const connect = useStore((s) => s.connectWallet);

  if (!hasInjectedWallet()) {
    return (
      <section className="deploy-card wallet-card">
        <h3 className="deploy-card__title">Sepolia</h3>
        <p className="deploy-empty">
          No EIP-1193 wallet detected. Install{' '}
          <a
            href="https://metamask.io/download/"
            target="_blank"
            rel="noopener noreferrer"
          >
            MetaMask
          </a>{' '}
          to deploy to Sepolia testnet.
        </p>
      </section>
    );
  }

  if (!wallet || !wallet.address) {
    return (
      <section className="deploy-card wallet-card">
        <h3 className="deploy-card__title">Sepolia</h3>
        <p className="deploy-empty">
          Connect your wallet to deploy this contract to Ethereum Sepolia.
        </p>
        <button
          type="button"
          className="pg-btn pg-btn--primary"
          disabled={isConnecting}
          onClick={() => void connect()}
        >
          {isConnecting ? 'Connecting…' : 'Connect wallet'}
        </button>
        {walletError && (
          <p className="wallet-error" role="alert">
            {walletError}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="deploy-card wallet-card">
      <h3 className="deploy-card__title">Sepolia</h3>
      <dl className="chain-meta">
        <dt>Address</dt>
        <dd title={wallet.address}>
          <code>{shortAddress(wallet.address)}</code>
        </dd>
        <dt>Balance</dt>
        <dd>
          {wallet.balanceWei !== null
            ? `${Number(formatEther(wallet.balanceWei)).toFixed(4)} ETH`
            : '—'}
        </dd>
        <dt>Network</dt>
        <dd>
          {wallet.isSepolia ? (
            <span className="net-badge net-badge--ok">Sepolia</span>
          ) : (
            <span className="net-badge net-badge--warn">
              wrong network (chainId {wallet.chainId})
            </span>
          )}
        </dd>
      </dl>

      {!wallet.isSepolia && (
        <button
          type="button"
          className="pg-btn pg-btn--ghost"
          onClick={() => void switchToSepolia().then(() => void connect())}
        >
          Switch to Sepolia
        </button>
      )}

      <p className="wallet-notice">
        Sepolia deploy is stubbed in Tier 2: Covenant's compiler currently
        emits WASM, not EVM bytecode. The EVM backend bridge lands in Tier 3.
        Use <strong>MockChain</strong> to iterate today.
      </p>
    </section>
  );
}
