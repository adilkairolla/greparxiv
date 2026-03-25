import type { LineMatch } from '../types';

interface Props {
  match: LineMatch;
}

export function MatchLine({ match }: Props) {
  return (
    <div className="match-group">
      {match.before.map((line, i) => (
        <div key={`b${i}`} className="context-line">
          <span className="line-number">{match.line_number - match.before.length + i}</span>
          <span className="line-sep">│</span>
          <span className="line-text dimmed">{line}</span>
        </div>
      ))}
      <div className="match-line">
        <span className="line-number">{match.line_number}</span>
        <span className="line-sep">│</span>
        <span className="line-text">
          {match.fragments.map((frag, i) => (
            <span key={i}>
              {frag.pre}
              <mark>{frag.match}</mark>
              {frag.post}
            </span>
          ))}
        </span>
      </div>
      {match.after.map((line, i) => (
        <div key={`a${i}`} className="context-line">
          <span className="line-number">{match.line_number + 1 + i}</span>
          <span className="line-sep">│</span>
          <span className="line-text dimmed">{line}</span>
        </div>
      ))}
    </div>
  );
}
