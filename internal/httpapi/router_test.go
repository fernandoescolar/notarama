package httpapi_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"notarama/internal/auth"
	notaramadb "notarama/internal/db"
	"notarama/internal/httpapi"
	"notarama/internal/notes"
	"notarama/internal/search"
	"notarama/internal/sync"
	"notarama/internal/uploads"
)

// setup wires a full router backed by a fresh temp SQLite database, using
// dev-auth-bypass so tests don't need a real OIDC provider.
func setup(t *testing.T) (http.Handler, *auth.Store) {
	t.Helper()
	d, err := notaramadb.Open(t.TempDir())
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { d.Close() })

	authStore := auth.NewStore(d.Conn())
	authSvc, err := auth.New(context.Background(), authStore, "", "", "", "http://localhost/auth/callback", true)
	if err != nil {
		t.Fatalf("auth.New: %v", err)
	}
	uploadsStore, err := uploads.NewStore(d.Conn(), t.TempDir())
	if err != nil {
		t.Fatalf("uploads.NewStore: %v", err)
	}

	api := &httpapi.API{
		Auth:    authSvc,
		Notes:   notes.NewStore(d.Conn()),
		Search:  search.NewSearcher(d.Conn()),
		Uploads: uploadsStore,
		Sync:    sync.NewSyncer(d.Conn()),
	}
	return httpapi.NewRouter(api), authStore
}

// clientForUser logs in a specific (non-dev-bypass) user by creating a
// session directly against the auth store, so tests can exercise two
// distinct users against the same handler.
func clientForUser(t *testing.T, handler http.Handler, store *auth.Store, sub string) *client {
	t.Helper()
	user, err := store.UpsertUser(sub, sub+"@example.com", sub)
	if err != nil {
		t.Fatalf("upsert user: %v", err)
	}
	sess, err := store.CreateSession(user.ID)
	if err != nil {
		t.Fatalf("create session: %v", err)
	}
	c := &client{t: t, handler: handler, cookie: &http.Cookie{Name: "notarama_session", Value: sess.ID}}
	c.csrf = sess.CSRFToken
	return c
}

// loggedInClient logs in via dev-bypass against the given handler and
// returns a helper that performs authenticated requests carrying the
// session cookie and (for mutating requests) the CSRF header.
type client struct {
	t       *testing.T
	handler http.Handler
	cookie  *http.Cookie
	csrf    string
}

func newClient(t *testing.T, handler http.Handler) *client {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/auth/login", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusFound {
		t.Fatalf("login: expected 302, got %d", rec.Code)
	}
	var sessionCookie *http.Cookie
	for _, c := range rec.Result().Cookies() {
		if c.Name == "notarama_session" {
			sessionCookie = c
		}
	}
	if sessionCookie == nil {
		t.Fatalf("login did not set a session cookie")
	}

	c := &client{t: t, handler: handler, cookie: sessionCookie}
	var me struct {
		CSRFToken string `json:"csrfToken"`
	}
	c.do(http.MethodGet, "/api/me", nil, &me)
	c.csrf = me.CSRFToken
	return c
}

func (c *client) do(method, path string, body any, out any) *httptest.ResponseRecorder {
	c.t.Helper()
	var reader *strings.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			c.t.Fatalf("marshal body: %v", err)
		}
		reader = strings.NewReader(string(b))
	} else {
		reader = strings.NewReader("")
	}
	req := httptest.NewRequest(method, path, reader)
	req.AddCookie(c.cookie)
	if c.csrf != "" {
		req.Header.Set(auth.CSRFHeader, c.csrf)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	rec := httptest.NewRecorder()
	c.handler.ServeHTTP(rec, req)
	if out != nil && rec.Body.Len() > 0 {
		if err := json.Unmarshal(rec.Body.Bytes(), out); err != nil {
			c.t.Fatalf("unmarshal response for %s %s: %v (body=%s)", method, path, err, rec.Body.String())
		}
	}
	return rec
}

