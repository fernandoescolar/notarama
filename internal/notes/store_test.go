package notes

import (
	"testing"

	notaramadb "notarama/internal/db"
)

func newTestStore(t *testing.T) *Store {
	t.Helper()
	d, err := notaramadb.Open(t.TempDir())
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { d.Close() })
	if _, err := d.Conn().Exec(`INSERT INTO users (id, sub, email, name, created_at) VALUES ('u1', 'sub1', 'a@b.com', 'A', 0)`); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	return NewStore(d.Conn())
}

func TestCreateNodeAppendsAtEndOfSiblings(t *testing.T) {
	s := newTestStore(t)

	first, err := s.CreateNode("u1", CreateNodeInput{ID: "n1", Type: TypeFolder, Title: "A"})
	if err != nil {
		t.Fatalf("create first: %v", err)
	}
	second, err := s.CreateNode("u1", CreateNodeInput{ID: "n2", Type: TypeFolder, Title: "B"})
	if err != nil {
		t.Fatalf("create second: %v", err)
	}
	if second.Position <= first.Position {
		t.Fatalf("expected second.Position > first.Position, got %v <= %v", second.Position, first.Position)
	}
}

func TestCreateNoteAlsoCreatesEmptyContent(t *testing.T) {
	s := newTestStore(t)
	if _, err := s.CreateNode("u1", CreateNodeInput{ID: "n1", Type: TypeNote, Title: "Note"}); err != nil {
		t.Fatalf("create: %v", err)
	}
	c, err := s.GetNoteContent("u1", "n1")
	if err != nil {
		t.Fatalf("get content: %v", err)
	}
	if c.ContentMD != "" {
		t.Fatalf("expected empty content, got %q", c.ContentMD)
	}
}

func TestPutNoteContentUpdatesNodeUpdatedAt(t *testing.T) {
	s := newTestStore(t)
	node, err := s.CreateNode("u1", CreateNodeInput{ID: "n1", Type: TypeNote, Title: "Note"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if _, err := s.PutNoteContent("u1", "n1", "# Hello"); err != nil {
		t.Fatalf("put content: %v", err)
	}
	updated, err := s.GetNode("u1", "n1")
	if err != nil {
		t.Fatalf("get node: %v", err)
	}
	if updated.UpdatedAt < node.UpdatedAt {
		t.Fatalf("expected updatedAt to advance: before=%d after=%d", node.UpdatedAt, updated.UpdatedAt)
	}
}

func TestSoftDeleteCascadesToDescendants(t *testing.T) {
	s := newTestStore(t)
	folderID := "folder1"
	if _, err := s.CreateNode("u1", CreateNodeInput{ID: folderID, Type: TypeFolder, Title: "Folder"}); err != nil {
		t.Fatalf("create folder: %v", err)
	}
	if _, err := s.CreateNode("u1", CreateNodeInput{ID: "child1", ParentID: &folderID, Type: TypeNote, Title: "Child"}); err != nil {
		t.Fatalf("create child: %v", err)
	}

	if err := s.SoftDelete("u1", folderID); err != nil {
		t.Fatalf("soft delete: %v", err)
	}

	tree, err := s.ListTree("u1")
	if err != nil {
		t.Fatalf("list tree: %v", err)
	}
	if len(tree) != 0 {
		t.Fatalf("expected empty tree after cascading delete, got %d nodes", len(tree))
	}

	child, err := s.GetNode("u1", "child1")
	if err != nil {
		t.Fatalf("get child: %v", err)
	}
	if child.DeletedAt == nil {
		t.Fatalf("expected child to be soft-deleted")
	}
}

func TestUpdateNodeCanMoveToRoot(t *testing.T) {
	s := newTestStore(t)
	folderID := "folder1"
	if _, err := s.CreateNode("u1", CreateNodeInput{ID: folderID, Type: TypeFolder, Title: "Folder"}); err != nil {
		t.Fatalf("create folder: %v", err)
	}
	if _, err := s.CreateNode("u1", CreateNodeInput{ID: "child1", ParentID: &folderID, Type: TypeNote, Title: "Child"}); err != nil {
		t.Fatalf("create child: %v", err)
	}

	var nilParent *string
	updated, err := s.UpdateNode("u1", "child1", UpdateNodeInput{ParentID: &nilParent})
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if updated.ParentID != nil {
		t.Fatalf("expected node to be moved to root, parentId=%v", *updated.ParentID)
	}
}

func TestGetNodeNotFound(t *testing.T) {
	s := newTestStore(t)
	if _, err := s.GetNode("u1", "missing"); err != ErrNotFound {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}
