import { useEffect, useState } from 'react';
import { Routes, Route, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Header } from './components/Layout/Header';
import { Editor } from './components/Editor/Editor';
import { Output } from './components/Output/Output';
import { ArtifactInspector } from './components/Inspector/ArtifactInspector';
import { LayerExplorer } from './components/LayerExplorer/LayerExplorer';
import { ExamplesGallery } from './components/ExamplesGallery/ExamplesGallery';
import { ShowcasesIndex } from './components/Showcases/ShowcasesIndex';
import { M2NFTPage } from './components/Showcases/M2NFTPage';
import { ContractLanding } from './components/Contract/ContractLanding';
import { ContractInspector } from './components/Contract/ContractInspector';
import type { LayerId } from './lib/layer-analysis';
import { ShareDialog } from './components/Share/ShareDialog';
import { OnboardingTour } from './components/Onboarding/OnboardingTour';
import { Tour } from './components/Tour/Tour';
import { useStore } from './lib/store';
import { useTourStore } from './lib/tour-store';
import { useWalletEvents } from './lib/useWalletEvents';
import { parseShareUrl } from './lib/share';
import { getExampleById } from './examples/registry';
import { loadExampleSource } from './examples/loader';
import { TOTAL_LESSONS } from './tour/curriculum';
import { BookOpen, X } from 'lucide-react';

// ─── Tour banner shown on the playground ──────────────────────────────────────

function TourBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { completedLessonIds, progressPercent } = useTourStore();

  // Don't show if user dismissed this session or completed the whole tour
  if (dismissed || progressPercent() >= 100) return null;

  const hasStarted = completedLessonIds.length > 0;

  return (
    <div className="tour-banner">
      <BookOpen size={15} />
      {hasStarted ? (
        <>
          <span>
            Resume Tour of Covenant —{' '}
            <strong>{completedLessonIds.length}/{TOTAL_LESSONS} lessons</strong> completed
          </span>
          <Link to="/tour" className="tour-banner-cta">
            Continue →
          </Link>
        </>
      ) : (
        <>
          <span>New to Covenant? The interactive tour teaches you the language step-by-step.</span>
          <Link to="/tour" className="tour-banner-cta">
            Start Tour →
          </Link>
        </>
      )}
      <button
        className="tour-banner-dismiss"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss tour banner"
      >
        <X size={13} />
      </button>
    </div>
  );
}

// ─── Playground (root route) ──────────────────────────────────────────────────

