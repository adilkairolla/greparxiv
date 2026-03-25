import { useState, useCallback, useEffect } from 'react';
import { SearchBar } from './components/SearchBar';
import { ResultsList } from './components/ResultsList';
import { ThemeToggle } from './components/ThemeToggle';
import { useSearch } from './hooks/useSearch';
import './styles/global.css';

function App() {
  const [query, setQuery] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('q') || '';
  });
  const [regex, setRegex] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('regex') === 'true';
  });

  const { results, loading, error, searchNow } = useSearch(query, regex);

  // Sync URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (regex) params.set('regex', 'true');
    const newURL = query ? `?${params}` : window.location.pathname;
    window.history.replaceState(null, '', newURL);
  }, [query, regex]);

  const handleQueryChange = useCallback((q: string) => setQuery(q), []);
  const handleRegexChange = useCallback((r: boolean) => setRegex(r), []);

  return (
    <div className="app">
      <header className="header">
        <a href="/" className="logo">grep<span className="logo-accent">arXiv</span></a>
        <ThemeToggle />
      </header>

      <main className="main">
        <SearchBar
          query={query}
          regex={regex}
          onQueryChange={handleQueryChange}
          onRegexChange={handleRegexChange}
          onSubmit={searchNow}
        />

        {loading && <div className="loading-bar" />}

        {error && (
          <div className="error-state">
            Search failed: {error}
          </div>
        )}

        {results && results.results.length === 0 && !loading && (
          <div className="empty-state">
            No results found for "{results.query}"
            <p className="empty-hint">Try a shorter query or disable regex mode</p>
          </div>
        )}

        {results && results.results.length > 0 && (
          <ResultsList data={results} />
        )}

        {!query && !results && (
          <div className="hero">
            <p className="hero-text">Search across 2,400+ arXiv papers from Feb 2026</p>
            <div className="hero-examples">
              <span>Try: </span>
              {['transformer', 'attention mechanism', 'O(n log n)', '\\nabla'].map((ex) => (
                <button
                  key={ex}
                  className="example-query"
                  onClick={() => setQuery(ex)}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        Searching {results?.stats.files_searched || '2,410'} papers from arXiv (Feb 2026)
      </footer>
    </div>
  );
}

export default App;
