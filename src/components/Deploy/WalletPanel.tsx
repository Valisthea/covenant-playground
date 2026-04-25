import { formatEther } from 'ethers';

import { useStore } from '../../lib/store';
import { hasInjectedWallet, switchToSepolia } from '../../lib/wallet';
import { shortAddress } from '../../lib/mockchain';

/**
 * Sepolia panel. Sprint 24 wired the real `eth_sendTransaction` flow,
 * so this card is no longer a stub: it shows the connected wallet,
 * surfaces network mismatches (with a hard-blocking warning if the user
 * is on mainnet), and links out to faucets when balance is zero.
 */
export function WalletPanel() {
  const wallet = useStore((s) => s.wallet);
  const isConnecting = useStore((s) => s.isConnectingWallet);
  const walletError = useStore((s) => s.walletError);
  const connect = useStore((s) => s.connectWallet);
  const refresh = useStore((s) => s.refreshWallet);

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

  const isZeroBalance = wallet.balanceWei !== null && wallet.balanceWei === 0n;

  return (
    <section className="deploy-card wallet-card">
      <h3 className="deploy-card__title">
        Sepolia
        <button
          type="button"
          className="wallet-refresh"
          onClick={() => void refresh()}
          title="Refresh wallet state"
          aria-label="Refresh balance"
        >
          ↻
        </button>
      </h3>

      {/* Sprint 24 — hard-block mainnet detection. The deploy action
          itself refuses to broadcast on chain 0x1; this banner surfaces
          the situation up-front instead of waiting for the user to click. */}
      {wallet.isMainnet && (
        <div className="wallet-mainnet-block" role="alert">
          <strong>⚠ Mainnet detected.</strong> The playground refuses to
          deploy to Ethereum mainnet. Switch your wallet to Sepolia. For
          production deploys use the Covenant CLI.
          <button
            type="button"
            className="pg-btn pg-btn--ghost"
            onClick={() => void switchToSepolia().then(() => void refresh())}
          >
            Switch to Sepolia
          </button>
        </div>
      )}

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
          ) : wallet.isMainnet ? (
            <span className="net-badge net-badge--danger">Mainnet (blocked)</span>
          ) : (
            <span className="net-badge net-badge--warn">
              wrong network (chainId {wallet.chainId})
            </span>
          )}
        </dd>
      </dl>

      {!wallet.isSepolia && !wallet.isMainnet && (
        <button
          type="button"
          className="pg-btn pg-btn--ghost"
          onClick={() => void switchToSepolia().then(() => void refresh())}
        >
          Switch to Sepolia
        </button>
      )}

      {/* Sprint 24 — faucet hint when balance is zero. The deploy
          preflight will refuse, but giving the user the path forward
          avoids the "I clicked Deploy and got an error" dead end. */}
      {wallet.isSepolia && isZeroBalance && (
        <div className="wallet-faucet-hint">
          <p>
            <strong>Sepolia balance is zero.</strong> Get test ETH from a
            public faucet to deploy:
          </p>
          <ul className="wallet-faucet-list">
            <li>
              <a
                href="https://sepoliafaucet.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                sepoliafaucet.com
              </a>
            </li>
            <li>
              <a
                href="https://www.alchemy.com/faucets/ethereum-sepolia"
                target="_blank"
                rel="noopener noreferrer"
              >
                Alchemy faucet
              </a>
            </li>
            <li>
              <a
                href="https://www.infura.io/faucet/sepolia"
                target="_blank"
                rel="noopener noreferrer"
              >
                Infura faucet
              </a>
            </li>
          </ul>
          <p className="wallet-faucet-tip">
            After topping up, click ↻ to refresh.
          </p>
        </div>
      )}
    </section>
  );
}
