package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"regexp/syntax"
	"strconv"
	"strings"
	"time"

	"github.com/sourcegraph/zoekt"
	"github.com/sourcegraph/zoekt/query"

	"greparxiv/metadata"
)

type SearchHandler struct {
	searcher zoekt.Searcher
	store    *metadata.Store
}

func NewSearchHandler(searcher zoekt.Searcher, store *metadata.Store) *SearchHandler {
	return &SearchHandler{
		searcher: searcher,
		store:    store,
	}
}

// API response types
type SearchResponse struct {
	Query        string        `json:"query"`
	TotalMatches int           `json:"total_matches"`
	TotalFiles   int           `json:"total_files"`
	DurationMS   int64         `json:"duration_ms"`
	Results      []PaperResult `json:"results"`
	Stats        SearchStats   `json:"stats"`
}

type PaperResult struct {
	PaperID    string      `json:"paper_id"`
	Title      string      `json:"title"`
	Authors    []string    `json:"authors"`
	Categories []string    `json:"categories"`
	ArxivURL   string      `json:"arxiv_url"`
	PDFURL     string      `json:"pdf_url"`
	Matches    []LineMatch `json:"matches"`
}

type LineMatch struct {
	LineNumber int        `json:"line_number"`
	Line       string     `json:"line"`
	Before     []string   `json:"before"`
	After      []string   `json:"after"`
	Fragments  []Fragment `json:"fragments"`
}

type Fragment struct {
	Pre   string `json:"pre"`
	Match string `json:"match"`
	Post  string `json:"post"`
}

type SearchStats struct {
	DurationMS    int64 `json:"duration_ms"`
	FilesSearched int   `json:"files_searched"`
}

func (h *SearchHandler) Search(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	qStr := r.URL.Query().Get("q")
	if qStr == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "query parameter 'q' is required"})
		return
	}

	perPage := intParam(r, "per_page", 20, 1, 100)
	ctxLines := intParam(r, "ctx", 2, 0, 10)
	isRegex := r.URL.Query().Get("regex") == "true"

	// Build Zoekt query directly
	var q query.Q
	if isRegex {
		re, err := syntax.Parse(qStr, syntax.Perl)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid regex: " + err.Error()})
			return
		}
		q = &query.Regexp{Regexp: re, Content: true}
	} else {
		q = &query.Substring{Pattern: qStr, Content: true}
	}

	// Search options
	opts := &zoekt.SearchOptions{
		MaxDocDisplayCount:   perPage,
		MaxMatchDisplayCount: perPage * 10,
		NumContextLines:      ctxLines,
		MaxWallTime:          5 * time.Second,
	}
	opts.SetDefaults()

	// Execute search directly — no HTTP proxy
	ctx := context.Background()
	result, err := h.searcher.Search(ctx, q, opts)
	if err != nil {
		slog.Error("search failed", "error", err, "query", qStr)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "search failed"})
		return
	}

	// Transform results
	results := make([]PaperResult, 0, len(result.Files))
	totalMatches := 0

	for _, fm := range result.Files {
		paperID := strings.TrimSuffix(fm.FileName, ".txt")
		meta := h.store.Get(paperID)

		pr := PaperResult{
			PaperID:  paperID,
			ArxivURL: fmt.Sprintf("https://arxiv.org/abs/%s", paperID),
			PDFURL:   fmt.Sprintf("https://arxiv.org/pdf/%s", paperID),
		}

		if meta != nil {
			pr.Title = meta.Title
			pr.Authors = meta.Authors
			pr.Categories = meta.Categories
		}
		if pr.Authors == nil {
			pr.Authors = []string{}
		}
		if pr.Categories == nil {
			pr.Categories = []string{}
		}

		matches := make([]LineMatch, 0, len(fm.LineMatches))
		for _, lm := range fm.LineMatches {
			line := strings.TrimRight(string(lm.Line), "\n")

			// Build fragments from LineFragmentMatch
			var frags []Fragment
			pos := 0
			lineStart := int(lm.LineStart)
			for _, lf := range lm.LineFragments {
				// lf.Offset is file-level; convert to line-relative
				offset := int(lf.Offset) - lineStart
				matchLen := lf.MatchLength
				if offset < 0 || offset > len(lm.Line) {
					continue
				}
				end := offset + matchLen
				if end > len(lm.Line) {
					end = len(lm.Line)
				}
				frag := Fragment{
					Pre:   string(lm.Line[pos:offset]),
					Match: string(lm.Line[offset:end]),
				}
				pos = end
				frags = append(frags, frag)
			}
			// Trailing text goes into Post of last fragment
			if len(frags) > 0 && pos < len(lm.Line) {
				frags[len(frags)-1].Post = strings.TrimRight(string(lm.Line[pos:]), "\n")
			}
			if len(frags) == 0 {
				frags = []Fragment{{Pre: line}}
			}

			// Context lines
			var before, after []string
			if len(lm.Before) > 0 {
				before = splitLines(string(lm.Before))
			}
			if len(lm.After) > 0 {
				after = splitLines(string(lm.After))
			}

			match := LineMatch{
				LineNumber: lm.LineNumber + 1,
				Line:       line,
				Before:     nonNil(before),
				After:      nonNil(after),
				Fragments:  frags,
			}

			matches = append(matches, match)
			totalMatches++
		}
		pr.Matches = matches
		results = append(results, pr)
	}

	duration := time.Since(start).Milliseconds()

	response := SearchResponse{
		Query:        qStr,
		TotalMatches: totalMatches,
		TotalFiles:   len(results),
		DurationMS:   duration,
		Results:      results,
		Stats: SearchStats{
			DurationMS:    duration,
			FilesSearched: h.store.Count(),
		},
	}

	writeJSON(w, http.StatusOK, response)
}

func splitLines(s string) []string {
	s = strings.TrimRight(s, "\n")
	if s == "" {
		return []string{}
	}
	return strings.Split(s, "\n")
}

func intParam(r *http.Request, name string, def, minVal, maxVal int) int {
	s := r.URL.Query().Get(name)
	if s == "" {
		return def
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	if v < minVal {
		return minVal
	}
	if v > maxVal {
		return maxVal
	}
	return v
}

func nonNil(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	data, err := json.Marshal(v)
	if err != nil {
		http.Error(w, `{"error":"json encoding failed"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Length", strconv.Itoa(len(data)))
	w.WriteHeader(status)
	w.Write(data)
}
