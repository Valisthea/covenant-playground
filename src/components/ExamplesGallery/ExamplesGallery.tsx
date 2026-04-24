import { useMemo, useState } from 'react';
import { EXAMPLES, type Category } from '../../lib/examples';
import { useStore } from '../../lib/store';

interface Props {
  onClose: () => void;
}

const CATEGORY_LABELS: Record<Category | 'all', string> = {
  all: 'All',
  tokens: 'Tokens',
  auth: 'Auth',
  privacy: 'Privacy',
  upgrades: 'Upgrades',
  amnesia: 'Amnesia',
  integration: 'Integration',
};

export function ExamplesGallery({ onClose }: Props) {
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const loadExample = useStore((s) => s.loadExample);

  const visible = useMemo(() => {
    if (filter === 'all') return EXAMPLES;
    return EXAMPLES.filter((e) => e.category === filter);
  }, [filter]);

  const onPick = async (id: string) => {
    await loadExample(id);
    onClose();
  };

  return (
    <div
      className="gallery-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gallery-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="gallery-modal">
        <div className="gallery-header">
          <div>
            <div className="gallery-title" id="gallery-title">
              Examples
            </div>
            <div className="gallery-subtitle">
              15 curated contracts — from Hello Contract to the Amnesia ceremony.
            </div>
          </div>
          <button
            className="gallery-close"
            onClick={onClose}
            aria-label="Close examples gallery"
            type="button"
          >
            ×
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '0 24px 12px',
            flexWrap: 'wrap',
          }}
        >
          {(Object.keys(CATEGORY_LABELS) as (Category | 'all')[]).map((cat) => (
            <button
              key={cat}
              className="pg-btn"
              onClick={() => setFilter(cat)}
              style={
                filter === cat
                  ? {
                      borderColor: 'var(--accent)',
                      color: 'var(--accent)',
                      background: 'var(--accent-bg)',
                    }
                  : undefined
              }
              type="button"
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        <div className="gallery-grid">
          {visible.map((ex) => (
            <button
              key={ex.id}
              className="gallery-card"
              onClick={() => void onPick(ex.id)}
              type="button"
            >
              <div className="gallery-card-tag">{ex.category}</div>
              <div className="gallery-card-title">{ex.title}</div>
              <div className="gallery-card-desc">{ex.description}</div>
              <span className={`gallery-card-diff gallery-card-diff--${ex.difficulty}`}>
                {ex.difficulty}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
