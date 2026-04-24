/**
 * ArtifactInspector — read-only Monaco viewer over the compiler's
 * artifacts (IR, EVM bytecode, WASM module, ABI). Bidirectionally
 * synced with the source editor via `hoveredSourceLine` /
 * `hoveredIrIndex` in the Zustand store.
 *
 * Sprint 20.
 */
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Editor as MonacoEditor,
  type OnMount,
} from '@monaco-editor/react';
import type { editor as MonacoEditorTypes } from 'monaco-editor';
import { Download } from 'lucide-react';

import { useStore } from '../../lib/store';
import {
  formatHexDump,
  formatIR,
  type InstructionMapping,
  type SourceMap,
} from '../../lib/source-map';

import { ArtifactSelector, type ArtifactKind } from './ArtifactSelector';
import { ArtifactStats } from './ArtifactStats';
import { AnnotationControls } from './AnnotationControls';
import './ArtifactInspector.css';

// ────────────────────────────────────────────────────────────────────────────

export function ArtifactInspector() {
  const compileResult = useStore((s) => s.compileResult);
  const hoveredSourceLine = useStore((s) => s.hoveredSourceLine);

  const [kind, setKind] = useState<ArtifactKind>('ir');

  const sourceMap: SourceMap | null = compileResult?.sourceMap ?? null;

  const available: ArtifactKind[] = useMemo(() => {
    const list: ArtifactKind[] = [];
    if (sourceMap) list.push('ir');
    if (compileResult?.bytecode) list.push('evm');
    if (compileResult?.wasm) list.push('wasm');
    if (compileResult?.abi) list.push('abi');
    return list;
  }, [sourceMap, compileResult]);

  // If the user picked an artifact that isn't available, fall back to first
  useEffect(() => {
    if (available.length > 0 && !available.includes(kind)) {
      setKind(available[0]);
    }
  }, [available, kind]);

  const artifactContent = useMemo(() => {
    if (!compileResult) return '';
    switch (kind) {
      case 'ir':
        return formatIR(sourceMap?.instructions ?? []);
      case 'evm':
        return formatHexDump(compileResult.bytecode ?? '');
      case 'wasm':
        return formatHexDump(compileResult.wasm ?? new Uint8Array());
      case 'abi':
        return JSON.stringify(compileResult.abi ?? [], null, 2);
    }
  }, [compileResult, sourceMap, kind]);

  // Map IR line number → instruction index (for hover sync)
  // The IR text we generate puts a 3-line preamble, so instruction at
  // irIndex N lives at line N + 4 in the editor.
  const IR_PREAMBLE_LINES = 3;

  // ── Monaco setup ───────────────────────────────────────────────────────
  const editorRef = useRef<MonacoEditorTypes.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);
  const decorationCollectionRef = useRef<MonacoEditorTypes.IEditorDecorationsCollection | null>(null);

  const handleMount: OnMount = useCallback((ed, monaco) => {
    editorRef.current = ed;
    monacoRef.current = monaco;
    decorationCollectionRef.current = ed.createDecorationsCollection([]);

    ed.updateOptions({
      readOnly: true,
      domReadOnly: true,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 12,
      lineNumbers: 'on',
      minimap: { enabled: true, scale: 1 },
      scrollBeyondLastLine: false,
      wordWrap: 'off',
      padding: { top: 8, bottom: 8 },
      renderLineHighlight: 'none',
      contextmenu: false,
      glyphMargin: false,
      folding: false,
    });

    // Hover in artifact pane → push the IR index back so other UIs can react
    let hoverDebounce: ReturnType<typeof setTimeout> | null = null;
    ed.onMouseMove((e) => {
      const line = e.target.position?.lineNumber;
      if (line == null) return;
      const idx = line - 1 - IR_PREAMBLE_LINES;
      if (hoverDebounce) clearTimeout(hoverDebounce);
      hoverDebounce = setTimeout(() => {
        useStore.getState().setHoveredIrIndex(idx >= 0 ? idx : null);
      }, 40);
    });
    ed.onDidBlurEditorWidget(() => {
      if (hoverDebounce) clearTimeout(hoverDebounce);
      useStore.getState().setHoveredIrIndex(null);
    });
  }, []);

  // ── Highlight sync: source line → matching IR instructions ─────────────
  useEffect(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    const coll = decorationCollectionRef.current;
    if (!ed || !monaco || !coll) return;
    if (kind !== 'ir') {
      coll.clear();
      return;
    }
    if (!sourceMap || hoveredSourceLine == null) {
      coll.clear();
      return;
    }

    const matching = sourceMap.instructions.filter(
      (i) => i.sourceLine === hoveredSourceLine,
    );

    if (matching.length === 0) {
      coll.clear();
      return;
    }

    const decorations = matching.map((m) => ({
      range: new monaco.Range(
        m.irIndex + 1 + IR_PREAMBLE_LINES,
        1,
        m.irIndex + 1 + IR_PREAMBLE_LINES,
        1,
      ),
      options: {
        isWholeLine: true,
        className: 'ai-line-highlight',
        marginClassName: 'ai-margin-highlight',
      },
    }));

    coll.set(decorations);

    // Scroll the first matching instruction into view
    const first = matching[0];
    ed.revealLineInCenterIfOutsideViewport(first.irIndex + 1 + IR_PREAMBLE_LINES);
  }, [hoveredSourceLine, sourceMap, kind]);

  // ── Theme switch ───────────────────────────────────────────────────────
  const editorTheme = useStore.getState().compileResult ? 'vs' : 'vs';
  // (The Inspector pane is read-only; we keep light theme for now to keep
  // the diff against the source editor obvious. A future tweak could pipe
  // the light/dark token through here too.)

  // ── Source map export ──────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    if (!sourceMap) return;
    const payload = {
      version: 1,
      generatedAt: new Date().toISOString(),
      compilerVersion: compileResult?.metadata?.compiler_version ?? 'unknown',
      synthetic: sourceMap.synthetic,
      stats: sourceMap.stats,
      instructions: sourceMap.instructions,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'covenant-source-map.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [sourceMap, compileResult]);

  // ── Render ─────────────────────────────────────────────────────────────
  if (!compileResult) {
    return (
      <div className="ai-pane">
        <div className="ai-empty">
          <strong>Artifact Inspector</strong>
          <span>Compile a contract to see its IR, bytecode, WASM, and ABI side-by-side with gas, FHE noise, and ZK constraint annotations.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-pane">
      <header className="ai-header">
        <div className="ai-title-row">
          <h3 className="ai-title">Artifact Inspector</h3>
          <button
            type="button"
            className="ai-export"
            onClick={handleExport}
            title="Export source map as JSON"
            disabled={!sourceMap}
          >
            <Download size={13} /> Export
          </button>
        </div>
        <ArtifactSelector
          selected={kind}
          available={available}
          onChange={setKind}
        />
      </header>

      <ArtifactStats stats={sourceMap?.stats ?? null} />

      <div className="ai-anno-row">
        <AnnotationControls />
        {sourceMap?.synthetic && (
          <span className="ai-synthetic-badge" title="Source map currently synthesized in JS — will be replaced by Rust compiler output">
            synthesized
          </span>
        )}
      </div>

      <div className="ai-editor-wrap">
        <MonacoEditor
          height="100%"
          language={languageFor(kind)}
          theme={editorTheme}
          value={artifactContent}
          onMount={handleMount}
          path={`artifact.${kind}`}
        />
      </div>

      {kind === 'ir' && hoveredSourceLine !== null && (
        <HoverHint
          sourceLine={hoveredSourceLine}
          instructions={sourceMap?.instructions ?? []}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function languageFor(kind: ArtifactKind): string {
  switch (kind) {
    case 'abi':
      return 'json';
    case 'ir':
    case 'evm':
    case 'wasm':
    default:
      return 'plaintext';
  }
}

function HoverHint({
  sourceLine,
  instructions,
}: {
  sourceLine: number;
  instructions: InstructionMapping[];
}) {
  const matching = instructions.filter((i) => i.sourceLine === sourceLine);
  if (matching.length === 0) return null;
  return (
    <div className="ai-hover-hint">
      <span className="ai-hover-hint-label">L{sourceLine}:</span>
      <span className="ai-hover-hint-count">
        {matching.length} instruction{matching.length === 1 ? '' : 's'}
      </span>
      <span className="ai-hover-hint-ops">
        {matching
          .slice(0, 4)
          .map((m) => m.opcode)
          .join(' · ')}
        {matching.length > 4 ? ' …' : ''}
      </span>
    </div>
  );
}
