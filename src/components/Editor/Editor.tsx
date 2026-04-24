import { Editor as MonacoEditor, type OnMount } from '@monaco-editor/react';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import type { editor } from 'monaco-editor';
import { registerCovenantLanguage } from './CovenantLang';
import { useStore } from '../../lib/store';
import { getEffective, getTheme } from '../../lib/theme';
import { useSourceAnnotations } from './useSourceAnnotations';

export function Editor() {
  const source = useStore((s) => s.source);
  const setSource = useStore((s) => s.setSource);
  const diagnostics = useStore((s) => s.diagnostics);
  const currentFile = useStore((s) => s.currentFile);
  const files = useStore((s) => s.files);
  const switchFile = useStore((s) => s.switchFile);

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);

  const handleMount: OnMount = useCallback((ed, monaco) => {
    editorRef.current = ed;
    monacoRef.current = monaco;
    registerCovenantLanguage(monaco);

    ed.updateOptions({
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 14,
      lineHeight: 22,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      padding: { top: 14, bottom: 14 },
      bracketPairColorization: { enabled: true },
      renderLineHighlight: 'line',
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      smoothScrolling: true,
      scrollbar: {
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
      },
      guides: {
        bracketPairs: false,
        indentation: true,
      },
    });

    // Keybinding: Ctrl/Cmd+S -> compile (and swallow the browser save dialog)
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      void useStore.getState().compile();
    });

    // ── Inspector hover sync (Sprint 20) ─────────────────────────────────
    // Push the line under the cursor into the store; the Inspector pane
    // subscribes and highlights matching IR instructions. Debounced so
    // raw onMouseMove (fires per pixel) doesn't thrash React renders.
    let hoverDebounce: ReturnType<typeof setTimeout> | null = null;
    ed.onMouseMove((e) => {
      const line = e.target.position?.lineNumber ?? null;
      if (hoverDebounce) clearTimeout(hoverDebounce);
      hoverDebounce = setTimeout(() => {
        useStore.getState().setHoveredSourceLine(line);
      }, 40);
    });
    ed.onDidBlurEditorWidget(() => {
      if (hoverDebounce) clearTimeout(hoverDebounce);
      useStore.getState().setHoveredSourceLine(null);
    });
  }, []);

  // Sync diagnostics into Monaco markers whenever they change.
  // The store always holds the freshest result of the debounced compile.
  useEffect(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco) return;

    const model = ed.getModel();
    if (!model) return;

    const markers = diagnostics.map((d) => {
      // The store has already normalized spans -> line/column via the
      // source it was compiled against. Monaco wants 1-indexed lines.
      const start = { line: d.line, column: d.column };
      const end = {
        line: d.endLine ?? d.line,
        column: d.endColumn ?? d.column + (d.length ?? 1),
      };
      return {
        startLineNumber: start.line,
        startColumn: start.column,
        endLineNumber: end.line,
        endColumn: end.column,
        message: d.code ? `[${d.code}] ${d.message}` : d.message,
        severity:
          d.severity === 'error'
            ? monaco.MarkerSeverity.Error
            : d.severity === 'warning'
              ? monaco.MarkerSeverity.Warning
              : monaco.MarkerSeverity.Info,
      };
    });

    monaco.editor.setModelMarkers(model, 'covenant-compiler', markers);
  }, [diagnostics]);

  // Inline gas/noise/constraint annotations after each source line —
  // only active when the user is in Inspect layout.
  useSourceAnnotations(editorRef, monacoRef);

  // Subscribe to the <html data-theme> attribute so the editor theme
  // flips live when the user toggles dark mode from the Header.
  const effective = useSyncExternalStore(
    subscribeHtmlTheme,
    getHtmlTheme,
    getHtmlTheme,
  );
  const editorTheme = effective === 'dark' ? 'covenant-paper-dark' : 'covenant-paper';

  const fileEntries = Object.keys(files);

  return (
    <div className="editor-frame" style={{ display: 'flex', flexDirection: 'column' }}>
      {fileEntries.length > 1 && (
        <div className="editor-file-tabs" role="tablist">
          {fileEntries.map((name) => (
            <button
              key={name}
              role="tab"
              aria-selected={name === currentFile}
              className={`editor-file-tab ${name === currentFile ? 'active' : ''}`}
              onClick={() => switchFile(name)}
              type="button"
            >
              {name}
            </button>
          ))}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        <MonacoEditor
          height="100%"
          language="covenant"
          theme={editorTheme}
          value={source}
          path={currentFile}
          onChange={(value) => setSource(value ?? '')}
          onMount={handleMount}
          loading={<div className="editor-loading">Loading editor…</div>}
          beforeMount={(monaco) => registerCovenantLanguage(monaco)}
        />
      </div>
    </div>
  );
}

/* ---- html[data-theme] subscription (used by useSyncExternalStore) ---- */

function getHtmlTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return getEffective(getTheme());
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function subscribeHtmlTheme(onChange: () => void): () => void {
  if (typeof MutationObserver === 'undefined') return () => {};
  const obs = new MutationObserver(() => onChange());
  obs.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  return () => obs.disconnect();
}

