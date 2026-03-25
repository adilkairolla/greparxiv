package metadata

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
)

type PaperMetadata struct {
	PaperID         string   `json:"paper_id"`
	Title           string   `json:"title"`
	Authors         []string `json:"authors"`
	Abstract        string   `json:"abstract"`
	Categories      []string `json:"categories"`
	PrimaryCategory string   `json:"primary_category"`
	Published       string   `json:"published"`
	Updated         string   `json:"updated"`
	ArxivURL        string   `json:"arxiv_url"`
	PDFURL          string   `json:"pdf_url"`
}

type Store struct {
	papers map[string]*PaperMetadata
}

func NewStore(dir string) (*Store, error) {
	s := &Store{
		papers: make(map[string]*PaperMetadata),
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("reading metadata dir: %w", err)
	}

	loaded := 0
	for _, entry := range entries {
		if !entry.IsDir() || !strings.HasPrefix(entry.Name(), "2602.") {
			continue
		}

		metaPath := filepath.Join(dir, entry.Name(), "metadata.json")
		data, err := os.ReadFile(metaPath)
		if err != nil {
			// Paper without metadata — create minimal entry
			paperID := entry.Name()
			s.papers[paperID] = &PaperMetadata{
				PaperID:  paperID,
				ArxivURL: "https://arxiv.org/abs/" + paperID,
				PDFURL:   "https://arxiv.org/pdf/" + paperID,
			}
			continue
		}

		var meta PaperMetadata
		if err := json.Unmarshal(data, &meta); err != nil {
			slog.Warn("invalid metadata JSON", "paper", entry.Name(), "error", err)
			continue
		}

		s.papers[meta.PaperID] = &meta
		loaded++
	}

	slog.Info("metadata store initialized",
		"total_papers", len(s.papers),
		"with_metadata", loaded,
	)

	return s, nil
}

func (s *Store) Get(paperID string) *PaperMetadata {
	return s.papers[paperID]
}

func (s *Store) Count() int {
	return len(s.papers)
}
