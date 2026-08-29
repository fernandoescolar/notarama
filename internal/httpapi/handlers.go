package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"notarama/internal/auth"
	"notarama/internal/notes"
	"notarama/internal/search"
	"notarama/internal/sync"
	"notarama/internal/uploads"
)

type API struct {
	Auth    *auth.Service
	Notes   *notes.Store
	Search  *search.Searcher
	Uploads *uploads.Store
	Sync    *sync.Syncer
}

func (a *API) handleMe(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserID(r.Context())
	user, err := a.Auth.Store().GetUser(userID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"id":        user.ID,
		"email":     user.Email,
		"name":      user.Name,
		"csrfToken": auth.CSRFToken(r.Context()),
	})
}

func (a *API) handleTree(w http.ResponseWriter, r *http.Request) {
	nodes, err := a.Notes.ListTree(auth.UserID(r.Context()))
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, nodes)
}

type createNodeRequest struct {
	ID       string   `json:"id"`
	ParentID *string  `json:"parentId"`
	Type     string   `json:"type"`
	Title    string   `json:"title"`
	Position *float64 `json:"position"`
}

func (a *API) handleCreateNode(w http.ResponseWriter, r *http.Request) {
	var req createNodeRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Type != string(notes.TypeFolder) && req.Type != string(notes.TypeNote) {
		writeError(w, http.StatusBadRequest, "type must be 'folder' or 'note'")
		return
	}
	id := req.ID
	if id == "" {
		id = uuid.NewString()
	}

	node, err := a.Notes.CreateNode(auth.UserID(r.Context()), notes.CreateNodeInput{
		ID:       id,
		ParentID: req.ParentID,
		Type:     notes.NodeType(req.Type),
		Title:    req.Title,
		Position: req.Position,
	})
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, node)
}

func (a *API) handlePatchNode(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	raw := map[string]json.RawMessage{}
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	in := notes.UpdateNodeInput{}
	if v, ok := raw["title"]; ok {
		var title string
		if err := json.Unmarshal(v, &title); err != nil {
			writeError(w, http.StatusBadRequest, "invalid title")
			return
		}
		in.Title = &title
	}
	if v, ok := raw["parentId"]; ok {
		var parentID *string
		if err := json.Unmarshal(v, &parentID); err != nil {
			writeError(w, http.StatusBadRequest, "invalid parentId")
			return
		}
		in.ParentID = &parentID
	}
	if v, ok := raw["position"]; ok {
		var position float64
		if err := json.Unmarshal(v, &position); err != nil {
			writeError(w, http.StatusBadRequest, "invalid position")
			return
		}
		in.Position = &position
	}

	node, err := a.Notes.UpdateNode(auth.UserID(r.Context()), id, in)
	if errors.Is(err, notes.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, node)
}

func (a *API) handleDeleteNode(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := a.Notes.SoftDelete(auth.UserID(r.Context()), id); err != nil {
		serverError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (a *API) handleGetNoteContent(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	content, err := a.Notes.GetNoteContent(auth.UserID(r.Context()), id)
	if errors.Is(err, notes.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, content)
}

type putContentRequest struct {
	ContentMD string `json:"contentMd"`
}

func (a *API) handlePutNoteContent(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req putContentRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	content, err := a.Notes.PutNoteContent(auth.UserID(r.Context()), id, req.ContentMD)
	if errors.Is(err, notes.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, content)
}

func (a *API) handleGetBacklinks(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	backlinks, err := a.Notes.GetBacklinks(auth.UserID(r.Context()), id)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, backlinks)
}

func (a *API) handleListTrash(w http.ResponseWriter, r *http.Request) {
	items, err := a.Notes.ListTrash(auth.UserID(r.Context()))
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (a *API) handleRestoreNode(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	node, err := a.Notes.Restore(auth.UserID(r.Context()), id)
	if errors.Is(err, notes.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, node)
}

func (a *API) handlePermanentlyDeleteNode(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := a.Notes.PermanentlyDelete(auth.UserID(r.Context()), id); err != nil {
		serverError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (a *API) handleEmptyTrash(w http.ResponseWriter, r *http.Request) {
	if err := a.Notes.EmptyTrash(auth.UserID(r.Context())); err != nil {
		serverError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (a *API) handleSearch(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	results, err := a.Search.Search(auth.UserID(r.Context()), q)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, results)
}

const maxUploadSize = 20 << 20 // 20MB

func (a *API) handleUpload(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)
	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		writeError(w, http.StatusBadRequest, "file too large or invalid form")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "missing file field")
		return
	}
	defer file.Close()

	nodeID := r.FormValue("nodeId")
	mime := header.Header.Get("Content-Type")
	if mime == "" {
		mime = "application/octet-stream"
	}

	att, err := a.Uploads.Save(auth.UserID(r.Context()), nodeID, header.Filename, mime, file)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{
		"id":  att.ID,
		"url": "/api/uploads/" + att.ID,
	})
}

func (a *API) handleGetUpload(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	path, mime, err := a.Uploads.Open(auth.UserID(r.Context()), id)
	if errors.Is(err, uploads.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		serverError(w, err)
		return
	}
	f, err := os.Open(path)
	if err != nil {
		serverError(w, err)
		return
	}
	defer f.Close()
	w.Header().Set("Content-Type", mime)
	w.Header().Set("Cache-Control", "private, max-age=31536000, immutable")
	io.Copy(w, f)
}

func (a *API) handleSyncPull(w http.ResponseWriter, r *http.Request) {
	since := int64(0)
	if v := r.URL.Query().Get("since"); v != "" {
		parsed, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid since")
			return
		}
		since = parsed
	}
	resp, err := a.Sync.Pull(auth.UserID(r.Context()), since)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (a *API) handleSyncPush(w http.ResponseWriter, r *http.Request) {
	var req sync.PushRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := a.Sync.Push(auth.UserID(r.Context()), req); err != nil {
		serverError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
