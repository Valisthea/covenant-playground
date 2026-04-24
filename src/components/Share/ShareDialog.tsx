import { useMemo, useState } from 'react';
import { useStore } from '../../lib/store';
import { estimateShareUrlBytes, generateShareUrl } from '../../lib/share';

interface Props {
  onClose: () => void;
}

export function ShareDialog({ onClose }: Props) {
  const source = useStore((s) => s.source);
  const [copied, setCopied] = useState(false);

  const url = useMemo(() => generateShareUrl(source), [source]);
  const urlBytes = useMemo(() => estimateShareUrlBytes(source), [source]);
  const sourceBytes = new Blob([source]).size;

  const tooLong = urlBytes > 2000;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback: select the input's content so the user can Ctrl+C manually.
      const el = document.getElementById('share-url-input') as HTMLInputElement | null;
      el?.select();
    }
  };

  const twitterHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    'Live Covenant snippet — compile + deploy in your browser',
  )}&url=${encodeURIComponent(url)}&via=Covenant_Lang`;

  return (
    <div
      className="gallery-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="share-modal">
        <div className="share-title" id="share-title">
          Share this snippet
        </div>
        <div className="share-desc">
          The source is LZ-compressed and encoded into the query string.
          Anyone who opens the URL lands on the exact editor state you have
          right now — no backend involved.
        </div>

        <div className="share-url-box">
          <input
            id="share-url-input"
            className="share-url-input"
            readOnly
            value={url}
            aria-label="Share URL"
          />
          <button
            className="pg-btn pg-btn--primary"
            onClick={() => void onCopy()}
            type="button"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <div className="share-meta">
          Source: {sourceBytes} B · URL: ~{urlBytes} chars
          {tooLong && (
            <span style={{ color: 'var(--warn)', marginLeft: 8 }}>
              ⚠ Exceeds 2k — some clients may truncate.
            </span>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 20,
            borderTop: '1px solid var(--rule-faint)',
            paddingTop: 16,
          }}
        >
          <a className="pg-btn" href={twitterHref} target="_blank" rel="noopener">
            Post to X
          </a>
          <div style={{ flex: 1 }} />
          <button className="pg-btn" onClick={onClose} type="button">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
