package notes

import "testing"

func TestSoftDeletedFolderAppearsAsSingleTrashRoot(t *testing.T) {
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

	trash, err := s.ListTrash("u1")
	if err != nil {
		t.Fatalf("list trash: %v", err)
	}
	if len(trash) != 1 || trash[0].ID != folderID {
		t.Fatalf("expected only the folder to appear as trash root, got %+v", trash)
	}
}

func TestRestoreBringsBackNodeAndDescendants(t *testing.T) {
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

	if _, err := s.Restore("u1", folderID); err != nil {
		t.Fatalf("restore: %v", err)
	}

	tree, err := s.ListTree("u1")
	if err != nil {
		t.Fatalf("list tree: %v", err)
	}
	if len(tree) != 2 {
		t.Fatalf("expected both nodes restored and visible, got %d", len(tree))
	}

	trash, err := s.ListTrash("u1")
	if err != nil {
		t.Fatalf("list trash: %v", err)
	}
	if len(trash) != 0 {
		t.Fatalf("expected trash to be empty after restore, got %+v", trash)
	}
}

func TestRestoreReparentsToRootWhenParentStillDeleted(t *testing.T) {
	s := newTestStore(t)
	parentID := "parent1"
	childID := "child1"
	if _, err := s.CreateNode("u1", CreateNodeInput{ID: parentID, Type: TypeFolder, Title: "Parent"}); err != nil {
		t.Fatalf("create parent: %v", err)
	}
	if _, err := s.CreateNode("u1", CreateNodeInput{ID: childID, ParentID: &parentID, Type: TypeFolder, Title: "Child"}); err != nil {
		t.Fatalf("create child: %v", err)
	}
	// Delete just the child directly (simulating a state where its parent
	// later got independently deleted and stays deleted).
	if err := s.SoftDelete("u1", childID); err != nil {
		t.Fatalf("soft delete child: %v", err)
	}
	if err := s.SoftDelete("u1", parentID); err != nil {
		t.Fatalf("soft delete parent: %v", err)
	}

	restored, err := s.Restore("u1", childID)
	if err != nil {
		t.Fatalf("restore child: %v", err)
	}
	if restored.ParentID != nil {
		t.Fatalf("expected child to be reparented to root since its parent is still deleted, got parentId=%v", *restored.ParentID)
	}
}

func TestPermanentlyDeleteRemovesFromTrashForGood(t *testing.T) {
	s := newTestStore(t)
	if _, err := s.CreateNode("u1", CreateNodeInput{ID: "n1", Type: TypeNote, Title: "Gone"}); err != nil {
		t.Fatalf("create: %v", err)
	}
	if err := s.SoftDelete("u1", "n1"); err != nil {
		t.Fatalf("soft delete: %v", err)
	}
	if err := s.PermanentlyDelete("u1", "n1"); err != nil {
		t.Fatalf("permanently delete: %v", err)
	}

	if _, err := s.GetNode("u1", "n1"); err != ErrNotFound {
		t.Fatalf("expected ErrNotFound after permanent delete, got %v", err)
	}
	trash, err := s.ListTrash("u1")
	if err != nil {
		t.Fatalf("list trash: %v", err)
	}
	if len(trash) != 0 {
		t.Fatalf("expected empty trash, got %+v", trash)
	}
}

func TestEmptyTrashRemovesEverythingDeleted(t *testing.T) {
	s := newTestStore(t)
	if _, err := s.CreateNode("u1", CreateNodeInput{ID: "n1", Type: TypeNote, Title: "A"}); err != nil {
		t.Fatalf("create n1: %v", err)
	}
	if _, err := s.CreateNode("u1", CreateNodeInput{ID: "n2", Type: TypeNote, Title: "B"}); err != nil {
		t.Fatalf("create n2: %v", err)
	}
	if err := s.SoftDelete("u1", "n1"); err != nil {
		t.Fatalf("delete n1: %v", err)
	}
	if err := s.SoftDelete("u1", "n2"); err != nil {
		t.Fatalf("delete n2: %v", err)
	}

	if err := s.EmptyTrash("u1"); err != nil {
		t.Fatalf("empty trash: %v", err)
	}
	trash, err := s.ListTrash("u1")
	if err != nil {
		t.Fatalf("list trash: %v", err)
	}
	if len(trash) != 0 {
		t.Fatalf("expected empty trash, got %+v", trash)
	}
}
