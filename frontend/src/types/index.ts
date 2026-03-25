export interface SearchResponse {
  query: string;
  total_matches: number;
  total_files: number;
  duration_ms: number;
  results: PaperResult[];
  stats: SearchStats;
}

export interface PaperResult {
  paper_id: string;
  title: string;
  authors: string[];
  categories: string[];
  arxiv_url: string;
  pdf_url: string;
  matches: LineMatch[];
}

export interface LineMatch {
  line_number: number;
  line: string;
  before: string[];
  after: string[];
  fragments: Fragment[];
}

export interface Fragment {
  pre: string;
  match: string;
  post: string;
}

export interface SearchStats {
  duration_ms: number;
  files_searched: number;
}
