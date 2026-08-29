package notes

import "database/sql"

// TrashedNode is a top-level deleted item (a whole deleted subtree is
// represented once, by its root — descendants that were cascade-deleted
// along with it are not listed separately).
type TrashedNode struct {
	ID        string   `json:"id"`
	Type      NodeType `json:"type"`
	Title     string   `json:"title"`
	DeletedAt int64    `json:"deletedAt"`
}

// ListTrash returns the roots of every deleted subtree owned by the user,
// most recently deleted first.
func (s *Store) ListTrash(userID string) ([]TrashedNode, error) {
	rows, err := s.db.Query(`
		SELECT n.id, n.type, n.title, n.deleted_at
		FROM nodes n
		LEFT JOIN nodes p ON p.id = n.parent_id
		WHERE n.user_id = ? AND n.deleted_at IS NOT NULL
		  AND (n.parent_id IS NULL OR p.id IS NULL OR p.deleted_at IS NULL)
		ORDER BY n.deleted_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []TrashedNode{}
	for rows.Next() {
		var t TrashedNode
		if err := rows.Scan(&t.ID, &t.Type, &t.Title, &t.DeletedAt); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// Restore undoes a soft-delete for a node and every descendant that was
// cascade-deleted with it. If the node's own parent is missing or still
// deleted, the node is reparented to root instead of coming back attached
// to a still-deleted (and therefore invisible) ancestor.
func (s *Store) Restore(userID, id string) (*Node, error) {
	node, err := s.GetNode(userID, id)
	if err != nil {
		return nil, err
	}
	if node.DeletedAt == nil {
		return node, nil
	}

	ts := now()
	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	parentValid := false
	if node.ParentID != nil {
		var parentDeletedAt sql.NullInt64
		err := tx.QueryRow(`SELECT deleted_at FROM nodes WHERE id = ? AND user_id = ?`, *node.ParentID, userID).Scan(&parentDeletedAt)
		if err == nil && !parentDeletedAt.Valid {
			parentValid = true
		}
	}

	_, err = tx.Exec(`
		WITH RECURSIVE sub(id) AS (
			SELECT id FROM nodes WHERE user_id = ? AND id = ?
			UNION ALL
			SELECT n.id FROM nodes n JOIN sub ON n.parent_id = sub.id WHERE n.user_id = ?
		)
		UPDATE nodes SET deleted_at = NULL, updated_at = ?
		WHERE user_id = ? AND id IN (SELECT id FROM sub)`,
		userID, id, userID, ts, userID)
	if err != nil {
		return nil, err
	}

	if !parentValid {
		last, err := lastSiblingPosition(tx, userID, nil)
		if err != nil {
			return nil, err
		}
		pos := PositionAfter(last)
		if _, err := tx.Exec(`UPDATE nodes SET parent_id = NULL, position = ? WHERE id = ? AND user_id = ?`, pos, id, userID); err != nil {
			return nil, err
		}
		node.ParentID = nil
		node.Position = pos
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	node.DeletedAt = nil
	node.UpdatedAt = ts
	return node, nil
}

// PermanentlyDelete hard-deletes a node and its descendants (must already
// be in the trash). Unlike SoftDelete this cannot be undone.
func (s *Store) PermanentlyDelete(userID, id string) error {
	_, err := s.db.Exec(`
		WITH RECURSIVE sub(id) AS (
			SELECT id FROM nodes WHERE user_id = ? AND id = ? AND deleted_at IS NOT NULL
			UNION ALL
			SELECT n.id FROM nodes n JOIN sub ON n.parent_id = sub.id WHERE n.user_id = ?
		)
		DELETE FROM nodes WHERE user_id = ? AND id IN (SELECT id FROM sub)`,
		userID, id, userID, userID)
	return err
}

// EmptyTrash permanently deletes every currently-trashed node for the user.
func (s *Store) EmptyTrash(userID string) error {
	_, err := s.db.Exec(`DELETE FROM nodes WHERE user_id = ? AND deleted_at IS NOT NULL`, userID)
	return err
}
