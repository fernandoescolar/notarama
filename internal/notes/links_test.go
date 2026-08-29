package notes

import "testing"

func TestPutNoteContentIndexesWikiLinks(t *testing.T) {
	s := newTestStore(t)

	if _, err := s.CreateNode("u1", CreateNodeInput{ID: "target", Type: TypeNote, Title: "Recetas"}); err != nil {
		t.Fatalf("create target: %v", err)
	}
	if _, err := s.CreateNode("u1", CreateNodeInput{ID: "source", Type: TypeNote, Title: "Hoy"}); err != nil {
		t.Fatalf("create source: %v", err)
	}

	if _, err := s.PutNoteContent("u1", "source", "Hoy voy a hacer la [[Recetas]] de mi abuela."); err != nil {
		t.Fatalf("put content: %v", err)
	}

	backlinks, err := s.GetBacklinks("u1", "target")
	if err != nil {
		t.Fatalf("get backlinks: %v", err)
	}
	if len(backlinks) != 1 || backlinks[0].ID != "source" {
		t.Fatalf("expected one backlink from 'source', got %+v", backlinks)
	}
}

// The frontend's markdown serializer (tiptap-markdown) backslash-escapes
// literal square brackets before storing content, so the wire content is
// actually "\[\[Recetas\]\]" — this must still resolve.
func TestWikiLinkResolvesThroughMarkdownEscaping(t *testing.T) {
	s := newTestStore(t)
	if _, err := s.CreateNode("u1", CreateNodeInput{ID: "target", Type: TypeNote, Title: "Recetas"}); err != nil {
		t.Fatalf("create target: %v", err)
	}
	if _, err := s.CreateNode("u1", CreateNodeInput{ID: "source", Type: TypeNote, Title: "Hoy"}); err != nil {
		t.Fatalf("create source: %v", err)
	}

	if _, err := s.PutNoteContent("u1", "source", `Voy a hacer \[\[Recetas\]\]`); err != nil {
		t.Fatalf("put content: %v", err)
	}

	backlinks, err := s.GetBacklinks("u1", "target")
	if err != nil {
		t.Fatalf("get backlinks: %v", err)
	}
	if len(backlinks) != 1 || backlinks[0].ID != "source" {
		t.Fatalf("expected the escaped link to still resolve, got %+v", backlinks)
	}
}

func TestWikiLinkIsCaseInsensitiveAndIgnoresUnknownTitles(t *testing.T) {
	s := newTestStore(t)
	if _, err := s.CreateNode("u1", CreateNodeInput{ID: "target", Type: TypeNote, Title: "Recetas"}); err != nil {
		t.Fatalf("create target: %v", err)
	}
	if _, err := s.CreateNode("u1", CreateNodeInput{ID: "source", Type: TypeNote, Title: "Hoy"}); err != nil {
		t.Fatalf("create source: %v", err)
	}

	if _, err := s.PutNoteContent("u1", "source", "Ver [[recetas]] y también [[Nota que no existe]]."); err != nil {
		t.Fatalf("put content: %v", err)
	}

	backlinks, err := s.GetBacklinks("u1", "target")
	if err != nil {
		t.Fatalf("get backlinks: %v", err)
	}
	if len(backlinks) != 1 {
		t.Fatalf("expected the case-insensitive match to resolve, got %+v", backlinks)
	}
}

func TestReindexLinksDropsStaleLinksOnResave(t *testing.T) {
	s := newTestStore(t)
	if _, err := s.CreateNode("u1", CreateNodeInput{ID: "target", Type: TypeNote, Title: "Recetas"}); err != nil {
		t.Fatalf("create target: %v", err)
	}
	if _, err := s.CreateNode("u1", CreateNodeInput{ID: "source", Type: TypeNote, Title: "Hoy"}); err != nil {
		t.Fatalf("create source: %v", err)
	}
	if _, err := s.PutNoteContent("u1", "source", "Enlaza a [[Recetas]]."); err != nil {
		t.Fatalf("put content: %v", err)
	}
	if _, err := s.PutNoteContent("u1", "source", "Ya no enlaza a nada."); err != nil {
		t.Fatalf("put content again: %v", err)
	}

	backlinks, err := s.GetBacklinks("u1", "target")
	if err != nil {
		t.Fatalf("get backlinks: %v", err)
	}
	if len(backlinks) != 0 {
		t.Fatalf("expected the removed link to disappear, got %+v", backlinks)
	}
}

func TestNoSelfLinks(t *testing.T) {
	s := newTestStore(t)
	if _, err := s.CreateNode("u1", CreateNodeInput{ID: "n1", Type: TypeNote, Title: "Sola"}); err != nil {
		t.Fatalf("create: %v", err)
	}
	if _, err := s.PutNoteContent("u1", "n1", "Me refiero a mí misma: [[Sola]]."); err != nil {
		t.Fatalf("put content: %v", err)
	}
	backlinks, err := s.GetBacklinks("u1", "n1")
	if err != nil {
		t.Fatalf("get backlinks: %v", err)
	}
	if len(backlinks) != 0 {
		t.Fatalf("expected no self-link, got %+v", backlinks)
	}
}
