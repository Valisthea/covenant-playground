/**
 * Cross-tab state sync (V0.9 Sprint 36).
 *
 * Broadcasts a curated subset of the playground's Zustand state to all
 * other tabs of the same origin via the browser-native BroadcastChannel
 * API. Other tabs apply the incoming snapshot to their own store, which
 * makes deploys, transactions, and the pending-tx banner visible across
 * all open tabs.
 *
 * Design choices :
 *
 * - **What syncs**: Sepolia contracts, Sepolia tx history, and the
 *   in-flight pending-tx banner. These are the parts of state where a
 *   user reasonably expects "I deployed in tab A, tab B should know
 *   about it" behavior.
 *
 * - **What does NOT sync**: editor source / file map / current file
 *   (per-tab editing is intentional — multiple tabs can edit different
 *   contracts), compile result / diagnostics (per-tab compilation),
 *   inspector hover state, layout mode, MockChain contracts/txs (live
 *   in WASM memory which is per-tab; serializing MockChain state is
 *   V1.0 territory). Wallet state is per-MetaMask-injection and is
 *   handled by the EIP-1193 events, not by us.
 *
 * - **Conflict resolution**: last-write-wins. If two tabs write
 *   simultaneously, the second message to land overwrites. The "loser"
 *   tab sees its state get replaced and gets a `lastSyncFromOtherTab`
 *   timestamp bumped, which a UI component can render as a small toast.
 *
 * - **Loop prevention**: every broadcast carries the sender's `tabId`.
 *   Receivers ignore their own echoes. The local subscribe handler
 *   skips broadcasting when it knows the change came from a remote
 *   message (via the `isApplyingRemote` flag).
 *
 * - **Heartbeat**: each tab announces itself every 5s and on first
 *   load. Tabs that haven't been heard from in 10s are pruned from
 *   the "other tabs" set, which drives the header "N other tabs open"
 *   indicator. On `beforeunload` a `tab-bye` is sent so the indicator
 *   updates promptly when a tab closes.
 *
 * Channel name is versioned (`covenant-playground-v0.9`) so a future
 * format change can use a new channel without dual-handling old senders.
 */

import type { DeployedContract, TxReceipt } from './mockchain';

const CHANNEL_NAME = 'covenant-playground-v0.9';
const HEARTBEAT_INTERVAL_MS = 5_000;
const STALE_TAB_AFTER_MS = 10_000;

export interface SyncedSnapshot {
  sepoliaContracts: DeployedContract[];
  sepoliaTxs: TxReceipt[];
  pendingSepoliaTx: {
    hash: string;
    explorerUrl: string;
    kind: 'deploy' | 'call';
  } | null;
}

type Message =
  | { type: 'snapshot'; tabId: string; timestamp: number; payload: SyncedSnapshot }
  | { type: 'hello'; tabId: string; timestamp: number }
  | { type: 'bye'; tabId: string; timestamp: number };

export interface CrossTabHandlers {
  /** Called when a remote tab broadcasts a state snapshot. */
  onSnapshot: (snapshot: SyncedSnapshot, fromTabId: string) => void;
  /** Called whenever the count of currently-alive other tabs changes. */
  onOtherTabsCountChanged: (count: number) => void;
  /** Called when this tab's state was just overwritten by a remote message. */
  onConflict: (fromTabId: string, timestamp: number) => void;
}

export class CrossTabSync {
  readonly tabId: string;
  private channel: BroadcastChannel;
  private isApplyingRemote = false;
  private otherTabs = new Map<string, number>(); // tabId → last-seen timestamp
  private heartbeatTimer: number | null = null;
  private gcTimer: number | null = null;
  private destroyed = false;

  constructor(private handlers: CrossTabHandlers) {
    this.tabId = generateTabId();
    this.channel = new BroadcastChannel(CHANNEL_NAME);
    this.channel.onmessage = (event) => this.handleMessage(event.data as Message);

    // Announce arrival
    this.send({ type: 'hello', tabId: this.tabId, timestamp: Date.now() });

    // Heartbeat
    this.heartbeatTimer = window.setInterval(() => {
      this.send({ type: 'hello', tabId: this.tabId, timestamp: Date.now() });
    }, HEARTBEAT_INTERVAL_MS);

    // GC stale other-tab entries
    this.gcTimer = window.setInterval(() => {
      const cutoff = Date.now() - STALE_TAB_AFTER_MS;
      let changed = false;
      for (const [tid, last] of this.otherTabs) {
        if (last < cutoff) {
          this.otherTabs.delete(tid);
          changed = true;
        }
      }
      if (changed) this.handlers.onOtherTabsCountChanged(this.otherTabs.size);
    }, HEARTBEAT_INTERVAL_MS);

    // Best-effort cleanup on tab close
    window.addEventListener('beforeunload', () => {
      try {
        this.send({ type: 'bye', tabId: this.tabId, timestamp: Date.now() });
      } catch {
        // ignore — page is unloading anyway
      }
    });
  }

  /**
   * Called by the store's subscribe handler whenever local state changes.
   * Suppresses re-broadcast when the change came from a remote message.
   */
  broadcastSnapshot(payload: SyncedSnapshot) {
    if (this.isApplyingRemote || this.destroyed) return;
    this.send({
      type: 'snapshot',
      tabId: this.tabId,
      timestamp: Date.now(),
      payload,
    });
  }

  /**
   * Visible-for-debugging: returns the count of currently-alive other tabs.
   */
  otherTabsCount(): number {
    return this.otherTabs.size;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.heartbeatTimer !== null) window.clearInterval(this.heartbeatTimer);
    if (this.gcTimer !== null) window.clearInterval(this.gcTimer);
    try {
      this.send({ type: 'bye', tabId: this.tabId, timestamp: Date.now() });
    } catch {
      // ignore
    }
    this.channel.close();
  }

  private send(msg: Message) {
    if (this.destroyed) return;
    this.channel.postMessage(msg);
  }

  private handleMessage(msg: Message) {
    // Ignore our own echo
    if (msg.tabId === this.tabId) return;

    // Track this tab as alive
    const wasNew = !this.otherTabs.has(msg.tabId);
    this.otherTabs.set(msg.tabId, Date.now());
    if (wasNew) {
      this.handlers.onOtherTabsCountChanged(this.otherTabs.size);
    }

    switch (msg.type) {
      case 'snapshot': {
        this.isApplyingRemote = true;
        try {
          this.handlers.onSnapshot(msg.payload, msg.tabId);
          this.handlers.onConflict(msg.tabId, msg.timestamp);
        } finally {
          this.isApplyingRemote = false;
        }
        break;
      }
      case 'bye': {
        if (this.otherTabs.delete(msg.tabId)) {
          this.handlers.onOtherTabsCountChanged(this.otherTabs.size);
        }
        break;
      }
      case 'hello': {
        // Heartbeat already recorded above; nothing else to do.
        break;
      }
    }
  }
}

function generateTabId(): string {
  // crypto.randomUUID is supported in all modern browsers (Chrome 92+,
  // Firefox 95+, Safari 15.4+). Fallback to a less-strong but
  // sufficient random for very old browsers.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'tab-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
