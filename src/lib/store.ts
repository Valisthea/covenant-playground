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
import {
  connectWallet,
  deployToSepolia,
  hasInjectedWallet,
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
  resetChain: () => void;
  mineBlocks: (n: number) => void;
  advanceTime: (seconds: number) => void;

  // --- Wallet actions ---
  connectWallet: () => Promise<void>;
  deployToSepolia: () => Promise<void>;

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
    const { activeContract } = get();
    if (!activeContract) {
      set({ deployError: 'No deployed contract selected.' });
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

  deployToSepolia: async () => {
    const { compileResult, wallet } = get();
    if (!wallet || !wallet.address) {
      set({ deployError: 'Connect your wallet first.' });
      return;
    }
    if (!wallet.isSepolia) {
      set({ deployError: 'Switch the wallet network to Sepolia first.' });
      return;
    }
    if (!compileResult || !compileResult.ok) {
      set({ deployError: 'Compile cleanly before deploying.' });
      return;
    }
    try {
      await deployToSepolia(compileResult.bytecode, compileResult.abi);
    } catch (e) {
      const err = e as Error;
      set({ deployError: err.message });
    }
  },

  // -------------------------------------------------------------------------
  // Derived selectors — read-through to MockChain singleton
  // -------------------------------------------------------------------------

  getDeployedContracts: () =>
    Array.from(getMockChain().contracts.values()),

  getTxs: () => getMockChain().txs,
}));
