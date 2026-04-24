/**
 * Monaco self-host configuration.
 *
 * By default `@monaco-editor/react` loads Monaco from jsdelivr's CDN,
 * which is fine for a scaffold but ties the playground's cold-start
 * path to a third-party origin. This module:
 *
 *   1. Imports Monaco directly from the bundled `monaco-editor`
 *      package (already in deps — picked up by our `monaco` manualChunk).
 *   2. Points `@monaco-editor/react`'s loader at that bundle via
 *      `loader.config({ monaco })`.
 *   3. Wires the editor's base web worker so Monaco's background
 *      tokenization / diff calculation runs off the main thread.
 *
 * Covenant is a pure-frontend custom language (no TS/JSON/CSS language
 * service workers), so we only register the editor worker. If we ever
 * turn on IntelliSense for inline JS/TS snippets this file grows the
 * full worker map.
 *
 * Must be imported ONCE, before the first <Editor> render. See
 * `src/main.tsx`.
 */

import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';
// Vite's ?worker suffix produces a web-worker constructor that plays
// nicely with the self-hosted Monaco bundle.
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

// Wire the editor worker. Monaco calls `self.MonacoEnvironment.getWorker`
// lazily the first time a model is created.
(self as unknown as { MonacoEnvironment: MonacoEnvironment }).MonacoEnvironment = {
  getWorker() {
    return new EditorWorker();
  },
};

// Point @monaco-editor/react at the local module — this bypasses the
// CDN fetch entirely.
loader.config({ monaco });

// Eagerly initialize so the first render doesn't flash a loading state.
// Errors here are swallowed; the React wrapper falls back to its own
// loading UI if init fails for any reason.
loader.init().catch(() => {
  /* non-fatal — the editor will attempt init again on mount */
});

interface MonacoEnvironment {
  getWorker: (moduleId: string, label: string) => Worker;
}
