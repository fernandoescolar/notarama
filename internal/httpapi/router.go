package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"notarama/internal/web"
)

func NewRouter(api *API) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	r.Get("/auth/login", api.Auth.LoginHandler)
	r.Get("/auth/callback", api.Auth.CallbackHandler)
	r.Post("/auth/logout", api.Auth.LogoutHandler)

	r.Route("/api", func(r chi.Router) {
		r.Use(api.Auth.RequireAuth)

		r.Get("/me", api.handleMe)
		r.Get("/tree", api.handleTree)

		r.Post("/nodes", api.handleCreateNode)
		r.Patch("/nodes/{id}", api.handlePatchNode)
		r.Delete("/nodes/{id}", api.handleDeleteNode)

		r.Get("/notes/{id}", api.handleGetNoteContent)
		r.Put("/notes/{id}/content", api.handlePutNoteContent)
		r.Get("/notes/{id}/backlinks", api.handleGetBacklinks)

		r.Get("/trash", api.handleListTrash)
		r.Post("/trash/{id}/restore", api.handleRestoreNode)
		r.Delete("/trash/{id}", api.handlePermanentlyDeleteNode)
		r.Delete("/trash", api.handleEmptyTrash)

		r.Get("/search", api.handleSearch)

		r.Post("/uploads", api.handleUpload)
		r.Get("/uploads/{id}", api.handleGetUpload)

		r.Get("/sync", api.handleSyncPull)
		r.Post("/sync", api.handleSyncPush)
	})

	r.NotFound(web.Handler().ServeHTTP)

	return r
}
