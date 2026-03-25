import { motion } from 'framer-motion'
import type { SearchResponse } from '../types'
import { ResultItem } from './ResultItem'
import { FileText, Zap, Clock } from 'lucide-react'

interface Props {
  data: SearchResponse
}

export function ResultsList({ data }: Props) {
  return (
    <div className="mt-4">
      {/* Stats bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="flex items-center gap-4 py-3 text-xs text-muted-foreground font-mono border-b border-border/50"
      >
        <span className="flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" />
          {data.total_files} files
        </span>
        <span className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5" />
          {data.total_matches} matches
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {data.duration_ms}ms
        </span>
      </motion.div>

      {/* Results */}
      <div className="mt-4 space-y-4">
        {data.results.map((result, i) => (
          <motion.div
            key={result.paper_id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.03, duration: 0.3 }}
          >
            <ResultItem result={result} />
          </motion.div>
        ))}
      </div>
    </div>
  )
}
