package notes

import (
	"database/sql"
	"errors"
	"fmt"
	"time"
)

var ErrNotFound = errors.New("not found")

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func now() int64 { return time.Now().UnixMilli() }

// ListTree returns every non-deleted node owned by the user, ordered so
// that a caller can build the sidebar hierarchy directly.
func (s *Store) ListTree(userID string) ([]Node, error) {
	rows, err := s.db.Query(`
		SELECT id, parent_id, type, title, position, created_at, updated_at
		FROM nodes
		WHERE user_id = ? AND deleted_at IS NULL
		ORDER BY parent_id IS NOT NULL, parent_id, position`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Node{}
	for rows.Next() {
		n := Node{UserID: userID}
		if err := rows.Scan(&n.ID, &n.ParentID, &n.Type, &n.Title, &n.Position, &n.CreatedAt, &n.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, rows.Err()
}

func (s *Store) GetNode(userID, id string) (*Node, error) {
	n := Node{UserID: userID}
	err := s.db.QueryRow(`
		SELECT id, parent_id, type, title, position, created_at, updated_at, deleted_at
		FROM nodes WHERE user_id = ? AND id = ?`, userID, id).
		Scan(&n.ID, &n.ParentID, &n.Type, &n.Title, &n.Position, &n.CreatedAt, &n.UpdatedAt, &n.DeletedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &n, nil
}

// queryRower is satisfied by both *sql.DB and *sql.Tx, so helpers built on
// it can run either as a standalone query or as part of a larger transaction.
type queryRower interface {
	QueryRow(query string, args ...any) *sql.Row
}

// lastSiblingPosition returns the highest position among non-deleted
// children of parentID (nil = root), or nil if there are none.
func lastSiblingPosition(q queryRower, userID string, parentID *string) (*float64, error) {
	var pos sql.NullFloat64
	var err error
	if parentID == nil {
		err = q.QueryRow(`SELECT MAX(position) FROM nodes WHERE user_id = ? AND parent_id IS NULL AND deleted_at IS NULL`, userID).Scan(&pos)
	} else {
		err = q.QueryRow(`SELECT MAX(position) FROM nodes WHERE user_id = ? AND parent_id = ? AND deleted_at IS NULL`, userID, *parentID).Scan(&pos)
	}
	if err != nil {
		return nil, err
	}
	if !pos.Valid {
		return nil, nil
	}
	return &pos.Float64, nil
}

type CreateNodeInput struct {
	ID       string
	ParentID *string
	Type     NodeType
	Title    string
	Position *float64 // if nil, appended after the current last sibling
}

func (s *Store) CreateNode(userID string, in CreateNodeInput) (*Node, error) {
	pos := in.Position
	if pos == nil {
		last, err := lastSiblingPosition(s.db, userID, in.ParentID)
		if err != nil {
			return nil, err
		}
		p := PositionAfter(last)
		pos = &p
	}

	ts := now()
	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		INSERT INTO nodes (id, user_id, parent_id, type, title, position, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		in.ID, userID, in.ParentID, string(in.Type), in.Title, *pos, ts, ts)
	if err != nil {
		return nil, fmt.Errorf("insert node: %w", err)
	}

	if in.Type == TypeNote {
		if _, err := tx.Exec(`INSERT INTO note_content (node_id, content_md, updated_at) VALUES (?, '', ?)`, in.ID, ts); err != nil {
			return nil, fmt.Errorf("insert note_content: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &Node{ID: in.ID, UserID: userID, ParentID: in.ParentID, Type: in.Type, Title: in.Title, Position: *pos, CreatedAt: ts, UpdatedAt: ts}, nil
}

type UpdateNodeInput struct {
	Title    *string
	ParentID **string // pointer-to-pointer so nil = "don't change", &nil = "move to root"
	Position *float64
}

func (s *Store) UpdateNode(userID, id string, in UpdateNodeInput) (*Node, error) {
	existing, err := s.GetNode(userID, id)
	if err != nil {
		return nil, err
	}
	if existing.DeletedAt != nil {
		return nil, ErrNotFound
	}

	title := existing.Title
	if in.Title != nil {
		title = *in.Title
	}
	parentID := existing.ParentID
	if in.ParentID != nil {
		parentID = *in.ParentID
	}
	position := existing.Position
	if in.Position != nil {
		position = *in.Position
	}

	ts := now()
	_, err = s.db.Exec(`
		UPDATE nodes SET title = ?, parent_id = ?, position = ?, updated_at = ?
		WHERE user_id = ? AND id = ?`,
		title, parentID, position, ts, userID, id)
	if err != nil {
		return nil, err
	}

	existing.Title = title
	existing.ParentID = parentID
	existing.Position = position
	existing.UpdatedAt = ts
	return existing, nil
}

// SoftDelete marks a node (and, via ON DELETE CASCADE semantics simulated
// manually below, its descendants) as deleted so it can be tombstoned by
// the sync endpoint.
func (s *Store) SoftDelete(userID, id string) error {
	ts := now()
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Soft-delete the node itself and every descendant (folders can be nested).
	_, err = tx.Exec(`
		WITH RECURSIVE sub(id) AS (
			SELECT id FROM nodes WHERE user_id = ? AND id = ?
			UNION ALL
			SELECT n.id FROM nodes n JOIN sub ON n.parent_id = sub.id WHERE n.user_id = ?
		)
		UPDATE nodes SET deleted_at = ?, updated_at = ?
		WHERE user_id = ? AND id IN (SELECT id FROM sub) AND deleted_at IS NULL`,
		userID, id, userID, ts, ts, userID)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) GetNoteContent(userID, nodeID string) (*NoteContent, error) {
	n, err := s.GetNode(userID, nodeID)
	if err != nil {
		return nil, err
	}
	if n.Type != TypeNote {
		return nil, ErrNotFound
	}
	c := NoteContent{NodeID: nodeID}
	err = s.db.QueryRow(`SELECT content_md, updated_at FROM note_content WHERE node_id = ?`, nodeID).
		Scan(&c.ContentMD, &c.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return &NoteContent{NodeID: nodeID}, nil
	}
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (s *Store) PutNoteContent(userID, nodeID, contentMD string) (*NoteContent, error) {
	n, err := s.GetNode(userID, nodeID)
	if err != nil {
		return nil, err
	}
	if n.Type != TypeNote || n.DeletedAt != nil {
		return nil, ErrNotFound
	}

	ts := now()
	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		INSERT INTO note_content (node_id, content_md, updated_at) VALUES (?, ?, ?)
		ON CONFLICT(node_id) DO UPDATE SET content_md = excluded.content_md, updated_at = excluded.updated_at`,
		nodeID, contentMD, ts)
	if err != nil {
		return nil, err
	}
	if _, err := tx.Exec(`UPDATE nodes SET updated_at = ? WHERE id = ?`, ts, nodeID); err != nil {
		return nil, err
	}
	if err := ReindexLinks(tx, userID, nodeID, contentMD); err != nil {
		return nil, fmt.Errorf("reindex links: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return &NoteContent{NodeID: nodeID, ContentMD: contentMD, UpdatedAt: ts}, nil
}
