import { Clock, CheckCircle } from 'lucide-react';
import type { Example } from '../../examples/types';
import { difficultyColor, difficultyLabel } from '../../examples/types';

interface Props {
  example: Example;
  onClick: () => void;
}

export function ExampleCard({ example, onClick }: Props) {
  return (
    <button type="button" className="eg-card" onClick={onClick}>
      <div className="eg-card-head">
        <span className="eg-card-id">{example.id}</span>
        <span
          className="eg-card-diff"
          style={{ background: difficultyColor(example.difficulty) }}
        >
          {difficultyLabel(example.difficulty)}
        </span>
      </div>

      <h3 className="eg-card-title">{example.title}</h3>
      <p className="eg-card-desc">{example.shortDescription}</p>

      {example.tags.length > 0 && (
        <div className="eg-card-tags">
          {example.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="eg-card-tag">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="eg-card-meta">
        <span className="eg-card-meta-left">
          <Clock size={11} /> {example.estimatedReadMinutes} min
        </span>
        {example.usedInProduction && (
          <span className="eg-card-prod" title="Used in production">
            <CheckCircle size={11} style={{ verticalAlign: -1 }} /> production
          </span>
        )}
      </div>
    </button>
  );
}
