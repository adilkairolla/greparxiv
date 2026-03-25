import { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, Regex } from 'lucide-react'

interface Props {
  query: string
  regex: boolean
  onQueryChange: (q: string) => void
  onRegexChange: (r: boolean) => void
  onSubmit: () => void
}

export function SearchBar({ query, regex, onQueryChange, onRegexChange, onSubmit }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        onQueryChange('')
        inputRef.current?.blur()
      }
    }

    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onQueryChange])

  return (
    <motion.div
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.1 }}
    >
      <div className="search-glow rounded-xl border border-border bg-card transition-all">
        <div className="flex items-center">
          <div className="pl-4 text-muted-foreground">
            <Search className="w-5 h-5" />
          </div>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 h-12 sm:h-14 px-3 bg-transparent text-base sm:text-lg font-mono placeholder:text-muted-foreground/40 focus:outline-none"
            placeholder="Search papers..."
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSubmit() }}
            spellCheck={false}
            autoComplete="off"
          />
          <div className="flex items-center gap-2 pr-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onRegexChange(!regex)}
              className={`p-1.5 rounded-md text-xs font-mono transition-all cursor-pointer ${
                regex
                  ? 'bg-amber/15 text-amber border border-amber/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent'
              }`}
              title="Toggle regex"
            >
              <Regex className="w-4 h-4" />
            </motion.button>
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/50 border border-border rounded">
              /
            </kbd>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
