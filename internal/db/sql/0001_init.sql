CREATE TABLE users (
    id         TEXT PRIMARY KEY,
    sub        TEXT NOT NULL UNIQUE,
    email      TEXT NOT NULL,
    name       TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE sessions (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    csrf_token TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);

CREATE TABLE nodes (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id  TEXT REFERENCES nodes(id) ON DELETE CASCADE,
    type       TEXT NOT NULL CHECK (type IN ('folder', 'note')),
    title      TEXT NOT NULL DEFAULT '',
    position   REAL NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
);
CREATE INDEX idx_nodes_user_id ON nodes(user_id);
CREATE INDEX idx_nodes_parent_id ON nodes(parent_id, position);
CREATE INDEX idx_nodes_user_updated ON nodes(user_id, updated_at);

CREATE TABLE note_content (
    node_id    TEXT PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
    content_md TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL
);

CREATE TABLE attachments (
    id         TEXT PRIMARY KEY,
    node_id    TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename   TEXT NOT NULL,
    path       TEXT NOT NULL,
    mime       TEXT NOT NULL,
    size       INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);
CREATE INDEX idx_attachments_node_id ON attachments(node_id);

-- Standalone FTS5 index (duplicates title/content_md rather than using
-- external-content mode, so plain INSERT/UPDATE/DELETE by node_id all work).
CREATE VIRTUAL TABLE notes_fts USING fts5(
    title,
    content_md,
    node_id UNINDEXED,
    user_id UNINDEXED,
    tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER trg_nodes_ai AFTER INSERT ON nodes WHEN NEW.type = 'note' BEGIN
    INSERT INTO notes_fts(node_id, user_id, title, content_md) VALUES (NEW.id, NEW.user_id, NEW.title, '');
END;

CREATE TRIGGER trg_nodes_au_title AFTER UPDATE OF title ON nodes WHEN NEW.type = 'note' BEGIN
    UPDATE notes_fts SET title = NEW.title WHERE node_id = NEW.id;
END;

CREATE TRIGGER trg_nodes_ad AFTER DELETE ON nodes WHEN OLD.type = 'note' BEGIN
    DELETE FROM notes_fts WHERE node_id = OLD.id;
END;

CREATE TRIGGER trg_content_ai AFTER INSERT ON note_content BEGIN
    UPDATE notes_fts SET content_md = NEW.content_md WHERE node_id = NEW.node_id;
END;

CREATE TRIGGER trg_content_au AFTER UPDATE ON note_content BEGIN
    UPDATE notes_fts SET content_md = NEW.content_md WHERE node_id = NEW.node_id;
END;
