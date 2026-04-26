/**
 * Sprint 26 audit (KSR-CVN-PRELIM-008): prominent post-deploy
 * confirmation banner. Pre-fix, the only signal that a Sepolia deploy
 * succeeded was MetaMask's own browser notification (which closes
 * after a few seconds) plus a row in ContractList that lived below
 * the tall WalletPanel — easily scrolled off-screen.
 *
 * This banner renders directly under the Deploy button when there's
 * a successful deploy in the active target's tx_log within the last
 * 60 seconds. Self-dismisses on next compile (so it doesn't linger
 * across edits) and on user × click.
 */

import { useMemo, useState, useEffect } from 'react';
import { ArrowDown, ExternalLink, X } from 'lucide-react';

import { useStore } from '../../lib/store';
import { shortAddress } from '../../lib/mockchain';
import { etherscanAddressUrl } from '../../lib/wallet';

const FRESHNESS_WINDOW_SEC = 60;

export function RecentDeployBanner() {
  // Re-read on every chainRev bump so we catch the deploy receipt as
  // soon as the store stitches it in.
  useStore((s) => s.chainRev);
  const target = useStore((s) => s.target);
  const getTxs = useStore((s) => s.getTxs);
  const compileResult = useStore((s) => s.compileResult);
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissal on each new compile — so a freshly-deployed
  // contract from the previous compile doesn't keep nagging if the
  // user moves on, BUT a new deploy from a new compile re-shows.
  useEffect(() => {
    setDismissed(false);
  }, [compileResult?.bytecode]);

  const recentDeploy = useMemo(() => {
    const nowSec = Math.floor(Date.now() / 1000);
    const txs = getTxs();
    return (
      txs.find(
        (tx) =>
          tx.kind === 'deploy' &&
          tx.status === 'success' &&
          tx.to !== null &&
          nowSec - tx.timestamp <= FRESHNESS_WINDOW_SEC,
      ) ?? null
    );
  }, [getTxs]);

  if (dismissed || !recentDeploy || !recentDeploy.to) return null;

  const address = recentDeploy.to;
  const isSepolia = target === 'sepolia';

  const onScrollToInteract = () => {
    // The InteractionPanel renders below ContractList. Scroll the
    // first interaction-card into view — works for both targets.
    const el = document.querySelector('.interaction-card');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // Fallback: scroll the contract list into view at minimum.
      const cl = document.querySelector('.contract-list');
      cl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div
      className={`deploy-success-banner ${isSepolia ? 'deploy-success-banner--sepolia' : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className="deploy-success-banner__check" aria-hidden="true">
        ✓
      </span>
      <div className="deploy-success-banner__body">
        <span className="deploy-success-banner__title">
          Deployed to {isSepolia ? 'Sepolia' : 'MockChain'}
        </span>
        <code className="deploy-success-banner__addr" title={address}>
          {shortAddress(address)}
        </code>
      </div>
      <div className="deploy-success-banner__actions">
        {isSepolia && (
          <a
            href={etherscanAddressUrl(address)}
            target="_blank"
            rel="noopener noreferrer"
            className="deploy-success-banner__link"
            title="Open contract on Sepolia Etherscan"
          >
            Etherscan <ExternalLink size={11} />
          </a>
        )}
        <button
          type="button"
          className="deploy-success-banner__cta"
          onClick={onScrollToInteract}
          title="Scroll to the Interact panel"
        >
          Interact <ArrowDown size={11} />
        </button>
        <button
          type="button"
          className="deploy-success-banner__dismiss"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          title="Dismiss"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
