package web

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// A request for "/index.html" must never be answered with a redirect. A
// browser service worker precaches "index.html" and later reuses that
// response to satisfy a real page navigation to "/" — but browsers refuse
// to let a service worker answer a navigation with a *redirected* Response,
// so a 301 here (net/http's FileServer does this by default for any path
// ending in "/index.html") leaves that navigation hanging forever instead
// of failing loudly. See the fix in Handler for the full explanation.
func TestIndexHTMLIsNotRedirected(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/index.html", nil)
	rec := httptest.NewRecorder()
	Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("GET /index.html: expected 200, got %d (Location: %q)", rec.Code, rec.Header().Get("Location"))
	}
	if rec.Body.Len() == 0 {
		t.Fatal("GET /index.html: expected a non-empty body")
	}
}

func TestRootServesSameContentAsIndexHTML(t *testing.T) {
	root := httptest.NewRecorder()
	Handler().ServeHTTP(root, httptest.NewRequest(http.MethodGet, "/", nil))

	indexHTML := httptest.NewRecorder()
	Handler().ServeHTTP(indexHTML, httptest.NewRequest(http.MethodGet, "/index.html", nil))

	if root.Code != http.StatusOK || indexHTML.Code != http.StatusOK {
		t.Fatalf("expected both to be 200, got / = %d, /index.html = %d", root.Code, indexHTML.Code)
	}
	if root.Body.String() != indexHTML.Body.String() {
		t.Fatal("expected / and /index.html to serve identical content")
	}
}

// An unknown client-side route (e.g. a SPA route like /n/some-id) must fall
// back to index.html rather than 404ing, and without a redirect either.
func TestUnknownRouteFallsBackToIndexWithoutRedirect(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/n/some-note-id", nil)
	rec := httptest.NewRecorder()
	Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}
