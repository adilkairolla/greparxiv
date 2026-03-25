import { useRef, useEffect } from 'react';

interface Props {
  query: string;
  regex: boolean;
  onQueryChange: (q: string) => void;
  onRegexChange: (r: boolean) => void;
  onSubmit: () => void;
}

export function SearchBar({ query, regex, onQueryChange, onRegexChange, onSubmit }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        onQueryChange('');
        inputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onQueryChange]);

  return (
    <div className="search-bar">
      <div className="search-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder="Search arXiv papers..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit();
          }}
          spellCheck={false}
          autoComplete="off"
        />
      </div>
      <div className="search-options">
        <label className="regex-toggle">
          <input
            type="checkbox"
            checked={regex}
            onChange={(e) => onRegexChange(e.target.checked)}
          />
          <span className="regex-label">.*</span>
          <span>Regex</span>
        </label>
        <span className="search-hint">Press <kbd>/</kbd> to focus</span>
      </div>
    </div>
  );
}
