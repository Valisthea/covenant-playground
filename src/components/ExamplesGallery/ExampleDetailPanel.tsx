import { useEffect, useState } from 'react';
import { X, ArrowRight, ExternalLink, Loader } from 'lucide-react';
import type { Example } from '../../examples/types';
import {
  categoryLabel,
  difficultyColor,
  difficultyLabel,
} from '../../examples/types';
import { resolveRelated } from '../../examples/registry';
import { loadExampleSource } from '../../examples/loader';

type TabKey = 'overview' | 'source' | 'modify' | 'related';

interface Props {
  example: Example;
  onClose: () => void;
  onOpenInPlayground: (ex: Example) => void;
  onSelectRelated: (ex: Example) => void;
}

export function ExampleDetailPanel({
  example,
  onClose,
  onOpenInPlayground,
  onSelectRelated,
}: Props) {
  const [tab, setTab] = useState<TabKey>('overview');
  const [source, setSource] = useState<string | null>(null);
  const [sourceErr, setSourceErr] = useState<string | null>(null);
  const [loadingSource, setLoadingSource] = useState(false);

  // Load source when the Source tab is first opened
  useEffect(() => {
    if (tab !== 'source' || source !== null) return;
    setLoadingSource(true);
    setSourceErr(null);
    loadExampleSource(example)
      .then((s) => setSource(s))
      .catch((e) => setSourceErr((e as Error).message))
      .finally(() => setLoadingSource(false));
  }, [tab, example, source]);

  // Reset tab + source when the example changes
  useEffect(() => {
    setTab('overview');
    setSource(null);
    setSourceErr(null);
  }, [example.id]);

  // Escape closes the panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const related = resolveRelated(example);

  return (
    <div
      className="eg-detail-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="eg-detail-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="eg-detail">
        {/* ── Head ──────────────────────────────────────────────────────── */}
        <div className="eg-detail-head">
          <div className="eg-detail-head-body">
            <div className="eg-detail-idrow">
              <span className="eg-card-id">{example.id}</span>
              <span
                className="eg-card-diff"
                style={{ background: difficultyColor(example.difficulty) }}
              >
                {difficultyLabel(example.difficulty)}
              </span>
              <span className="eg-card-tag">{categoryLabel(example.category)}</span>
            </div>
            <h2 className="eg-detail-title" id="eg-detail-title">
              {example.title}
            </h2>
            <p className="eg-detail-short">{example.shortDescription}</p>
          </div>
          <button
            className="eg-detail-close"
            onClick={onClose}
            aria-label="Close example details"
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <div className="eg-detail-tabs" role="tablist">
          {(['overview', 'source', 'modify', 'related'] as TabKey[]).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              className={`eg-detail-tab ${tab === k ? 'is-active' : ''}`}
              onClick={() => setTab(k)}
              type="button"
            >
              {tabLabel(k, example)}
            </button>
          ))}
        </div>

        {/* ── Body ──────────────────────────────────────────────────────── */}
        <div className="eg-detail-body">
          {tab === 'overview' && (
            <OverviewTab example={example} />
          )}
          {tab === 'source' && (
            <SourceTab
              source={source}
              loading={loadingSource}
              error={sourceErr}
              path={example.sourcePath}
            />
          )}
          {tab === 'modify' && (
            <ModifyTab example={example} />
          )}
          {tab === 'related' && (
            <RelatedTab
              example={example}
              related={related}
              onSelect={onSelectRelated}
            />
          )}
        </div>

        {/* ── Foot (CTA) ────────────────────────────────────────────────── */}
        <div className="eg-detail-foot">
          <button
            type="button"
            className="eg-detail-cta eg-detail-cta-secondary"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="eg-detail-cta"
            onClick={() => onOpenInPlayground(example)}
          >
            Open in Playground <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab helpers ──────────────────────────────────────────────────────────────

function tabLabel(key: TabKey, ex: Example): string {
  switch (key) {
    case 'overview':
      return 'Overview';
    case 'source':
      return 'Source';
    case 'modify':
      return `Modify (${ex.whatToModify.length})`;
    case 'related':
      return `Related (${ex.relatedExamples.length})`;
  }
}

