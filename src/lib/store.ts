import { create } from 'zustand';
import {
  compile,
  type CompileResult,
  type Diagnostic,
} from './covenant-compiler';
import { loadExampleSource } from './examples';

export interface FileMap {
  [name: string]: string;
}

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

  // --- Actions ---
  setSource: (src: string) => void;
  loadSource: (src: string, fileName?: string) => void;
  compile: () => Promise<void>;
  loadExample: (id: string) => Promise<void>;
  addFile: (name: string, content: string) => void;
  removeFile: (name: string) => void;
  switchFile: (name: string) => void;
  renameFile: (from: string, to: string) => void;
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
}));
