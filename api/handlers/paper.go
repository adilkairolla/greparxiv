package handlers

import (
	"net/http"
	"os"
	"path/filepath"

	"github.com/go-chi/chi/v5"

	"greparxiv/metadata"
)

type PaperHandler struct {
	store       *metadata.Store
	extractedDir string
}

func NewPaperHandler(store *metadata.Store, extractedDir string) *PaperHandler {
	return &PaperHandler{
		store:       store,
		extractedDir: extractedDir,
	}
}

type PaperResponse struct {
	PaperID         string   `json:"paper_id"`
	Title           string   `json:"title"`
	Authors         []string `json:"authors"`
	Abstract        string   `json:"abstract"`
	Categories      []string `json:"categories"`
	PrimaryCategory string   `json:"primary_category"`
	ArxivURL        string   `json:"arxiv_url"`
	PDFURL          string   `json:"pdf_url"`
	Text            string   `json:"text"`
}

func (h *PaperHandler) GetPaper(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "paper ID required"})
		return
	}

	meta := h.store.Get(id)
	if meta == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "paper not found"})
		return
	}

	// Read paper text on demand
	textPath := filepath.Join(h.extractedDir, id, "paper.txt")
	textBytes, err := os.ReadFile(textPath)
	text := ""
	if err == nil {
		text = string(textBytes)
	}

	resp := PaperResponse{
		PaperID:         meta.PaperID,
		Title:           meta.Title,
		Authors:         nonNilSlice(meta.Authors),
		Abstract:        meta.Abstract,
		Categories:      nonNilSlice(meta.Categories),
		PrimaryCategory: meta.PrimaryCategory,
		ArxivURL:        meta.ArxivURL,
		PDFURL:          meta.PDFURL,
		Text:            text,
	}

	writeJSON(w, http.StatusOK, resp)
}

func nonNilSlice(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}