function Playground() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [shareOpen, setShareOpen] = useState(false);

  const loadSource = useStore((s) => s.loadSource);
  const compile = useStore((s) => s.compile);
  const layoutMode = useStore((s) => s.layoutMode);
  const setLayoutMode = useStore((s) => s.setLayoutMode);
  const showLayerExplorer = useStore((s) => s.showLayerExplorer);
  const setShowLayerExplorer = useStore((s) => s.setShowLayerExplorer);
  const navigateToSourceLine = useStore((s) => s.navigateToSourceLine);

  // ── Layer Explorer ↔ URL sync ─────────────────────────────────────────
  // ?layer=<id> auto-opens the explorer with that layer expanded.
  const initialLayer = (params.get('layer') as LayerId | null) ?? null;
  useEffect(() => {
    if (initialLayer && !showLayerExplorer) {
      setShowLayerExplorer(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const next = new URLSearchParams(params);
    if (showLayerExplorer) {
      if (next.get('layers') !== '1' && !next.has('layer')) {
        next.set('layers', '1');
        setParams(next, { replace: true });
      }
    } else {
      let dirty = false;
      if (next.has('layers')) {
        next.delete('layers');
        dirty = true;
      }
      if (next.has('layer')) {
        next.delete('layer');
        dirty = true;
      }
      if (dirty) setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLayerExplorer]);

  // Honor ?layers=1 on first paint
  useEffect(() => {
    if (params.get('layers') === '1' && !showLayerExplorer) {
      setShowLayerExplorer(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Layout mode ↔ URL sync ────────────────────────────────────────────
  // On mount, honor ?layout=inspect. Then keep the URL in sync as the
  // user toggles via the header (without spamming history entries).
  useEffect(() => {
    const layout = params.get('layout');
    if (layout === 'inspect' && layoutMode !== 'inspect') {
      setLayoutMode('inspect');
    } else if (layout === 'simple' && layoutMode !== 'simple') {
      setLayoutMode('simple');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const next = new URLSearchParams(params);
    if (layoutMode === 'inspect') {
      if (next.get('layout') !== 'inspect') {
        next.set('layout', 'inspect');
        setParams(next, { replace: true });
      }
    } else {
      if (next.has('layout')) {
        next.delete('layout');
        setParams(next, { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutMode]);

  // One-shot init: load from ?example=, then ?code=, then compile the default.
  useEffect(() => {
    const exampleId = params.get('example');
    const encoded = params.get('code');

    if (exampleId) {
      const ex = getExampleById(exampleId);
      if (ex) {
        loadExampleSource(ex)
          .then((source) => {
            loadSource(source, 'main.cov');
          })
          .catch(() => {
            // Fall back to compiling the default buffer
            void compile();
          })
          .finally(() => {
            // Strip the param from the URL so refreshes don't reload the
            // example and overwrite in-flight edits.
            const next = new URLSearchParams(params);
            next.delete('example');
            setParams(next, { replace: true });
          });
        return;
      }
    }

    if (encoded) {
      const source = parseShareUrl(window.location.href);
      if (source) {
        loadSource(source);
        return;
      }
    }

    // Default path: ensure the output pane is never empty on first paint.
    void compile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app-shell">
      <Header
        onOpenGallery={() => navigate('/examples')}
        onOpenShare={() => setShareOpen(true)}
      />

      <TourBanner />

      <div
        className={`app-body ${layoutMode === 'inspect' ? 'is-inspect' : ''} ${
          showLayerExplorer ? 'has-layers' : ''
        }`}
      >
        <div className="app-editor">
          <div className="mobile-notice">
            <strong>Desktop-only editing</strong>
            Monaco barely works on phones. Open Covenant Playground on a
            desktop browser for the full editor. The output panel and the
            examples gallery still work here.
          </div>
          <Editor />
        </div>

        {layoutMode === 'inspect' && (
          <div className="app-inspector">
            <ArtifactInspector />
          </div>
        )}

        <div className="app-side">
          <Output />
        </div>

        {showLayerExplorer && (
          <div className="app-layers">
            <LayerExplorer
              initialExpanded={initialLayer}
              onNavigateToLine={(line) => navigateToSourceLine(line)}
              onClose={() => setShowLayerExplorer(false)}
            />
          </div>
        )}
      </div>

      {shareOpen && <ShareDialog onClose={() => setShareOpen(false)} />}
      <OnboardingTour />
    </div>
  );
}

// ─── Root router ──────────────────────────────────────────────────────────────

export default function App() {
  // Sprint 26 audit (KSR-CVN-PRELIM-001): subscribe to EIP-1193
  // events so the wallet badge / mainnet refusal banner reflect
  // reality after the user changes networks or accounts inside
  // MetaMask without reloading the page.
  useWalletEvents();

  return (
    <Routes>
      <Route path="/tour/:lessonId" element={<Tour />} />
      <Route path="/tour" element={<Tour />} />
      <Route path="/examples" element={<ExamplesGallery />} />
      <Route path="/showcases" element={<ShowcasesIndex />} />
      <Route path="/showcases/m2-nft" element={<M2NFTPage />} />
      <Route path="/contract" element={<ContractLanding />} />
      <Route path="/contract/:chain/:address" element={<ContractInspector />} />
      <Route path="*" element={<Playground />} />
    </Routes>
  );
}
