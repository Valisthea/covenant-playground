import type { ExampleCategory } from '../../examples/types';
import { categoryLabel } from '../../examples/types';

type TabKey = 'all' | ExampleCategory;

const CATEGORIES: TabKey[] = ['all', 'basics', 'defi', 'privacy', 'governance', 'advanced', 'v09-new'];

interface Props {
  active: TabKey;
  counts: Record<TabKey, number>;
  onChange: (cat: TabKey) => void;
}

export function CategoryTabs({ active, counts, onChange }: Props) {
  return (
    <div className="eg-tabs" role="tablist" aria-label="Example categories">
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          role="tab"
          aria-selected={active === cat}
          className={`eg-tab ${active === cat ? 'is-active' : ''}`}
          onClick={() => onChange(cat)}
          type="button"
        >
          <span>{cat === 'all' ? 'All' : categoryLabel(cat)}</span>
          <span className="eg-tab-count">{counts[cat]}</span>
        </button>
      ))}
    </div>
  );
}

export type { TabKey };
