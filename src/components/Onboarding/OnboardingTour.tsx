import { useEffect, useState } from 'react';

/**
 * Three-step intro modal shown on first visit.
 *
 * Persistence: writes `cov-tour-seen=1` to localStorage once the user
 * hits "Start coding" (or closes the tour via X / Skip). Anyone who
 * lands through a share URL (`?code=…`) skips the tour entirely — if
 * you followed a link to a specific contract, you already know what
 * you came for.
 */

const STORAGE_KEY = 'cov-tour-seen';

interface Step {
  badge: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    badge: 'Step 1 · Write',
    title: 'Covenant, in your browser.',
    body: 'Edit a contract in Monaco on the left. Compilation runs on a debounce — diagnostics land in the Output pane automatically, highlighted inline as you type. Try switching examples from the top-right gallery.',
  },
  {
    badge: 'Step 2 · Simulate',
    title: 'MockChain for fearless experiments.',
    body: 'Open the Deploy tab to instantiate your contract on an in-memory chain. Call actions, advance the clock, mine blocks, and inspect event logs — no wallet, no gas, no network. Perfect for tutorials and for trying breaking changes.',
  },
  {
    badge: 'Step 3 · Privacy, visibly',
    title: 'See FHE, ZK, and Amnesia in motion.',
    body: 'The Privacy tab highlights every FHE / ZK / post-quantum / Amnesia primitive in your source and lets you poke the underlying math in sandboxes. Ciphertexts, proofs, ceremony states — the simulator is deterministic, so teaching it is reproducible.',
  },
];

export function OnboardingTour() {
  const [open, setOpen] = useState<boolean>(() => shouldOpen());
  const [step, setStep] = useState(0);

  // Keyboard: Esc closes, Enter / ArrowRight advances, ArrowLeft goes back.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') advance();
      else if (e.key === 'ArrowLeft') setStep((s) => Math.max(0, s - 1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  function advance() {
    if (step < STEPS.length - 1) setStep(step + 1);
    else dismiss();
  }

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* storage may be disabled (private mode) — failing silently is OK,
         the tour just reappears next visit */
    }
    setOpen(false);
  }

  if (!open) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="tour-overlay" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="tour-card">
        <button
          type="button"
          className="tour-close"
          aria-label="Close tour"
          onClick={dismiss}
        >
          ×
        </button>

        <div className="tour-badge">{current.badge}</div>
        <h2 id="tour-title" className="tour-title">
          {current.title}
        </h2>
        <p className="tour-body">{current.body}</p>

        <div className="tour-footer">
          <div className="tour-dots" aria-hidden="true">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`tour-dot ${i === step ? 'tour-dot--active' : ''}`}
              />
            ))}
          </div>

          <div className="tour-actions">
            <button
              type="button"
              className="pg-btn"
              onClick={dismiss}
              aria-label="Skip the tour"
            >
              Skip
            </button>
            {step > 0 && (
              <button
                type="button"
                className="pg-btn"
                onClick={() => setStep(step - 1)}
              >
                Back
              </button>
            )}
            <button
              type="button"
              className="pg-btn pg-btn--primary"
              onClick={advance}
            >
              {isLast ? 'Start coding' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Only open the tour on first visit AND only when we're on the
 * bare playground URL (no `?code=` share param). Cheap to call so
 * it's fine from useState initialiser.
 */
function shouldOpen(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (localStorage.getItem(STORAGE_KEY) === '1') return false;
  } catch {
    // If storage is unavailable we'd loop the tour on every load —
    // erring on the side of not nagging, default to closed.
    return false;
  }
  const params = new URLSearchParams(window.location.search);
  if (params.has('code')) return false;
  return true;
}
