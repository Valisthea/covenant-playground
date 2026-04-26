import { create } from 'zustand';
import {
  compile,
  type CompileResult,
  type Diagnostic,
} from './covenant-compiler';
import { loadExampleSource } from './examples';
import {
  getMockChain,
  type Address,
  type TxReceipt,
  type DeployedContract,
} from './mockchain';
import { Interface } from 'ethers';
import {
  callOnSepolia,
  connectWallet,
  deployToSepolia,
  etherscanTxUrl,
  hasInjectedWallet,
  refreshWalletState,
  staticCallOnSepolia,
  type WalletState,
} from './wallet';

export interface FileMap {
  [name: string]: string;
}

export type DeployTarget = 'mockchain' | 'sepolia';

interface State {
  // --- Source ---
  source: string;
  files: FileMap;
  currentFile: string;

  // --- Compilation ---
  compileResult: CompileResult | null;
  diagnostics: Diagnostic[];
  isCompiling: boolean;
  lastCompileAt: number | null;

  // --- Deploy / MockChain ---
  target: DeployTarget;
  activeContract: Address | null;
  /** Revision counter bumped whenever MockChain mutates so React re-renders. */
  chainRev: number;
  deployError: string | null;
  isDeploying: boolean;

  // --- Wallet (Sepolia) ---
  wallet: WalletState | null;
  walletError: string | null;
  isConnectingWallet: boolean;

  // --- Sepolia per-target storage (Sprint 24) ---
  /**
   * Contracts deployed via the Sepolia target. Kept separately from
   * MockChain (which lives in WASM memory) so the active-target
   * selectors can return one or the other without merging.
   */
  sepoliaContracts: DeployedContract[];
  sepoliaTxs: TxReceipt[];
  /** Hash + Etherscan URL of the in-flight Sepolia tx, if any. Drives
   *  the PendingTxBanner. Cleared once the receipt resolves. */
  pendingSepoliaTx: { hash: string; explorerUrl: string; kind: 'deploy' | 'call' } | null;
  /** Spinner state for Sepolia state-mutating calls. */
  isCallingSepolia: boolean;

  // --- Inspector (Sprint 20) ---
  /** 'simple' = editor + output, 'inspect' = editor + inspector + output. */
  layoutMode: 'simple' | 'inspect';
  /** Currently hovered source line (1-indexed), null when no hover. */
  hoveredSourceLine: number | null;
  /** Currently hovered IR instruction index, null when no hover. */
  hoveredIrIndex: number | null;
  /** Toggles for inline source annotations (gas/noise/constraints). */
  showGasAnnotations: boolean;
  showNoiseAnnotations: boolean;
  showConstraintAnnotations: boolean;
  setLayoutMode: (m: 'simple' | 'inspect') => void;
  setHoveredSourceLine: (l: number | null) => void;
  setHoveredIrIndex: (i: number | null) => void;
  setShowGasAnnotations: (b: boolean) => void;
  setShowNoiseAnnotations: (b: boolean) => void;
  setShowConstraintAnnotations: (b: boolean) => void;

  // --- Layer Explorer (Sprint 21) ---
  /** Whether the architecture sidebar is visible. */
  showLayerExplorer: boolean;
  setShowLayerExplorer: (b: boolean) => void;
  /**
   * One-shot navigation request from the Layer Explorer (or any other
   * panel) to the source editor. Components subscribe and react with
   * `revealLineInCenter` + `setPosition`. Bumping the rev with the same
   * line still triggers a fresh reveal.
   */
  navTarget: { line: number; column: number; rev: number } | null;
  navigateToSourceLine: (line: number, column?: number) => void;

  // --- Source actions ---
  setSource: (src: string) => void;
  loadSource: (src: string, fileName?: string) => void;
  compile: () => Promise<void>;
  loadExample: (id: string) => Promise<void>;
  addFile: (name: string, content: string) => void;
  removeFile: (name: string) => void;
  switchFile: (name: string) => void;
  renameFile: (from: string, to: string) => void;

