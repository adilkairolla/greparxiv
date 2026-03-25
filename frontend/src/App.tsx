import { useState, useCallback, useEffect, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SearchBar } from './components/SearchBar'
import { ResultsList } from './components/ResultsList'
import { ThemeToggle } from './components/ThemeToggle'
import { useSearch } from './hooks/useSearch'
import { Terminal, ExternalLink } from 'lucide-react'

function App() {
  const [query, setQuery] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('q') || ''
  })
  const [regex, setRegex] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('regex') === 'true'
  })

  const { results, loading, error, searchNow } = useSearch(query, regex)
  const [paperCount, setPaperCount] = useState<number | null>(null)

  useEffect(() => {
    fetch('/healthz').then(r => r.json()).then(d => setPaperCount(d.papers_indexed)).catch(() => {})
  }, [])

  const paperLabel = useMemo(() => {
    const count = results?.stats.files_searched || paperCount
    if (!count) return 'arXiv papers'
    return `${count.toLocaleString()} papers`
  }, [results, paperCount])

  useEffect(() => {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (regex) params.set('regex', 'true')
    const newURL = query ? `?${params}` : window.location.pathname
    window.history.replaceState(null, '', newURL)
  }, [query, regex])

  const handleQueryChange = useCallback((q: string) => setQuery(q), [])
  const handleRegexChange = useCallback((r: boolean) => setRegex(r), [])

  const examples = ['transformer', 'attention mechanism', 'O(n log n)', '\\nabla', 'reinforcement learning']

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Dot grid background */}
      <div className="fixed inset-0 dot-grid opacity-30 dark:opacity-[0.04] pointer-events-none" />
      <div className="fixed inset-0 bg-gradient-to-b from-transparent via-transparent to-background pointer-events-none" />

      {/* Loading bar */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed top-0 left-0 right-0 h-0.5 z-50 bg-muted overflow-hidden"
          >
            <div className="h-full w-1/3 bg-amber loading-bar-sweep" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 border-b border-border/50"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 group">
            <Terminal className="w-5 h-5 text-amber" />
            <span className="font-mono text-lg font-medium tracking-tight">
              grep<span className="text-amber">arXiv</span>
            </span>
          </a>
          <div className="flex items-center gap-3">
            <a
              href="https://arxiv.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              arXiv.org <ExternalLink className="w-3 h-3" />
            </a>
            <ThemeToggle />
          </div>
        </div>
      </motion.header>

      {/* Main */}
      <main className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-6 pb-12">
        <SearchBar
          query={query}
          regex={regex}
          onQueryChange={handleQueryChange}
          onRegexChange={handleRegexChange}
          onSubmit={searchNow}
        />

        {/* Error */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive"
            >
              Search failed: {error}
            </motion.div>
          )}

          {/* No results */}
          {results && results.results.length === 0 && !loading && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-16 text-center"
            >
              <p className="text-lg text-muted-foreground">No results for "{results.query}"</p>
              <p className="text-sm text-muted-foreground/60 mt-2">Try a shorter query or disable regex</p>
            </motion.div>
          )}

          {/* Results */}
          {results && results.results.length > 0 && (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ResultsList data={results} />
            </motion.div>
          )}

          {/* Hero */}
          {!query && !results && (
            <motion.div
              key="hero"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="mt-20 sm:mt-32 text-center"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber/20 bg-amber/5 text-amber text-xs font-mono mb-6"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" />
                Searching {paperLabel}
              </motion.div>

              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
                Search across <span className="text-amber">arXiv</span> papers
              </h1>
              <p className="text-muted-foreground max-w-md mx-auto mb-10">
                Grep through thousands of research papers. Find equations, theorems, and ideas instantly.
              </p>

              <div className="flex flex-wrap justify-center gap-2">
                {examples.map((ex, i) => (
                  <motion.button
                    key={ex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setQuery(ex)}
                    className="px-3 py-1.5 text-sm font-mono rounded-md border border-border bg-card hover:bg-accent hover:border-amber/30 transition-colors cursor-pointer"
                  >
                    {ex}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 py-4">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-mono">
            grep<span className="text-amber">arXiv</span>
          </span>
          <span>Indexing {paperLabel} from arXiv</span>
        </div>
      </footer>
    </div>
  )
}

export default App
