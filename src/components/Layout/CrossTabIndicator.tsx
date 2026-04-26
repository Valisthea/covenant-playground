/**
 * CrossTabIndicator — header chip showing how many OTHER playground
 * tabs are open in this browser, plus a brief "synced" pulse when a
 * remote snapshot was just applied.
 *
 * Visible only when at least one other tab is connected. Click for
 * a short tooltip explaining what's synced (Sepolia state) and what's
 * NOT (editor + MockChain are per-tab).
 *
 * V0.9 Sprint 36 deliverable.
 */

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { useStore } from '../../lib/store';

const SYNC_PULSE_MS = 2_000;

export function CrossTabIndicator() {
  const otherTabsCount = useStore((s) => s.otherTabsCount);
  const lastSyncFromOtherTab = useStore((s) => s.lastSyncFromOtherTab);
  const [showTooltip, setShowTooltip] = useState(false);
  const [pulsing, setPulsing] = useState(false);

  // Pulse the indicator briefly when a remote snapshot lands.
  useEffect(() => {
    if (lastSyncFromOtherTab === null) return;
    setPulsing(true);
    const timer = window.setTimeout(() => setPulsing(false), SYNC_PULSE_MS);
    return () => window.clearTimeout(timer);
  }, [lastSyncFromOtherTab]);

  if (otherTabsCount === 0) return null;

  const label =
    otherTabsCount === 1 ? '1 other tab' : `${otherTabsCount} other tabs`;

  return (
    <div
      className="pg-cross-tab-indicator-wrap"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span
        className={`pg-cross-tab-indicator ${pulsing ? 'is-syncing' : ''}`}
        role="status"
        aria-live="polite"
        aria-label={`${label} open; cross-tab sync active`}
      >
        <Users size={11} aria-hidden="true" />
        <span className="pg-cross-tab-count">{label}</span>
        {pulsing && <span className="pg-cross-tab-pulse">synced</span>}
      </span>
      {showTooltip && (
        <div className="pg-cross-tab-tooltip" role="tooltip">
          <strong>Cross-tab sync · live</strong>
          <p>
            Sepolia deploys, transaction history, and the pending-tx
            banner stay in sync across all open Covenant Playground tabs.
          </p>
          <p style={{ opacity: 0.7, marginTop: 4, fontSize: '0.85em' }}>
            Editor source and MockChain state stay per-tab — multiple
            tabs can edit different contracts at once.
          </p>
        </div>
      )}
    </div>
  );
}