  // --- Deploy actions ---
  setTarget: (t: DeployTarget) => void;
  setActiveAccount: (addr: Address) => void;
  setActiveContract: (addr: Address | null) => void;
  deploy: () => Promise<TxReceipt | null>;
  callAction: (action: string, args: unknown[]) => TxReceipt | null;
  /** Sprint 24 — async Sepolia call. Routed automatically by `callAction`
   *  when `target === 'sepolia'`. Exposed publicly for components that
   *  want explicit control (Tour runtime validators, smoke tests). */
  callActionOnSepolia: (action: string, args: unknown[]) => Promise<void>;
  resetChain: () => void;
  mineBlocks: (n: number) => void;
  advanceTime: (seconds: number) => void;

  // --- Wallet actions ---
  connectWallet: () => Promise<void>;
  refreshWallet: () => Promise<void>;
  deployToSepolia: () => Promise<void>;

  // --- Cross-tab sync (V0.9 Sprint 36) ---
  /** Number of OTHER playground tabs currently open in this browser. */
  otherTabsCount: number;
  /** Timestamp (Date.now()) of the last incoming cross-tab snapshot.
   *  null when no remote sync has ever happened in this tab. */
  lastSyncFromOtherTab: number | null;

  // --- Derived (computed on read) ---
  getDeployedContracts: () => DeployedContract[];
  getTxs: () => TxReceipt[];
}

const DEFAULT_EXAMPLE = `-- Welcome to Covenant Playground.
-- Press Ctrl+S to compile, or hit "Compile" in the header.

record Hello {
    greeting: text

    action update(new_text: text) {
        greeting = new_text
    }

    view read returns text {
        greeting
    }
}
`;

// Private: debounce handle for the auto-compile timer. Lives on the
// module so multiple setSource calls across renders coalesce correctly.
let compileTimer: ReturnType<typeof setTimeout> | null = null;
const COMPILE_DEBOUNCE_MS = 500;

