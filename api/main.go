package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/sourcegraph/zoekt"
	"github.com/sourcegraph/zoekt/query"
	"github.com/sourcegraph/zoekt/search"

	"greparxiv/handlers"
	"greparxiv/metadata"
	"greparxiv/middleware"
)

func main() {
	indexDir := envOr("ZOEKT_INDEX_DIR", "../data/zoekt-index")
	metadataDir := envOr("METADATA_DIR", "../data/extracted")
	port := envOr("PORT", "8080")
	corsOrigins := envOr("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")

	slog.Info("starting greparxiv API",
		"index_dir", indexDir,
		"metadata_dir", metadataDir,
		"port", port,
	)

	// Load Zoekt index directly — no separate webserver needed
	slog.Info("loading zoekt index...")
	searcher, err := search.NewDirectorySearcher(indexDir)
	if err != nil {
		slog.Error("failed to load zoekt index", "error", err)
		os.Exit(1)
	}
	defer searcher.Close()
	slog.Info("zoekt index loaded")

	// Pre-warm: run a dummy search to page index into memory
	warmQ := &query.Substring{Pattern: "the", Content: true}
	warmOpts := &zoekt.SearchOptions{MaxDocDisplayCount: 1}
	warmOpts.SetDefaults()
	searcher.Search(context.Background(), warmQ, warmOpts)
	slog.Info("index pre-warmed")

	// Load metadata
	store, err := metadata.NewStore(metadataDir)
	if err != nil {
		slog.Error("failed to load metadata", "error", err)
		os.Exit(1)
	}
	slog.Info("metadata loaded", "papers", store.Count())

	// Build router
	r := chi.NewRouter()

	r.Use(chimw.RealIP)
	r.Use(middleware.RequestLogger)
	r.Use(chimw.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   splitComma(corsOrigins),
		AllowedMethods:   []string{"GET", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type"},
		AllowCredentials: false,
		MaxAge:           3600,
	}))
	r.Use(middleware.RateLimit(60, time.Minute))

	// Handlers — searcher is embedded, no HTTP proxy
	searchHandler := handlers.NewSearchHandler(searcher, store)
	paperHandler := handlers.NewPaperHandler(store, metadataDir)
	healthHandler := handlers.NewHealthHandler(store)

	r.Get("/api/search", searchHandler.Search)
	r.Get("/api/paper/{id}", paperHandler.GetPaper)
	r.Get("/healthz", healthHandler.Health)

	slog.Info("listening", "port", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		slog.Error("server error", "error", err)
		os.Exit(1)
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func splitComma(s string) []string {
	var result []string
	start := 0
	for i := 0; i <= len(s); i++ {
		if i == len(s) || s[i] == ',' {
			part := s[start:i]
			if len(part) > 0 {
				result = append(result, part)
			}
			start = i + 1
		}
	}
	return result
}
