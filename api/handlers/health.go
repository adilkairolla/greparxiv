package handlers

import (
	"net/http"

	"greparxiv/metadata"
)

type HealthHandler struct {
	store *metadata.Store
}

func NewHealthHandler(store *metadata.Store) *HealthHandler {
	return &HealthHandler{store: store}
}

func (h *HealthHandler) Health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status":         "ok",
		"papers_indexed": h.store.Count(),
	})
}
