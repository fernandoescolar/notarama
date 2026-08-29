import { api, type SyncChange } from './api'
import { db, getLastSyncTime, setLastSyncTime, ROOT, type NodeRecord, type NoteContentRecord } from './db'

let syncing = false
let queued = false
let debounceTimer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()

export function onSyncActivity(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function notify() {
  for (const cb of listeners) cb()
}

function toWire(n: NodeRecord): SyncChange {
  return {
    id: n.id,
    parentId: n.parentId === ROOT ? null : n.parentId,
    type: n.type,
    title: n.title,
    position: n.position,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
    deletedAt: n.deletedAt,
  }
}

async function push(): Promise<void> {
  const dirtyNodes = await db.nodes.where('dirty').equals(1).toArray()
  const dirtyNotes = await db.noteContent.where('dirty').equals(1).toArray()
  if (dirtyNodes.length === 0 && dirtyNotes.length === 0) return

  await api.syncPush({
    nodes: dirtyNodes.map(toWire),
    notes: dirtyNotes.map((c) => ({ nodeId: c.nodeId, contentMd: c.contentMd, updatedAt: c.updatedAt })),
  })

  // Clear the dirty flag only for rows that haven't been edited again since
  // we read them (an edit during the request keeps dirty=1 for the next push).
  await db.transaction('rw', db.nodes, db.noteContent, async () => {
    for (const n of dirtyNodes) {
      const cur = await db.nodes.get(n.id)
      if (cur && cur.updatedAt === n.updatedAt) await db.nodes.update(n.id, { dirty: 0 })
    }
    for (const c of dirtyNotes) {
      const cur = await db.noteContent.get(c.nodeId)
      if (cur && cur.updatedAt === c.updatedAt) await db.noteContent.update(c.nodeId, { dirty: 0 })
    }
  })
}

async function pull(): Promise<void> {
  const since = await getLastSyncTime()
  const resp = await api.syncPull(since)

  await db.transaction('rw', db.nodes, db.noteContent, db.meta, async () => {
    for (const n of resp.nodes) {
      if (n.deletedAt) {
        await db.nodes.delete(n.id)
        continue
      }
      const local = await db.nodes.get(n.id)
      if (local && local.dirty === 1 && local.updatedAt > n.updatedAt) continue // local edit still wins for now
      const record: NodeRecord = {
        id: n.id,
        parentId: n.parentId ?? ROOT,
        type: n.type as NodeRecord['type'],
        title: n.title,
        position: n.position,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        deletedAt: n.deletedAt,
        dirty: 0,
      }
      await db.nodes.put(record)
    }

    for (const c of resp.notes) {
      const local = await db.noteContent.get(c.nodeId)
      if (local && local.dirty === 1 && local.updatedAt > c.updatedAt) continue
      const record: NoteContentRecord = { nodeId: c.nodeId, contentMd: c.contentMd, updatedAt: c.updatedAt, dirty: 0 }
      await db.noteContent.put(record)
    }

    await setLastSyncTime(resp.serverTime)
  })
}

export async function syncNow(): Promise<void> {
  if (syncing) {
    queued = true
    return
  }
  syncing = true
  try {
    await push()
    await pull()
  } catch (err) {
    // Offline or the server is unreachable — the dirty rows stay queued and
    // we'll retry on the next interval tick or 'online' event.
    console.warn('sync failed, will retry', err)
  } finally {
    syncing = false
    notify()
    if (queued) {
      queued = false
      void syncNow()
    }
  }
}

/** Debounced trigger for use after local mutations (batches rapid edits). */
export function scheduleSync(delayMs = 1200): void {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void syncNow()
  }, delayMs)
}

let started = false

export function startSyncLoop(): void {
  if (started) return
  started = true
  void syncNow()
  window.addEventListener('online', () => void syncNow())
  setInterval(() => void syncNow(), 30_000)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow()
  })
}
