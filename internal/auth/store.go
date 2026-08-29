// Package auth handles OIDC login, server-side sessions and CSRF checks.
package auth

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"time"
)

var ErrNotFound = errors.New("not found")

type User struct {
	ID    string
	Sub   string
	Email string
	Name  string
}

type Session struct {
	ID        string
	UserID    string
	CSRFToken string
	ExpiresAt int64
}

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func randomToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// UpsertUser creates the user on first login or updates their profile info
// on subsequent logins (identified by the stable OIDC `sub` claim).
func (s *Store) UpsertUser(sub, email, name string) (*User, error) {
	var id string
	err := s.db.QueryRow(`SELECT id FROM users WHERE sub = ?`, sub).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		newID, err := randomToken()
		if err != nil {
			return nil, err
		}
		id = newID[:32]
		_, err = s.db.Exec(`INSERT INTO users (id, sub, email, name, created_at) VALUES (?, ?, ?, ?, ?)`,
			id, sub, email, name, time.Now().Unix())
		if err != nil {
			return nil, err
		}
		return &User{ID: id, Sub: sub, Email: email, Name: name}, nil
	}
	if err != nil {
		return nil, err
	}
	if _, err := s.db.Exec(`UPDATE users SET email = ?, name = ? WHERE id = ?`, email, name, id); err != nil {
		return nil, err
	}
	return &User{ID: id, Sub: sub, Email: email, Name: name}, nil
}

const sessionTTL = 30 * 24 * time.Hour

func (s *Store) CreateSession(userID string) (*Session, error) {
	id, err := randomToken()
	if err != nil {
		return nil, err
	}
	csrf, err := randomToken()
	if err != nil {
		return nil, err
	}
	expiresAt := time.Now().Add(sessionTTL).Unix()
	_, err = s.db.Exec(`INSERT INTO sessions (id, user_id, csrf_token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`,
		id, userID, csrf, expiresAt, time.Now().Unix())
	if err != nil {
		return nil, err
	}
	return &Session{ID: id, UserID: userID, CSRFToken: csrf, ExpiresAt: expiresAt}, nil
}

func (s *Store) GetSession(id string) (*Session, error) {
	sess := Session{}
	err := s.db.QueryRow(`SELECT id, user_id, csrf_token, expires_at FROM sessions WHERE id = ?`, id).
		Scan(&sess.ID, &sess.UserID, &sess.CSRFToken, &sess.ExpiresAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if sess.ExpiresAt < time.Now().Unix() {
		_ = s.DeleteSession(id)
		return nil, ErrNotFound
	}
	return &sess, nil
}

func (s *Store) DeleteSession(id string) error {
	_, err := s.db.Exec(`DELETE FROM sessions WHERE id = ?`, id)
	return err
}

func (s *Store) GetUser(id string) (*User, error) {
	u := User{ID: id}
	err := s.db.QueryRow(`SELECT sub, email, name FROM users WHERE id = ?`, id).Scan(&u.Sub, &u.Email, &u.Name)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}
