import type { LineMatch } from '../types'

interface Props {
  match: LineMatch
}

export function MatchLine({ match }: Props) {
  return (
    <div className="border-t border-border/50 first:border-t-0">
      {/* Context before */}
      {match.before.map((line, i) => (
        <div key={`b${i}`} className="flex font-mono text-xs leading-relaxed text-muted-foreground/40">
          <span className="w-12 shrink-0 text-right pr-2 select-none tabular-nums">
            {match.line_number - match.before.length + i}
          </span>
          <span className="w-4 shrink-0 text-center select-none text-border">|</span>
          <span className="flex-1 px-2 whitespace-pre overflow-x-auto">{line}</span>
        </div>
      ))}

      {/* Match line */}
      <div className="flex font-mono text-xs leading-relaxed bg-amber/[0.03]">
        <span className="w-12 shrink-0 text-right pr-2 select-none tabular-nums text-amber/60">
          {match.line_number}
        </span>
        <span className="w-4 shrink-0 text-center select-none text-amber/30">|</span>
        <span className="flex-1 px-2 whitespace-pre overflow-x-auto">
          {match.fragments.map((frag, i) => (
            <span key={i}>
              {frag.pre}
              <mark>{frag.match}</mark>
              {frag.post}
            </span>
          ))}
        </span>
      </div>

      {/* Context after */}
      {match.after.map((line, i) => (
        <div key={`a${i}`} className="flex font-mono text-xs leading-relaxed text-muted-foreground/40">
          <span className="w-12 shrink-0 text-right pr-2 select-none tabular-nums">
            {match.line_number + 1 + i}
          </span>
          <span className="w-4 shrink-0 text-center select-none text-border">|</span>
          <span className="flex-1 px-2 whitespace-pre overflow-x-auto">{line}</span>
        </div>
      ))}
    </div>
  )
}