function OverviewTab({ example }: { example: Example }) {
  const paragraphs = example.longDescription.split(/\n\s*\n/);
  return (
    <>
      <div className="eg-detail-section">
        <div className="eg-detail-section-label">About</div>
        <div className="eg-detail-long">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>

      <div className="eg-detail-section">
        <div className="eg-detail-section-label">Quick facts</div>
        <div className="eg-detail-facts">
          <div className="eg-fact">
            <div className="eg-fact-label">Read time</div>
            <div className="eg-fact-value">{example.estimatedReadMinutes} minutes</div>
          </div>
          <div className="eg-fact">
            <div className="eg-fact-label">Difficulty</div>
            <div className="eg-fact-value">{example.difficulty}</div>
          </div>
          <div className="eg-fact">
            <div className="eg-fact-label">Category</div>
            <div className="eg-fact-value">{example.category}</div>
          </div>
          <div className="eg-fact">
            <div className="eg-fact-label">Deployable</div>
            <div className="eg-fact-value">{example.deployable ? 'Yes' : 'No'}</div>
          </div>
          {example.gasEstimate && (
            <div className="eg-fact">
              <div className="eg-fact-label">Gas estimate</div>
              <div className="eg-fact-value">{example.gasEstimate}</div>
            </div>
          )}
          <div className="eg-fact">
            <div className="eg-fact-label">Production</div>
            <div className="eg-fact-value">
              {example.usedInProduction ? 'In the wild' : 'Pedagogical'}
            </div>
          </div>
        </div>
      </div>

      {example.tags.length > 0 && (
        <div className="eg-detail-section">
          <div className="eg-detail-section-label">Tags</div>
          <div className="eg-detail-tags">
            {example.tags.map((tag) => (
              <span key={tag} className="eg-card-tag">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {example.prerequisites.length > 0 && (
        <div className="eg-detail-section">
          <div className="eg-detail-section-label">Prerequisites</div>
          <ul className="eg-detail-list">
            {example.prerequisites.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {example.tourLessons.length > 0 && (
        <div className="eg-detail-section">
          <div className="eg-detail-section-label">Tour lessons</div>
          <div className="eg-detail-tags">
            {example.tourLessons.map((l) => (
              <a
                key={l}
                href={`/tour/${l}`}
                className="eg-card-tag"
                style={{ color: 'var(--accent)', cursor: 'pointer' }}
              >
                {l}
              </a>
            ))}
          </div>
        </div>
      )}

      {example.docsLinks.length > 0 && (
        <div className="eg-detail-section">
          <div className="eg-detail-section-label">Docs</div>
          <div className="eg-detail-docs">
            {example.docsLinks.map((d) => (
              <a
                key={d.url}
                href={d.url}
                className="eg-detail-doc"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink size={13} /> {d.title}
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function SourceTab({
  source,
  loading,
  error,
  path,
}: {
  source: string | null;
  loading: boolean;
  error: string | null;
  path: string;
}) {
  return (
    <>
      <div className="eg-detail-section">
        <div className="eg-detail-section-label">
          Source &middot; <code>public/examples/{path}</code>
        </div>
        {loading && (
          <div className="eg-detail-source-loading">
            <Loader size={16} style={{ verticalAlign: -3, marginRight: 6 }} />
            Loading source…
          </div>
        )}
        {error && (
          <div className="eg-detail-source-loading" style={{ color: 'var(--danger)' }}>
            Failed to load: {error}
          </div>
        )}
        {source && !loading && (
          <pre className="eg-detail-source">
            <code>{source}</code>
          </pre>
        )}
      </div>
    </>
  );
}

function ModifyTab({ example }: { example: Example }) {
  return (
    <div className="eg-detail-section">
      <div className="eg-detail-section-label">What to modify</div>
      <p
        className="eg-detail-short"
        style={{ marginBottom: 14 }}
      >
        Open this example in the playground and try one of these modifications
        to deepen your understanding.
      </p>
      <ul className="eg-detail-list">
        {example.whatToModify.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  );
}

function RelatedTab({
  example,
  related,
  onSelect,
}: {
  example: Example;
  related: Example[];
  onSelect: (ex: Example) => void;
}) {
  if (related.length === 0) {
    return (
      <div className="eg-detail-section">
        <div className="eg-detail-section-label">Related examples</div>
        <p className="eg-detail-short">No related examples for {example.id} yet.</p>
      </div>
    );
  }
  return (
    <div className="eg-detail-section">
      <div className="eg-detail-section-label">Related examples</div>
      <div className="eg-detail-related">
        {related.map((r) => (
          <button
            key={r.id}
            type="button"
            className="eg-detail-related-item"
            onClick={() => onSelect(r)}
          >
            <span className="eg-detail-related-id">{r.id}</span>
            <span className="eg-detail-related-title">{r.title}</span>
            <ArrowRight size={14} color="var(--ink-faint)" />
          </button>
        ))}
      </div>
    </div>
  );
}
