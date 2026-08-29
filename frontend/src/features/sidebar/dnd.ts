import { ROOT, type NodeRecord } from '../../lib/db'
import { positionAfter, positionBefore, positionBetween } from '../../lib/position'

export type DropZone = 'before' | 'after' | 'into'

export interface DropTarget {
  parentId: string
  position: number
}

function siblingsOf(nodes: NodeRecord[], parentId: string, excludeId: string): NodeRecord[] {
  return nodes
    .filter((n) => n.parentId === parentId && n.id !== excludeId)
    .sort((a, b) => a.position - b.position)
}

/** A node cannot be dropped into itself or one of its own descendants. */
export function isDescendant(nodes: NodeRecord[], ancestorId: string, candidateId: string): boolean {
  let cur = nodes.find((n) => n.id === candidateId)
  while (cur) {
    if (cur.parentId === ancestorId) return true
    if (cur.parentId === ROOT) return false
    cur = nodes.find((n) => n.id === cur!.parentId)
  }
  return false
}

export function computeDropTarget(
  nodes: NodeRecord[],
  draggedId: string,
  targetId: string,
  zone: DropZone,
): DropTarget | null {
  const target = nodes.find((n) => n.id === targetId)
  const dragged = nodes.find((n) => n.id === draggedId)
  if (!target || !dragged) return null
  if (targetId === draggedId) return null

  if (zone === 'into') {
    if (target.type !== 'folder') return null
    if (isDescendant(nodes, draggedId, targetId) || draggedId === targetId) return null
    const children = siblingsOf(nodes, targetId, draggedId)
    const last = children.at(-1)
    return { parentId: targetId, position: positionAfter(last?.position ?? null) }
  }

  const parentId = target.parentId
  if (isDescendant(nodes, draggedId, parentId) || parentId === draggedId) return null
  const siblings = siblingsOf(nodes, parentId, draggedId)
  const idx = siblings.findIndex((n) => n.id === targetId)
  if (idx === -1) return null

  if (zone === 'before') {
    const prev = siblings[idx - 1]
    if (!prev) return { parentId, position: positionBefore(target.position) }
    return { parentId, position: positionBetween(prev.position, target.position) }
  }

  // zone === 'after'
  const next = siblings[idx + 1]
  if (!next) return { parentId, position: positionAfter(target.position) }
  return { parentId, position: positionBetween(target.position, next.position) }
}
