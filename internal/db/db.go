// Package db manages the SQLite connection and schema migrations.
package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

type DB struct {
	conn *sql.DB
}

func (d *DB) Conn() *sql.DB { return d.conn }

// Open opens (creating if needed) the SQLite database at dataDir/notarama.db
// and applies any pending migrations.
func Open(dataDir string) (*DB, error) {
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return nil, fmt.Errorf("create data dir: %w", err)
	}
	path := filepath.Join(dataDir, "notarama.db")

	dsn := fmt.Sprintf("file:%s?_pragma=busy_timeout(5000)&_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)", path)
	conn, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	// modernc.org/sqlite does not support concurrent writers well across
	// multiple connections; a single connection avoids SQLITE_BUSY churn
	// since Notarama is a single-process server.
	conn.SetMaxOpenConns(1)

	d := &DB{conn: conn}
	if err := d.migrate(); err != nil {
		conn.Close()
		return nil, err
	}
	return d, nil
}

func (d *DB) Close() error {
	return d.conn.Close()
}
