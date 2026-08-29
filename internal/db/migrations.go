package db

import (
	"embed"
	"fmt"
	"io/fs"
	"sort"
)

//go:embed all:sql
var migrationsFS embed.FS

// migrationFiles returns embedded *.sql migration filenames in lexical order.
func migrationFiles() ([]string, error) {
	entries, err := fs.ReadDir(migrationsFS, "sql")
	if err != nil {
		return nil, err
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)
	return names, nil
}

func (d *DB) migrate() error {
	if _, err := d.conn.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)`); err != nil {
		return fmt.Errorf("create schema_migrations: %w", err)
	}

	applied := map[string]bool{}
	rows, err := d.conn.Query(`SELECT name FROM schema_migrations`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			rows.Close()
			return err
		}
		applied[name] = true
	}
	rows.Close()

	names, err := migrationFiles()
	if err != nil {
		return err
	}

	for _, name := range names {
		if applied[name] {
			continue
		}
		content, err := fs.ReadFile(migrationsFS, "sql/"+name)
		if err != nil {
			return err
		}
		tx, err := d.conn.Begin()
		if err != nil {
			return err
		}
		if _, err := tx.Exec(string(content)); err != nil {
			tx.Rollback()
			return fmt.Errorf("apply migration %s: %w", name, err)
		}
		if _, err := tx.Exec(`INSERT INTO schema_migrations(name, applied_at) VALUES (?, unixepoch())`, name); err != nil {
			tx.Rollback()
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
	}
	return nil
}
