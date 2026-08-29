import { useLiveQuery } from 'dexie-react-hooks'
import { db, ROOT, type NodeRecord } from '../../lib/db'

export function useTree(): NodeRecord[] | undefined {
  return useLiveQuery(() => db.nodes.filter((n) => n.deletedAt == null).toArray(), [])
}

export interface TreeNode extends NodeRecord {
  children: TreeNode[]
}

/** Builds a nested tree (siblings sorted by position) from the flat Dexie rows. */
export function buildTree(nodes: NodeRecord[]): TreeNode[] {
  const byParent = new Map<string, NodeRecord[]>()
  for (const n of nodes) {
    const list = byParent.get(n.parentId) ?? []
    list.push(n)
    byParent.set(n.parentId, list)
  }
  for (const list of byParent.values()) list.sort((a, b) => a.position - b.position)

  function attach(parentId: string): TreeNode[] {
    return (byParent.get(parentId) ?? []).map((n) => ({ ...n, children: attach(n.id) }))
  }

  return attach(ROOT)
}
