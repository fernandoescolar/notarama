export type NodeType = 'folder' | 'note'

// Wire format (matches the Go backend's JSON), using `null` for "no parent".
export interface NodeDTO {
  id: string
  parentId: string | null
  type: NodeType
  title: string
  position: number
  createdAt: number
  updatedAt: number
  deletedAt?: number | null
}

export interface NoteContentDTO {
  nodeId: string
  contentMd: string
  updatedAt: number
}

export interface Me {
  id: string
  email: string
  name: string
  csrfToken: string
}

export interface SearchResult {
  nodeId: string
  title: string
  snippet: string
}

export interface Backlink {
  id: string
  title: string
}

export interface TrashedNode {
  id: string
  type: NodeType
  title: string
  deletedAt: number
}