export const useStore = create<State>((set, get) => ({
  source: DEFAULT_EXAMPLE,
  files: { 'main.cov': DEFAULT_EXAMPLE },
  currentFile: 'main.cov',

  compileResult: null,
  diagnostics: [],
  isCompiling: false,
  lastCompileAt: null,

  target: 'mockchain',
  activeContract: null,
  chainRev: 0,
  deployError: null,
  isDeploying: false,

  wallet: null,
  walletError: null,
  isConnectingWallet: false,

  // Sprint 24 — per-target storage (Sepolia)
  sepoliaContracts: [],
  sepoliaTxs: [],
  pendingSepoliaTx: null,
  isCallingSepolia: false,

  // Sprint 36 — cross-tab sync
  otherTabsCount: 0,
  lastSyncFromOtherTab: null,

  // Inspector defaults
  layoutMode: 'simple',
  hoveredSourceLine: null,
  hoveredIrIndex: null,
  showGasAnnotations: true,
  showNoiseAnnotations: true,
  showConstraintAnnotations: true,
  setLayoutMode: (layoutMode) => set({ layoutMode }),
  setHoveredSourceLine: (hoveredSourceLine) => set({ hoveredSourceLine }),
  setHoveredIrIndex: (hoveredIrIndex) => set({ hoveredIrIndex }),
  setShowGasAnnotations: (showGasAnnotations) => set({ showGasAnnotations }),
  setShowNoiseAnnotations: (showNoiseAnnotations) => set({ showNoiseAnnotations }),
  setShowConstraintAnnotations: (showConstraintAnnotations) =>
    set({ showConstraintAnnotations }),

  // Layer Explorer defaults
  showLayerExplorer: false,
  navTarget: null,
  setShowLayerExplorer: (showLayerExplorer) => set({ showLayerExplorer }),
  navigateToSourceLine: (line, column = 1) => {
    const prev = get().navTarget?.rev ?? 0;
    set({ navTarget: { line, column, rev: prev + 1 } });
  },

  setSource: (source) => {
    const { currentFile, files } = get();
    set({
      source,
      files: { ...files, [currentFile]: source },
    });

    if (compileTimer) clearTimeout(compileTimer);
    compileTimer = setTimeout(() => {
      void get().compile();
    }, COMPILE_DEBOUNCE_MS);
  },

  /**
   * Replace the editor's current buffer wholesale. Used by share-URL
   * loading and the examples gallery. Bypasses the debounce and runs a
   * compile immediately so the user lands on a pre-populated output pane.
   */
  loadSource: (source, fileName = 'main.cov') => {
    if (compileTimer) {
      clearTimeout(compileTimer);
      compileTimer = null;
    }
    set({
      source,
      files: { [fileName]: source },
      currentFile: fileName,
    });
    void get().compile();
  },

  compile: async () => {
    if (get().isCompiling) return;
    const { source } = get();
    set({ isCompiling: true });

    try {
      const result = await compile(source);
      set({
        compileResult: result,
        diagnostics: result.diagnostics,
        isCompiling: false,
        lastCompileAt: Date.now(),
      });
    } catch (e) {
      const err = e as Error;
      set({
        compileResult: null,
        diagnostics: [
          {
            severity: 'error',
            message: `Compiler crashed: ${err.message}`,
            line: 1,
            column: 1,
            code: 'ICE',
          },
        ],
        isCompiling: false,
        lastCompileAt: Date.now(),
      });
    }
  },

  loadExample: async (id) => {
    try {
      const source = await loadExampleSource(id);
      get().loadSource(source, 'main.cov');
    } catch (e) {
      const err = e as Error;
      set({
        diagnostics: [
          {
            severity: 'error',
            message: `Failed to load example "${id}": ${err.message}`,
            line: 1,
            column: 1,
            code: 'IO01',
          },
        ],
      });
    }
  },

  addFile: (name, content) => {
    const { files } = get();
    if (files[name] !== undefined) {
      // Don't clobber an existing file — surface via diagnostics instead.
      return;
    }
    set({ files: { ...files, [name]: content } });
  },

  removeFile: (name) => {
    const { files, currentFile } = get();
    if (Object.keys(files).length <= 1) return; // always keep one file
    const { [name]: _removed, ...rest } = files;
    const nextCurrent =
      currentFile === name ? Object.keys(rest)[0] : currentFile;
    set({
      files: rest,
      currentFile: nextCurrent,
      source: rest[nextCurrent],
    });
  },

  switchFile: (name) => {
    const { files } = get();
    if (files[name] === undefined) return;
    set({ currentFile: name, source: files[name] });
  },

  renameFile: (from, to) => {
    const { files, currentFile } = get();
    if (files[from] === undefined || files[to] !== undefined) return;
    const { [from]: content, ...rest } = files;
    set({
      files: { ...rest, [to]: content },
      currentFile: currentFile === from ? to : currentFile,
    });
  },

  // -------------------------------------------------------------------------
  // Deploy / MockChain actions
  // -------------------------------------------------------------------------

  setTarget: (target) => set({ target, deployError: null }),

  setActiveAccount: (addr) => {
    getMockChain().setActiveAccount(addr);
    set((s) => ({ chainRev: s.chainRev + 1 }));
  },

  setActiveContract: (addr) => set({ activeContract: addr }),

  deploy: async () => {
    const { compileResult, target, currentFile } = get();
    if (!compileResult) {
      set({ deployError: 'Compile the contract first.' });
      return null;
    }
    if (!compileResult.ok) {
      set({ deployError: 'Fix compile errors before deploying.' });
      return null;
    }

    if (target === 'sepolia') {
      // Delegate to the wallet flow; surface errors but never block the UI.
      void get().deployToSepolia();
      return null;
    }

    set({ isDeploying: true, deployError: null });
    try {
      const name = currentFile.replace(/\.cov$/, '');
      const receipt = getMockChain().deploy(compileResult, name);
      set((s) => ({
        chainRev: s.chainRev + 1,
        activeContract: receipt.to,
        isDeploying: false,
      }));
      return receipt;
    } catch (e) {
      const err = e as Error;
      set({ isDeploying: false, deployError: err.message });
      return null;
    }
  },

  callAction: (action, args) => {
    const { activeContract, target } = get();
    if (!activeContract) {
      set({ deployError: 'No deployed contract selected.' });
      return null;
    }

    // Sepolia path: route through MetaMask. Returns null synchronously
    // because the call is async; the receipt lands in `sepoliaTxs` and
    // the UI re-renders via the chainRev bump.
    if (target === 'sepolia') {
      void get().callActionOnSepolia(action, args);
      return null;
    }

    try {
      const receipt = getMockChain().call(activeContract, action, args);
      set((s) => ({ chainRev: s.chainRev + 1 }));
      return receipt;
    } catch (e) {
      const err = e as Error;
      set({ deployError: err.message });
      return null;
    }
  },

  /**
   * Sprint 24 — call a state-mutating action on a Sepolia-deployed
   * contract. Encodes calldata via the cached ABI, opens MetaMask,
   * waits for the receipt, appends to `sepoliaTxs`.
   *
   * Views (`stateMutability === 'view' | 'pure'`) route through
   * `eth_call` (free, no wallet popup) and decode the return value
   * via `Interface.decodeFunctionResult`.
   */
  callActionOnSepolia: async (action: string, args: unknown[]) => {
    const { activeContract, sepoliaContracts, wallet } = get();
    if (!activeContract) {
      set({ deployError: 'No deployed contract selected.' });
      return;
    }
    const contract = sepoliaContracts.find(
      (c) => c.address.toLowerCase() === activeContract.toLowerCase(),
    );
    if (!contract) {
      set({ deployError: 'Contract not in Sepolia registry.' });
      return;
    }
    if (!wallet || !wallet.address) {
      set({ deployError: 'Connect your wallet first.' });
      return;
    }

    let iface: Interface;
    let calldata: string;
    let isView: boolean;
    try {
      iface = new Interface(contract.abi as readonly unknown[] as []);
      const fn = iface.getFunction(action);
      if (!fn) {
        set({ deployError: `Action "${action}" not in ABI.` });
        return;
      }
      isView = fn.stateMutability === 'view' || fn.stateMutability === 'pure';
      calldata = iface.encodeFunctionData(action, args);
    } catch (e) {
      set({ deployError: `ABI encode failed: ${(e as Error).message}` });
      return;
    }

    set({ isCallingSepolia: true, deployError: null });

    if (isView) {
      // eth_call — free, fast, no popup.
      try {
        const r = await staticCallOnSepolia(wallet.address, activeContract, calldata);

        // Sprint 26 audit (KSR-CVN-PRELIM-002): if the wallet drifted
        // off Sepolia between connect and this view call, the eth_call
        // ran against a wrong network and the result is misleading.
        // Surface that explicitly so the InteractionPanel UI can warn
        // the user instead of silently presenting wrong data.
        const SEPOLIA_HEX = '0xaa36a7';
        const onWrongChain =
          r.observedChainId !== null &&
          r.observedChainId.toLowerCase() !== SEPOLIA_HEX;
        const networkWarning = onWrongChain
          ? `eth_call ran against chain ${r.observedChainId}, not Sepolia (${SEPOLIA_HEX}). Result may not reflect Sepolia state.`
          : undefined;

        const receipt: TxReceipt = {
          hash: '0x' + '0'.repeat(64),
          blockNumber: 0,
          timestamp: Math.floor(Date.now() / 1000),
          from: wallet.address as Address,
          to: activeContract,
          kind: 'view',
          action,
          args,
          gasUsed: 0n,
          status: r.ok ? 'success' : 'reverted',
          // Stack the network warning on top of any revert reason so the
          // user sees both signals in the UI.
          revertReason:
            !r.ok
              ? [networkWarning, r.revertReason].filter(Boolean).join(' — ')
              : networkWarning,
          events: [],
        };
        if (r.ok && r.returnDataHex && r.returnDataHex !== '0x') {
          try {
            const decoded = iface.decodeFunctionResult(action, r.returnDataHex);
            receipt.returnValue = decoded.length === 1 ? decoded[0] : decoded;
          } catch {
            receipt.returnValue = r.returnDataHex;
          }
        }
        set((s) => ({
          isCallingSepolia: false,
          sepoliaTxs: [receipt, ...s.sepoliaTxs],
          chainRev: s.chainRev + 1,
        }));
      } catch (e) {
        set({ isCallingSepolia: false, deployError: (e as Error).message });
      }
      return;
    }

    // State-mutating call — MetaMask popup, 12-30s wait.
    try {
      const r = await callOnSepolia(activeContract, calldata, 0n);
      const receipt: TxReceipt = {
        hash: r.txHash,
        blockNumber: r.blockNumber,
        timestamp: Math.floor(Date.now() / 1000),
        from: wallet.address as Address,
        to: activeContract,
        kind: 'call',
        action,
        args,
        gasUsed: r.gasUsed,
        status: r.status,
        events: [],
      };
      set((s) => ({
        isCallingSepolia: false,
        pendingSepoliaTx: null,
        sepoliaTxs: [receipt, ...s.sepoliaTxs],
        chainRev: s.chainRev + 1,
      }));
      // Refresh balance after gas spend.
      void get().refreshWallet();
    } catch (e) {
      set({ isCallingSepolia: false, pendingSepoliaTx: null, deployError: (e as Error).message });
    }
  },

  resetChain: () => {
    getMockChain().reset();
    set((s) => ({
      chainRev: s.chainRev + 1,
      activeContract: null,
      deployError: null,
    }));
  },

  mineBlocks: (n) => {
    getMockChain().mineBlocks(n);
    set((s) => ({ chainRev: s.chainRev + 1 }));
  },

  advanceTime: (seconds) => {
    getMockChain().advanceTime(seconds);
    set((s) => ({ chainRev: s.chainRev + 1 }));
  },

  // -------------------------------------------------------------------------
  // Wallet (Sepolia) actions
  // -------------------------------------------------------------------------

  connectWallet: async () => {
    if (!hasInjectedWallet()) {
      set({
        walletError:
          'No EIP-1193 wallet detected. Install MetaMask to connect.',
      });
      return;
    }
    set({ isConnectingWallet: true, walletError: null });
    try {
      const wallet = await connectWallet();
      set({ wallet, isConnectingWallet: false });
    } catch (e) {
      const err = e as Error;
      set({ isConnectingWallet: false, walletError: err.message });
    }
  },

  refreshWallet: async () => {
    const { wallet } = get();
    if (!wallet?.address) return;
    try {
      const fresh = await refreshWalletState(wallet.address);
      set({ wallet: fresh });
    } catch (e) {
      // Silent — refresh is best-effort.
      console.debug('[wallet] refresh failed:', e);
    }
  },

  /**
   * Sprint 24 — real Sepolia deploy.
   *
   * On success, the contract is appended to `sepoliaContracts`, the
   * deploy receipt to `sepoliaTxs`, and `activeContract` is updated so
   * the InteractionPanel surfaces the new contract immediately.
   */
  deployToSepolia: async () => {
    const { compileResult, wallet, currentFile } = get();
    if (!wallet || !wallet.address) {
      set({ deployError: 'Connect your wallet first.' });
      return;
    }
    if (wallet.isMainnet) {
      set({
        deployError: 'Mainnet detected — playground refuses mainnet deploys. Switch to Sepolia.',
      });
      return;
    }
    if (!compileResult || !compileResult.ok) {
      set({ deployError: 'Compile cleanly before deploying.' });
      return;
    }
    if (!compileResult.bytecode) {
      set({ deployError: 'Compile result has no bytecode.' });
      return;
    }

    set({ isDeploying: true, deployError: null });
    try {
      const r = await deployToSepolia(compileResult.bytecode, compileResult.abi);

      const name = currentFile.replace(/\.cov$/, '');
      const contract: DeployedContract = {
        address: r.contractAddress as Address,
        deployer: r.from as Address,
        deployedAt: r.blockNumber,
        abi: (compileResult.abi as DeployedContract['abi']) ?? [],
        storage: {},
        name,
        runtimeBytecodeSize: compileResult.bytecode.length / 2 - 1,
      };
      const receipt: TxReceipt = {
        hash: r.txHash,
        blockNumber: r.blockNumber,
        timestamp: Math.floor(Date.now() / 1000),
        from: r.from as Address,
        to: r.contractAddress as Address,
        kind: 'deploy',
        gasUsed: r.gasUsed,
        status: 'success',
        events: [],
      };

      set((s) => ({
        isDeploying: false,
        pendingSepoliaTx: null,
        sepoliaContracts: [...s.sepoliaContracts, contract],
        sepoliaTxs: [receipt, ...s.sepoliaTxs],
        activeContract: contract.address,
        chainRev: s.chainRev + 1,
      }));
      // Refresh balance after gas spend.
      void get().refreshWallet();
    } catch (e) {
      const err = e as Error;
      set({ isDeploying: false, pendingSepoliaTx: null, deployError: err.message });
    }
  },

  // -------------------------------------------------------------------------
  // Derived selectors — target-aware (Sprint 24)
  // -------------------------------------------------------------------------

  getDeployedContracts: () => {
    const { target, sepoliaContracts } = get();
    if (target === 'sepolia') return sepoliaContracts;
    return Array.from(getMockChain().contracts.values());
  },

  getTxs: () => {
    const { target, sepoliaTxs } = get();
    if (target === 'sepolia') return sepoliaTxs;
    return getMockChain().txs;
  },
}));

