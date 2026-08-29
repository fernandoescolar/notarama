package notes

type NodeType string

const (
	TypeFolder NodeType = "folder"
	TypeNote   NodeType = "note"
)

type Node struct {
	ID        string   `json:"id"`
	UserID    string   `json:"-"`
	ParentID  *string  `json:"parentId"`
	Type      NodeType `json:"type"`
	Title     string   `json:"title"`
	Position  float64  `json:"position"`
	CreatedAt int64    `json:"createdAt"`
	UpdatedAt int64    `json:"updatedAt"`
	DeletedAt *int64   `json:"deletedAt,omitempty"`
}

type NoteContent struct {
	NodeID    string `json:"nodeId"`
	ContentMD string `json:"contentMd"`
	UpdatedAt int64  `json:"updatedAt"`
}

type Attachment struct {
	ID        string `json:"id"`
	NodeID    string `json:"nodeId"`
	Filename  string `json:"filename"`
	Mime      string `json:"mime"`
	Size      int64  `json:"size"`
	CreatedAt int64  `json:"createdAt"`
}
