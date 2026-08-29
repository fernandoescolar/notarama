// Package sync implements incremental pull/push endpoints used by the PWA's
// offline-first local database to reconcile with the server. Conflicts are
// resolved last-write-wins by comparing the `updatedAt` timestamp each
// client/server row carries.
package sync

import (
	"database/sql"
	"time"

	"notarama/internal/notes"
)

type NodeChange struct {
	ID        string  `json:"id"`
	ParentID  *string `json:"parentId"`
	Type      string  `json:"type"`
	Title     string  `json:"title"`
	Position  float64 `json:"position"`
	CreatedAt int64   `json:"createdAt"`
	UpdatedAt int64   `json:"updatedAt"`
	DeletedAt *int64  `json:"deletedAt"`
}

type NoteChange struct {
	NodeID    string `json:"nodeId"`
	ContentMD string `json:"contentMd"`
	UpdatedAt int64  `json:"updatedAt"`
}

type PullResponse struct {
	Nodes      []NodeChange `json:"nodes"`
	Notes      []NoteChange `json:"notes"`
	ServerTime int64        `json:"serverTime"`
}

type PushRequest struct {
	Nodes []NodeChange `json:"nodes"`
	Notes []NoteChange `json:"notes"`
}

type Syncer struct {
	db *sql.DB
}

func NewSyncer(db *sql.DB) *Syncer {
	return &Syncer{db: db}
}

// Pull returns every node/note-content row changed since the given
// millisecond timestamp, including tombstones (deleted_at set) so the
// client can remove them locally.
func (s *Syncer) Pull(userID string, since int64) (*PullResponse, error) {
	resp := &PullResponse{Nodes: []NodeChange{}, Notes: []NoteChange{}, ServerTime: time.Now().UnixMilli()}

	nodeRows, err := s.db.Query(`
		SELECT id, parent_id, type, title, position, created_at, updated_at, deleted_at
		FROM nodes WHERE user_id = ? AND updated_at > ?`, userID, since)
	if err != nil {
		return nil, err
	}
	for nodeRows.Next() {
		var n NodeChange
		if err := nodeRows.Scan(&n.ID, &n.ParentID, &n.Type, &n.Title, &n.Position, &n.CreatedAt, &n.UpdatedAt, &n.DeletedAt); err != nil {
			nodeRows.Close()
			return nil, err
		}
		resp.Nodes = append(resp.Nodes, n)
	}
	nodeRows.Close()
	if err := nodeRows.Err(); err != nil {
		return nil, err
	}

	noteRows, err := s.db.Query(`
		SELECT nc.node_id, nc.content_md, nc.updated_at
		FROM note_content nc
		JOIN nodes n ON n.id = nc.node_id
		WHERE n.user_id = ? AND nc.updated_at > ?`, userID, since)
	if err != nil {
		return nil, err
	}
	defer noteRows.Close()
	for noteRows.Next() {
		var c NoteChange
		if err := noteRows.Scan(&c.NodeID, &c.ContentMD, &c.UpdatedAt); err != nil {
			return nil, err
		}
		resp.Notes = append(resp.Notes, c)
	}
	return resp, noteRows.Err()
}

// Push applies a batch of offline-queued mutations. Each row is only
// applied if it is at least as new as the row currently stored (last-write-
// wins); the caller should follow up with Pull to fetch authoritative state
// for anything that lost a conflict.
func (s *Syncer) Push(userID string, req PushRequest) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, n := range req.Nodes {
		_, err := tx.Exec(`
			INSERT INTO nodes (id, user_id, parent_id, type, title, position, created_at, updated_at, deleted_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(id) DO UPDATE SET
				parent_id = excluded.parent_id,
				title = excluded.title,
				position = excluded.position,
				updated_at = excluded.updated_at,
				deleted_at = excluded.deleted_at
			WHERE nodes.user_id = excluded.user_id AND excluded.updated_at >= nodes.updated_at`,
			n.ID, userID, n.ParentID, n.Type, n.Title, n.Position, n.CreatedAt, n.UpdatedAt, n.DeletedAt)
		if err != nil {
			return err
		}
	}

	for _, c := range req.Notes {
		res, err := tx.Exec(`
			INSERT INTO note_content (node_id, content_md, updated_at)
			SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM nodes WHERE id = ? AND user_id = ?)
			ON CONFLICT(node_id) DO UPDATE SET
				content_md = excluded.content_md,
				updated_at = excluded.updated_at
			WHERE excluded.updated_at >= note_content.updated_at`,
			c.NodeID, c.ContentMD, c.UpdatedAt, c.NodeID, userID)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(`UPDATE nodes SET updated_at = MAX(updated_at, ?) WHERE id = ? AND user_id = ?`, c.UpdatedAt, c.NodeID, userID); err != nil {
			return err
		}
		// Only reindex if this row actually won the last-write-wins check
		// above — otherwise c.ContentMD is stale content that lost against
		// what's already stored, and indexing it would record wrong links.
		if affected, _ := res.RowsAffected(); affected > 0 {
			if err := notes.ReindexLinks(tx, userID, c.NodeID, c.ContentMD); err != nil {
				return err
			}
		}
	}

	return tx.Commit()
}