func TestUnauthenticatedRequestsAreRejected(t *testing.T) {
	handler, _ := setup(t)
	req := httptest.NewRequest(http.MethodGet, "/api/tree", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestCreateNodeRequiresCSRFHeader(t *testing.T) {
	handler, _ := setup(t)
	c := newClient(t, handler)
	req := httptest.NewRequest(http.MethodPost, "/api/nodes", strings.NewReader(`{"type":"folder","title":"x"}`))
	req.AddCookie(c.cookie)
	req.Header.Set("Content-Type", "application/json")
	// deliberately omit the CSRF header
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 without CSRF header, got %d", rec.Code)
	}
}

func TestCreateNoteWriteContentAndSearch(t *testing.T) {
	handler, _ := setup(t)
	c := newClient(t, handler)

	var node struct {
		ID string `json:"id"`
	}
	rec := c.do(http.MethodPost, "/api/nodes", map[string]any{"type": "note", "title": "My Note"}, &node)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create node: expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	rec = c.do(http.MethodPut, "/api/notes/"+node.ID+"/content", map[string]any{"contentMd": "hello unique-marker-text"}, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("put content: expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var results []struct {
		NodeID string `json:"nodeId"`
	}
	rec = c.do(http.MethodGet, "/api/search?q=unique-marker-text", nil, &results)
	if rec.Code != http.StatusOK {
		t.Fatalf("search: expected 200, got %d", rec.Code)
	}
	if len(results) != 1 || results[0].NodeID != node.ID {
		t.Fatalf("expected search to find the note, got %+v", results)
	}
}

func TestDeleteNodeRemovesItFromTree(t *testing.T) {
	handler, _ := setup(t)
	c := newClient(t, handler)

	var node struct {
		ID string `json:"id"`
	}
	c.do(http.MethodPost, "/api/nodes", map[string]any{"type": "folder", "title": "Temp"}, &node)

	rec := c.do(http.MethodDelete, "/api/nodes/"+node.ID, nil, nil)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("delete: expected 204, got %d", rec.Code)
	}

	var tree []map[string]any
	c.do(http.MethodGet, "/api/tree", nil, &tree)
	if len(tree) != 0 {
		t.Fatalf("expected empty tree after delete, got %d nodes", len(tree))
	}
}

func TestUsersCannotAccessEachOthersNodes(t *testing.T) {
	handler, authStore := setup(t)
	alice := clientForUser(t, handler, authStore, "alice")
	bob := clientForUser(t, handler, authStore, "bob")

	var node struct {
		ID string `json:"id"`
	}
	rec := alice.do(http.MethodPost, "/api/nodes", map[string]any{"type": "note", "title": "Alice's note"}, &node)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create node: expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	rec = bob.do(http.MethodGet, "/api/notes/"+node.ID, nil, nil)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 when bob reads alice's note, got %d", rec.Code)
	}

	rec = bob.do(http.MethodDelete, "/api/nodes/"+node.ID, nil, nil)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("delete: expected 204 (soft-delete is a no-op for foreign ids), got %d", rec.Code)
	}

	var aliceTree []map[string]any
	alice.do(http.MethodGet, "/api/tree", nil, &aliceTree)
	if len(aliceTree) != 1 {
		t.Fatalf("expected bob's delete attempt to leave alice's note untouched, got %d nodes", len(aliceTree))
	}
}

func TestWikiLinkBacklinksEndpoint(t *testing.T) {
	handler, _ := setup(t)
	c := newClient(t, handler)

	var target struct {
		ID string `json:"id"`
	}
	c.do(http.MethodPost, "/api/nodes", map[string]any{"type": "note", "title": "Recetas"}, &target)

	var source struct {
		ID string `json:"id"`
	}
	c.do(http.MethodPost, "/api/nodes", map[string]any{"type": "note", "title": "Hoy"}, &source)

	rec := c.do(http.MethodPut, "/api/notes/"+source.ID+"/content", map[string]any{"contentMd": "Ver [[Recetas]] de la abuela."}, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("put content: expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var backlinks []struct {
		ID    string `json:"id"`
		Title string `json:"title"`
	}
	rec = c.do(http.MethodGet, "/api/notes/"+target.ID+"/backlinks", nil, &backlinks)
	if rec.Code != http.StatusOK {
		t.Fatalf("backlinks: expected 200, got %d", rec.Code)
	}
	if len(backlinks) != 1 || backlinks[0].ID != source.ID {
		t.Fatalf("expected one backlink from 'Hoy', got %+v", backlinks)
	}
}

func TestTrashRestoreAndPermanentDelete(t *testing.T) {
	handler, _ := setup(t)
	c := newClient(t, handler)

	var node struct {
		ID string `json:"id"`
	}
	c.do(http.MethodPost, "/api/nodes", map[string]any{"type": "note", "title": "Temp"}, &node)
	c.do(http.MethodDelete, "/api/nodes/"+node.ID, nil, nil)

	var trash []map[string]any
	rec := c.do(http.MethodGet, "/api/trash", nil, &trash)
	if rec.Code != http.StatusOK || len(trash) != 1 {
		t.Fatalf("expected one item in trash, got code=%d items=%+v", rec.Code, trash)
	}

	rec = c.do(http.MethodPost, "/api/trash/"+node.ID+"/restore", nil, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("restore: expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var tree []map[string]any
	c.do(http.MethodGet, "/api/tree", nil, &tree)
	if len(tree) != 1 {
		t.Fatalf("expected restored node back in the tree, got %d", len(tree))
	}

	c.do(http.MethodDelete, "/api/nodes/"+node.ID, nil, nil)
	rec = c.do(http.MethodDelete, "/api/trash/"+node.ID, nil, nil)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("permanent delete: expected 204, got %d", rec.Code)
	}

	rec = c.do(http.MethodGet, "/api/trash", nil, &trash)
	if rec.Code != http.StatusOK || len(trash) != 0 {
		t.Fatalf("expected empty trash after permanent delete, got %+v", trash)
	}
}
