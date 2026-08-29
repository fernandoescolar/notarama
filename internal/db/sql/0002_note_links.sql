-- Wiki-style [[Title]] links between notes, recomputed from scratch
-- whenever a note's content is saved (see notes.ReindexLinks).
CREATE TABLE note_links (
    source_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    target_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    PRIMARY KEY (source_node_id, target_node_id)
);
CREATE INDEX idx_note_links_target ON note_links(target_node_id);
