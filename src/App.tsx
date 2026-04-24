import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Header } from './components/Layout/Header';
import { Editor } from './components/Editor/Editor';
import { Output } from './components/Output/Output';
import { ExamplesGallery } from './components/ExamplesGallery/ExamplesGallery';
import { ShareDialog } from './components/Share/ShareDialog';
import { OnboardingTour } from './components/Onboarding/OnboardingTour';
import { useStore } from './lib/store';
import { parseShareUrl } from './lib/share';

export default function App() {
  const [params] = useSearchParams();
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const loadSource = useStore((s) => s.loadSource);
  const compile = useStore((s) => s.compile);

  // One-shot init: if URL carries a ?code= share param, decode and load it.
  // Otherwise the store's DEFAULT_EXAMPLE is what Monaco sees.
  useEffect(() => {
    const encoded = params.get('code');
    if (encoded) {
      const source = parseShareUrl(window.location.href);
      if (source) {
        loadSource(source);
        return;
      }
    }
    // Kick off an initial compile so the output pane is never empty
    // on first paint.
    void compile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app-shell">
      <Header
        onOpenGallery={() => setGalleryOpen(true)}
        onOpenShare={() => setShareOpen(true)}
      />

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

      {galleryOpen && (
        <ExamplesGallery onClose={() => setGalleryOpen(false)} />
      )}
      {shareOpen && <ShareDialog onClose={() => setShareOpen(false)} />}
      <OnboardingTour />
    </div>
  );
}
