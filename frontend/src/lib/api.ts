import type { Backlink, Me, NodeDTO, NoteContentDTO, SearchResult, TrashedNode } from './types'

let csrfToken: string | null = null

export function setCsrfToken(token: string) {
  csrfToken = token
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

class UnauthorizedError extends Error {
  constructor() {
    super('unauthorized')
  }
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const method = (opts.method ?? 'GET').toUpperCase()
  const headers = new Headers(opts.headers)
  if (MUTATING.has(method) && csrfToken) {
    headers.set('X-CSRF-Token', csrfToken)
  }
  if (opts.body != null && !(opts.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(path, { ...opts, method, headers, credentials: 'same-origin' })

  if (res.status === 401) {
    throw new UnauthorizedError()
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${method} ${path} failed: ${res.status} ${body}`)
  }
  if (res.status === 204) {
    return undefined as T
  }
  return (await res.json()) as T
}

export interface CreateNodeBody {
  id: string
  parentId: string | null
  type: 'folder' | 'note'
  title: string
  position?: number
}

export interface PatchNodeBody {
  title?: string
  parentId?: string | null
  position?: number
}

export interface SyncChange {
  id: string
  parentId: string | null
  type: string
  title: string
  position: number
  createdAt: number
  updatedAt: number
  deletedAt: number | null
}

export interface SyncNoteChange {
  nodeId: string
  contentMd: string
  updatedAt: number
}

export interface SyncPullResponse {
  nodes: SyncChange[]
  notes: SyncNoteChange[]
  serverTime: number
}

export const api = {
  me: () => request<Me>('/api/me'),
  tree: () => request<NodeDTO[]>('/api/tree'),
  createNode: (body: CreateNodeBody) =>
    request<NodeDTO>('/api/nodes', { method: 'POST', body: JSON.stringify(body) }),
  patchNode: (id: string, body: PatchNodeBody) =>
    request<NodeDTO>(`/api/nodes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteNode: (id: string) => request<void>(`/api/nodes/${id}`, { method: 'DELETE' }),
  getNoteContent: (id: string) => request<NoteContentDTO>(`/api/notes/${id}`),
  putNoteContent: (id: string, contentMd: string) =>
    request<NoteContentDTO>(`/api/notes/${id}/content`, {
      method: 'PUT',
      body: JSON.stringify({ contentMd }),
    }),
  search: (q: string) => request<SearchResult[]>(`/api/search?q=${encodeURIComponent(q)}`),
  getBacklinks: (id: string) => request<Backlink[]>(`/api/notes/${id}/backlinks`),
  listTrash: () => request<TrashedNode[]>('/api/trash'),
  restoreNode: (id: string) => request<NodeDTO>(`/api/trash/${id}/restore`, { method: 'POST' }),
  permanentlyDeleteNode: (id: string) => request<void>(`/api/trash/${id}`, { method: 'DELETE' }),
  emptyTrash: () => request<void>('/api/trash', { method: 'DELETE' }),
  upload: (file: File, nodeId: string) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('nodeId', nodeId)
    return request<{ id: string; url: string }>('/api/uploads', { method: 'POST', body: fd })
  },
  syncPull: (since: number) => request<SyncPullResponse>(`/api/sync?since=${since}`),
  syncPush: (body: { nodes: SyncChange[]; notes: SyncNoteChange[] }) =>
    request<void>('/api/sync', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
}

export { UnauthorizedError }
