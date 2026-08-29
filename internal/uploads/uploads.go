// Package uploads stores and serves image attachments for notes.
package uploads

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"
)

var ErrNotFound = errors.New("not found")

type Attachment struct {
	ID       string
	NodeID   string
	UserID   string
	Filename string
	Mime     string
	Size     int64
}

type Store struct {
	db  *sql.DB
	dir string
}

func NewStore(db *sql.DB, dataDir string) (*Store, error) {
	dir := filepath.Join(dataDir, "uploads")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	return &Store{db: db, dir: dir}, nil
}

func randomID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// Save writes an uploaded file to disk (scoped per-user to avoid path
// collisions) and records it in the database.
func (s *Store) Save(userID, nodeID, filename, mime string, r io.Reader) (*Attachment, error) {
	id, err := randomID()
	if err != nil {
		return nil, err
	}

	userDir := filepath.Join(s.dir, userID)
	if err := os.MkdirAll(userDir, 0o755); err != nil {
		return nil, err
	}
	destPath := filepath.Join(userDir, id+filepath.Ext(filename))

	f, err := os.Create(destPath)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	n, err := io.Copy(f, r)
	if err != nil {
		os.Remove(destPath)
		return nil, err
	}

	_, err = s.db.Exec(`INSERT INTO attachments (id, node_id, user_id, filename, path, mime, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		id, nodeID, userID, filename, destPath, mime, n, time.Now().Unix())
	if err != nil {
		os.Remove(destPath)
		return nil, err
	}

	return &Attachment{ID: id, NodeID: nodeID, UserID: userID, Filename: filename, Mime: mime, Size: n}, nil
}

// Open returns the file path and mime type for an attachment, verifying it
// belongs to the requesting user.
func (s *Store) Open(userID, id string) (path, mime string, err error) {
	err = s.db.QueryRow(`SELECT path, mime FROM attachments WHERE id = ? AND user_id = ?`, id, userID).Scan(&path, &mime)
	if errors.Is(err, sql.ErrNoRows) {
		return "", "", ErrNotFound
	}
	if err != nil {
		return "", "", fmt.Errorf("lookup attachment: %w", err)
	}
	return path, mime, nil
}
