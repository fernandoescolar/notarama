import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { db } from '../../lib/db'
import type { Backlink } from '../../lib/types'

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function localFallbackBacklinks(nodeId: string): Promise<Backlink[]> {
  const node = await db.nodes.get(nodeId)
  const title = node?.title.trim()
  if (!title) return []

  const pattern = new RegExp(`\\[\\[\\s*${escapeRegExp(title)}\\s*\\]\\]`, 'i')
  const [nodes, notes] = await Promise.all([db.nodes.toArray(), db.noteContent.toArray()])
  const contentByNode = new Map(notes.map((n) => [n.nodeId, n.contentMd]))

  return nodes
    .filter((n) => n.type === 'note' && n.deletedAt == null && n.id !== nodeId)
    .filter((n) => pattern.test(contentByNode.get(n.id) ?? ''))
    .map((n) => ({ id: n.id, title: n.title }))
}

/** Notes linking to this one — server-authoritative, with an offline local scan as fallback (mirrors search). */
export function useBacklinks(nodeId: string): { backlinks: Backlink[]; offline: boolean } {
  const [backlinks, setBacklinks] = useState<Backlink[]>([])
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    let cancelled = false
    api
      .getBacklinks(nodeId)
      .then((res) => {
        if (!cancelled) {
          setOffline(false)
          setBacklinks(res)
        }
      })
      .catch(async () => {
        const res = await localFallbackBacklinks(nodeId)
        if (!cancelled) {
          setOffline(true)
          setBacklinks(res)
        }
      })
    return () => {
      cancelled = true
    }
  }, [nodeId])

  return { backlinks, offline }
}
