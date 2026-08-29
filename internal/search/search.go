// Package search implements full-text search over notes using SQLite FTS5.
package search

import "database/sql"

type Result struct {
	NodeID  string `json:"nodeId"`
	Title   string `json:"title"`
	Snippet string `json:"snippet"`
}

// Sentinel markers wrapping matched terms in Snippet; see Search for why
// these aren't literal HTML tags.
const (
	matchStart = "\x01"
	matchEnd   = "\x02"
)

type Searcher struct {
	db *sql.DB
}

func NewSearcher(db *sql.DB) *Searcher {
	return &Searcher{db: db}
}

// Search runs an FTS5 MATCH query scoped to the user's own notes and
// returns a ranked list of results with a highlighted snippet.
func (s *Searcher) Search(userID, query string) ([]Result, error) {
	if query == "" {
		return []Result{}, nil
	}
	// Sentinel markers (unlikely to appear in real note text) instead of
	// literal <mark> tags: the frontend HTML-escapes the snippet before
	// rendering it (the surrounding text is unescaped user note content)
	// and only turns these specific markers into real <mark> tags.
	rows, err := s.db.Query(`
		SELECT n.node_id, n.title,
		       snippet(notes_fts, 1, '`+matchStart+`', '`+matchEnd+`', '…', 12)
		FROM notes_fts n
		JOIN nodes nd ON nd.id = n.node_id
		WHERE n.user_id = ? AND notes_fts MATCH ? AND nd.deleted_at IS NULL
		ORDER BY rank
		LIMIT 50`, userID, ftsQuery(query))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Result{}
	for rows.Next() {
		var r Result
		if err := rows.Scan(&r.NodeID, &r.Title, &r.Snippet); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// ftsQuery turns free-text user input into an FTS5 query that matches
// documents containing all of the given terms as prefixes, without
// exposing raw FTS5 syntax (which could otherwise error out on stray
// quotes/operators typed by the user).
func ftsQuery(q string) string {
	terms := []rune{}
	var out string
	flush := func() {
		if len(terms) > 0 {
			if out != "" {
				out += " "
			}
			out += `"` + string(terms) + `"*`
			terms = nil
		}
	}
	for _, r := range q {
		if r == ' ' || r == '\t' || r == '\n' {
			flush()
			continue
		}
		if r == '"' {
			continue
		}
		terms = append(terms, r)
	}
	flush()
	return out
}
