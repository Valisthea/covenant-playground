/**
 * Per-line source annotations (Sprint 20.3).
 *
 * Aggregates a SourceMap's instructions by source line and emits Monaco
 * decorations that render as faint, after-line virtual text:
 *
 *     balance += amount;        // 5,000 gas
 *     fhe_add(a, b)             // ~3 noise%
 *     zk_verify(proof)          // ~16k constraints
 *
 * Driven by the Zustand store toggles `showGasAnnotations`,
 * `showNoiseAnnotations`, `showConstraintAnnotations`.
 */
import { useEffect, useRef } from 'react';
import type { editor as MonacoEditorTypes } from 'monaco-editor';

import { useStore } from '../../lib/store';
import { formatGas, type SourceMap } from '../../lib/source-map';

interface PerLine {
  gasL1: number;
  gasPgas: number;
  noise: number;     // max along the line, NOT cumulative
  constraints: number;
  fheCount: number;
  zkCount: number;
}

function aggregate(map: SourceMap): Map<number, PerLine> {
  const out = new Map<number, PerLine>();
  for (const ins of map.instructions) {
    const cur = out.get(ins.sourceLine) ?? {
      gasL1: 0,
      gasPgas: 0,
      noise: 0,
      constraints: 0,
      fheCount: 0,
      zkCount: 0,
    };
    cur.gasL1 += ins.gasEstimateL1;
    cur.gasPgas += ins.gasEstimatePgas;
    if (ins.noiseBudget != null) {
      cur.noise = Math.max(cur.noise, ins.noiseBudget);
      cur.fheCount += 1;
    }
    if (ins.constraintCount != null) {
      cur.constraints += ins.constraintCount;
      cur.zkCount += 1;
    }
    out.set(ins.sourceLine, cur);
  }
  return out;
}

function noiseClass(pct: number): string {
  if (pct >= 80) return 'ai-noise-anno ai-noise-anno-danger';
  if (pct >= 50) return 'ai-noise-anno ai-noise-anno-warn';
  return 'ai-noise-anno';
}

/**
 * Apply gas/noise/constraint inline annotations to the source editor.
 *
 * @param editorRef ref to the live Monaco editor instance (may be null
 *                  while the editor is still mounting).
 * @param monacoRef ref to the monaco namespace import.
 */
export function useSourceAnnotations(
  editorRef: React.RefObject<MonacoEditorTypes.IStandaloneCodeEditor | null>,
  monacoRef: React.RefObject<typeof import('monaco-editor') | null>,
) {
  const compileResult = useStore((s) => s.compileResult);
  const showGas = useStore((s) => s.showGasAnnotations);
  const showNoise = useStore((s) => s.showNoiseAnnotations);
  const showConstraints = useStore((s) => s.showConstraintAnnotations);
  const layoutMode = useStore((s) => s.layoutMode);

  const collectionRef = useRef<MonacoEditorTypes.IEditorDecorationsCollection | null>(null);

  useEffect(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco) return;

    // Lazy-init the decorations collection
    if (!collectionRef.current) {
      collectionRef.current = ed.createDecorationsCollection([]);
    }
    const coll = collectionRef.current;

    // Clear when annotations would be irrelevant
    const sm = compileResult?.sourceMap ?? null;
    const anyEnabled = showGas || showNoise || showConstraints;
    if (!sm || !anyEnabled || layoutMode !== 'inspect') {
      coll.clear();
      return;
    }

    const perLine = aggregate(sm);
    const decorations: MonacoEditorTypes.IModelDeltaDecoration[] = [];

    for (const [line, info] of perLine) {
      const parts: { text: string; cls: string }[] = [];

      if (showGas && (info.gasL1 > 0 || info.gasPgas > 0)) {
        const total = info.gasL1 + info.gasPgas;
        parts.push({
          text: `${formatGas(total)} gas`,
          cls: 'ai-gas-anno',
        });
      }
      if (showNoise && info.fheCount > 0 && info.noise > 0) {
        parts.push({
          text: `~${info.noise.toFixed(1)}% noise`,
          cls: noiseClass(info.noise),
        });
      }
      if (showConstraints && info.zkCount > 0 && info.constraints > 0) {
        parts.push({
          text: `~${formatGas(info.constraints)} constraints`,
          cls: 'ai-constraint-anno',
        });
      }

      if (parts.length === 0) continue;

      // Monaco's `after` decoration only takes a single contentText with a
      // single inlineClassName. Emit one decoration per part so each gets
      // its own color (gas faint italic, noise magenta, constraint sky).
      let leadingMargin = '  '; // start gap from code
      for (const part of parts) {
        decorations.push({
          range: new monaco.Range(line, 1, line, 1),
          options: {
            isWholeLine: false,
            after: {
              content: `${leadingMargin}// ${part.text}`,
              inlineClassName: part.cls,
            },
          },
        });
        leadingMargin = '  '; // subsequent parts also get a small gap
      }
    }

    coll.set(decorations);

    return () => {
      // Don't dispose the collection itself — it survives across renders.
      // `set([])` would be cleaner but `clear()` matches the rest of the
      // module's style.
    };
  }, [
    compileResult,
    showGas,
    showNoise,
    showConstraints,
    layoutMode,
    editorRef,
    monacoRef,
  ]);
}
