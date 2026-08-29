package notes

import (
	"database/sql"
	"errors"
	"regexp"
	"strings"
)

var wikiLinkPattern = regexp.MustCompile(`\[\[([^\[\]]+)\]\]`)

// The markdown serializer (tiptap-markdown, on the frontend) backslash-
// escapes literal punctuation that would otherwise read as markdown syntax
// — including square brackets — so "[[Title]]" is actually stored as
// "\[\[Title\]\]". That's correct behavior for round-tripping through the
// editor (which un-escapes it back on parse), but it means the raw
// content_md never contains a literal "[[...]]" for wikiLinkPattern to
// match unless we undo that escaping first.
var markdownEscapePattern = regexp.MustCompile(`\\([!-/:-@\[-` + "`" + `{-~])`)

func unescapeMarkdown(s string) string {
	return markdownEscapePattern.ReplaceAllString(s, "$1")
}

// Backlink is a note that references another note via a [[Title]] link.
type Backlink struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

// ReindexLinks recomputes a note's outgoing [[Title]] links from its
// current markdown content, replacing whatever was stored before. Links
// are resolved by exact case-insensitive title match within the same
// user's (non-deleted) notes; a reference that doesn't match any note's
// current title is simply dropped rather than stored as a dangling link —
// it starts resolving as soon as a note with that title exists and this
// note is saved again.
func ReindexLinks(tx *sql.Tx, userID, nodeID, contentMD string) error {
	if _, err := tx.Exec(`DELETE FROM note_links WHERE source_node_id = ?`, nodeID); err != nil {
		return err
	}

	seen := map[string]bool{}
	for _, m := range wikiLinkPattern.FindAllStringSubmatch(unescapeMarkdown(contentMD), -1) {
		title := strings.TrimSpace(m[1])
		key := strings.ToLower(title)
		if title == "" || seen[key] {
			continue
		}
		seen[key] = true

		var targetID string
		err := tx.QueryRow(`
			SELECT id FROM nodes
			WHERE user_id = ? AND type = 'note' AND deleted_at IS NULL AND lower(title) = lower(?)
			LIMIT 1`, userID, title).Scan(&targetID)
		if errors.Is(err, sql.ErrNoRows) {
			continue
		}
		if err != nil {
			return err
		}
		if targetID == nodeID {
			continue // no self-links
		}
		if _, err := tx.Exec(`INSERT OR IGNORE INTO note_links (source_node_id, target_node_id) VALUES (?, ?)`, nodeID, targetID); err != nil {
			return err
		}
	}
	return nil
}

// GetBacklinks returns the notes that link to the given node, i.e. the
// "mentions" / backlinks panel data.
func (s *Store) GetBacklinks(userID, nodeID string) ([]Backlink, error) {
	rows, err := s.db.Query(`
		SELECT n.id, n.title
		FROM note_links l
		JOIN nodes n ON n.id = l.source_node_id
		WHERE l.target_node_id = ? AND n.user_id = ? AND n.deleted_at IS NULL
		ORDER BY n.title COLLATE NOCASE`, nodeID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Backlink{}
	for rows.Next() {
		var b Backlink
		if err := rows.Scan(&b.ID, &b.Title); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}
