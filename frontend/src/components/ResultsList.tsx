import type { SearchResponse } from '../types';
import { ResultItem } from './ResultItem';

interface Props {
  data: SearchResponse;
}

export function ResultsList({ data }: Props) {
  return (
    <div className="results-list">
      <div className="search-stats">
        {data.total_files} files &middot; {data.total_matches} matches &middot; {data.duration_ms}ms
      </div>
      {data.results.map((result) => (
        <ResultItem key={result.paper_id} result={result} />
      ))}
    </div>
  );
}
