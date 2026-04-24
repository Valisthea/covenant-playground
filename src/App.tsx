import { useEffect, useState } from 'react';
import { Routes, Route, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Header } from './components/Layout/Header';
import { Editor } from './components/Editor/Editor';
import { Output } from './components/Output/Output';
import { ExamplesGallery } from './components/ExamplesGallery/ExamplesGallery';
import { ShareDialog } from './components/Share/ShareDialog';
import { OnboardingTour } from './components/Onboarding/OnboardingTour';
import { Tour } from './components/Tour/Tour';
import { useStore } from './lib/store';
import { useTourStore } from './lib/tour-store';
import { parseShareUrl } from './lib/share';
import { getExampleById } from './examples/registry';
import { loadExampleSource } from './examples/loader';
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
            <strong>{completedLessonIds.length}/15 lessons</strong> completed
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

      <div className="app-body">
        <div className="app-editor">
          <div className="mobile-notice">
            <strong>Desktop-only editing</strong>
            Monaco barely works on phones. Open Covenant Playground on a
            desktop browser for the full editor. The output panel and the
            examples gallery still work here.
          </div>
          <Editor />
        </div>

        <div className="app-side">
          <Output />
        </div>
      </div>

      {shareOpen && <ShareDialog onClose={() => setShareOpen(false)} />}
      <OnboardingTour />
    </div>
  );
}

// ─── Root router ──────────────────────────────────────────────────────────────

export default function App() {
  return (
    <Routes>
      <Route path="/tour/:lessonId" element={<Tour />} />
      <Route path="/tour" element={<Tour />} />
      <Route path="/examples" element={<ExamplesGallery />} />
      <Route path="*" element={<Playground />} />
    </Routes>
  );
}
