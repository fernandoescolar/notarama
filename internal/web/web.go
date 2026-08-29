// Package web embeds and serves the built frontend (Vite's dist/ output) so
// Notarama's Go binary is entirely self-contained — no separate static file
// server (nginx or otherwise) is needed in front of it.
package web

import (
	"embed"
	"io"
	"io/fs"
	"net/http"
	"time"
)

//go:embed all:dist
var distFS embed.FS

// Handler serves the SPA: real files are served as-is, and any path that
// doesn't match a file (client-side routes, and "/" itself) falls back to
// index.html.
func Handler() http.Handler {
	sub, err := fs.Sub(distFS, "dist")
	if err != nil {
		panic(err)
	}
	fileServer := http.FileServer(http.FS(sub))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		clean := cleanPath(r.URL.Path)
		// index.html is served directly (not via fileServer) so that a
		// request literally for "/index.html" — which the PWA service
		// worker's precaching makes on its own — never hits
		// net/http's built-in redirect of "*/index.html" -> "/".
		// A service worker is forbidden from answering a *navigation*
		// request with a redirected Response, and the request that
		// triggers this here always is one (it's how the browser loads
		// "/" after the OIDC callback redirects back to it) — so that
		// redirect made the root request hang forever instead of
		// erroring, since the browser silently rejects the response
		// without settling the fetch.
		if clean == "index.html" {
			serveIndex(w, r, sub)
			return
		}
		if _, err := fs.Stat(sub, clean); err != nil {
			serveIndex(w, r, sub)
			return
		}
		fileServer.ServeHTTP(w, r)
	})
}

func serveIndex(w http.ResponseWriter, r *http.Request, sub fs.FS) {
	f, err := sub.Open("index.html")
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()

	rs, ok := f.(io.ReadSeeker)
	if !ok {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	modTime := time.Time{}
	if stat, err := f.Stat(); err == nil {
		modTime = stat.ModTime()
	}
	http.ServeContent(w, r, "index.html", modTime, rs)
}

func cleanPath(p string) string {
	if p == "" || p == "/" {
		return "index.html"
	}
	if p[0] == '/' {
		p = p[1:]
	}
	return p
}
