import { useState } from 'react';
import type { PaperResult } from '../types';
import { MatchLine } from './MatchLine';

interface Props {
  result: PaperResult;
}

const MAX_VISIBLE = 3;

export function ResultItem({ result }: Props) {
  const [expanded, setExpanded] = useState(false);
  const visibleMatches = expanded ? result.matches : result.matches.slice(0, MAX_VISIBLE);
  const hiddenCount = result.matches.length - MAX_VISIBLE;

  const authors = result.authors.length > 3
    ? [...result.authors.slice(0, 3), `+${result.authors.length - 3} more`].join(', ')
    : result.authors.join(', ');

  return (
    <div className="result-item">
      <div className="result-header">
        <a href={result.arxiv_url} target="_blank" rel="noopener noreferrer" className="paper-title">
          {result.title || result.paper_id}
        </a>
        <div className="paper-meta">
          {authors && <span className="authors">{authors}</span>}
          {result.categories.length > 0 && (
            <span className="categories">
              {result.categories.slice(0, 3).map((cat) => (
                <span key={cat} className="category-tag">{cat}</span>
              ))}
            </span>
          )}
          <a href={result.pdf_url} target="_blank" rel="noopener noreferrer" className="pdf-link">
            PDF
          </a>
        </div>
      </div>
      <div className="result-matches">
        {visibleMatches.map((match, i) => (
          <MatchLine key={i} match={match} />
        ))}
        {!expanded && hiddenCount > 0 && (
          <button className="show-more" onClick={() => setExpanded(true)}>
            Show {hiddenCount} more match{hiddenCount > 1 ? 'es' : ''} in this paper
          </button>
        )}
      </div>
    </div>
  );
}
