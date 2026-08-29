import { createContext, useContext } from 'react'
import type { NodeRecord } from '../../lib/db'
import type { DropZone } from './dnd'

export interface SidebarCtxValue {
  nodes: NodeRecord[]
  selectedId: string | null
  expanded: Set<string>
  toggleExpand: (id: string) => void
  editingId: string | null
  setEditingId: (id: string | null) => void
  onSelect: (node: NodeRecord) => void
  onCreateChild: (parentId: string | null, type: 'folder' | 'note') => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
  dragId: string | null
  dropTarget: { id: string; zone: DropZone } | null
  onDragStart: (id: string) => void
  onDragOverItem: (id: string, zone: DropZone) => void
  onDrop: () => void
  onDragEnd: () => void
}

export const SidebarContext = createContext<SidebarCtxValue | null>(null)

export function useSidebarCtx(): SidebarCtxValue {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error('useSidebarCtx must be used within SidebarContext.Provider')
  return ctx
}
