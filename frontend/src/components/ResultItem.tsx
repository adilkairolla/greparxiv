import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { PaperResult } from '../types'
import { MatchLine } from './MatchLine'
import { Badge } from './ui/badge'
import { ExternalLink, FileText, ChevronDown } from 'lucide-react'

interface Props {
  result: PaperResult
}

const MAX_VISIBLE = 3

const CATEGORY_COLORS: Record<string, string> = {
  'cs': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'math': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'physics': 'bg-green-500/10 text-green-400 border-green-500/20',
  'stat': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'eess': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  'q-bio': 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  'q-fin': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'astro': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  'cond': 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  'hep': 'bg-red-500/10 text-red-400 border-red-500/20',
}

function getCategoryColor(cat: string): string {
  const prefix = cat.split('.')[0].split('-')[0]
  return CATEGORY_COLORS[prefix] || 'bg-muted text-muted-foreground border-border'
}

export function ResultItem({ result }: Props) {
  const [expanded, setExpanded] = useState(false)
  const visibleMatches = expanded ? result.matches : result.matches.slice(0, MAX_VISIBLE)
  const hiddenCount = result.matches.length - MAX_VISIBLE

  const authors = result.authors.length > 3
    ? [...result.authors.slice(0, 3), `+${result.authors.length - 3} more`].join(', ')
    : result.authors.join(', ')

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden hover:border-border/80 transition-colors group">
      {/* Paper header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <a
            href={result.arxiv_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium leading-snug hover:text-amber transition-colors flex items-start gap-1.5 group/link"
          >
            <span>{result.title || result.paper_id}</span>
            <ExternalLink className="w-3 h-3 mt-0.5 shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity text-amber" />
          </a>
          <a
            href={result.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono text-muted-foreground hover:text-amber border border-border rounded-md transition-colors"
          >
            <FileText className="w-3 h-3" />
            PDF
          </a>
        </div>

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {authors && (
            <span className="text-xs text-muted-foreground truncate max-w-xs">{authors}</span>
          )}
          {result.categories.length > 0 && (
            <div className="flex gap-1">
              {result.categories.slice(0, 3).map((cat) => (
                <Badge
                  key={cat}
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 h-4 font-mono border ${getCategoryColor(cat)}`}
                >
                  {cat}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Match lines */}
      <div className="border-t border-border bg-background/50">
        {visibleMatches.map((match, i) => (
          <MatchLine key={i} match={match} />
        ))}

        <AnimatePresence>
          {!expanded && hiddenCount > 0 && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, height: 0 }}
              onClick={() => setExpanded(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-amber border-t border-border transition-colors cursor-pointer"
            >
              <ChevronDown className="w-3 h-3" />
              {hiddenCount} more match{hiddenCount > 1 ? 'es' : ''}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
