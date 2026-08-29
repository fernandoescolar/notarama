package main

import (
	"context"
	"log"
	"net/http"

	"notarama/internal/auth"
	"notarama/internal/config"
	"notarama/internal/db"
	"notarama/internal/httpapi"
	"notarama/internal/notes"
	"notarama/internal/search"
	"notarama/internal/sync"
	"notarama/internal/uploads"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	database, err := db.Open(cfg.DataDir)
	if err != nil {
		log.Fatalf("open database: %v", err)
	}
	defer database.Close()

	authStore := auth.NewStore(database.Conn())
	authService, err := auth.New(context.Background(), authStore,
		cfg.OIDCIssuerURL, cfg.OIDCClientID, cfg.OIDCClientSecret, cfg.OIDCRedirectURL,
		cfg.DevAuthBypass)
	if err != nil {
		log.Fatalf("auth: %v", err)
	}

	uploadsStore, err := uploads.NewStore(database.Conn(), cfg.DataDir)
	if err != nil {
		log.Fatalf("uploads: %v", err)
	}

	api := &httpapi.API{
		Auth:    authService,
		Notes:   notes.NewStore(database.Conn()),
		Search:  search.NewSearcher(database.Conn()),
		Uploads: uploadsStore,
		Sync:    sync.NewSyncer(database.Conn()),
	}

	if cfg.DevAuthBypass {
		log.Println("WARNING: DEV_AUTH_BYPASS is enabled — every visitor is logged in as a fixed local user. Do not use in production.")
	}

	log.Printf("notarama listening on %s", cfg.ListenAddr)
	if err := http.ListenAndServe(cfg.ListenAddr, httpapi.NewRouter(api)); err != nil {
		log.Fatal(err)
	}
}