// Re-export the etherscan helper so components can import it from the
// store rather than reaching into wallet.ts directly. Keeps the layering
// honest — wallet.ts is the bottom of the stack, components stay above.
export { etherscanTxUrl as etherscanTxUrlFor };

// ─── Cross-tab sync wiring (Sprint 36) ───────────────────────────────────

import { CrossTabSync, type SyncedSnapshot } from './cross-tab';

/**
 * Singleton cross-tab sync instance. Created lazily on first access so
 * that SSR / non-browser environments (test harnesses, build-time
 * pre-rendering) don't try to open a BroadcastChannel.
 */
let crossTabSync: CrossTabSync | null = null;

function ensureCrossTabSync(): CrossTabSync | null {
  if (crossTabSync !== null) return crossTabSync;
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null;
  }
  crossTabSync = new CrossTabSync({
    onSnapshot: (snapshot) => {
      // Apply remote snapshot. Zustand's setState merges shallow keys.
      useStore.setState({
        sepoliaContracts: snapshot.sepoliaContracts,
        sepoliaTxs: snapshot.sepoliaTxs,
        pendingSepoliaTx: snapshot.pendingSepoliaTx,
      });
    },
    onOtherTabsCountChanged: (count) => {
      useStore.setState({ otherTabsCount: count });
    },
    onConflict: (_fromTabId, timestamp) => {
      useStore.setState({ lastSyncFromOtherTab: timestamp });
    },
  });
  return crossTabSync;
}

// Subscribe to local store changes and broadcast the synced subset to
// other tabs. JSON-stringify is used as a cheap deep-equal check on the
// payload to avoid spamming the channel with redundant snapshots.
let _lastBroadcastJson = '';
useStore.subscribe((state) => {
  const sync = ensureCrossTabSync();
  if (sync === null) return;
  const snapshot: SyncedSnapshot = {
    sepoliaContracts: state.sepoliaContracts,
    sepoliaTxs: state.sepoliaTxs,
    pendingSepoliaTx: state.pendingSepoliaTx,
  };
  const json = JSON.stringify(snapshot);
  if (json === _lastBroadcastJson) return;
  _lastBroadcastJson = json;
  sync.broadcastSnapshot(snapshot);
});

// Initialize immediately so the heartbeat starts (otherwise tabs won't
// see each other until the first state-changing action).
ensureCrossTabSync();
