import { db, ROOT, type NodeRecord } from './db'
import { positionAfter } from './position'
import { scheduleSync, syncNow } from './sync'

function newId(): string {
  return crypto.randomUUID()
}

async function lastSiblingPosition(parentId: string): Promise<number | null> {
  const siblings = await db.nodes
    .where('parentId')
    .equals(parentId)
    .filter((n) => n.deletedAt == null)
    .toArray()
  if (siblings.length === 0) return null
  return Math.max(...siblings.map((s) => s.position))
}

export interface CreateNodeInput {
  parentId: string | null
  type: 'folder' | 'note'
  title: string
  position?: number
}

export async function createNode(input: CreateNodeInput): Promise<NodeRecord> {
  const parentId = input.parentId ?? ROOT
  const position = input.position ?? positionAfter(await lastSiblingPosition(parentId))
  const now = Date.now()
  const record: NodeRecord = {
    id: newId(),
    parentId,
    type: input.type,
    title: input.title,
    position,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    dirty: 1,
  }
  await db.nodes.put(record)
  if (input.type === 'note') {
    await db.noteContent.put({ nodeId: record.id, contentMd: '', updatedAt: now, dirty: 1 })
  }
  scheduleSync(300)
  return record
}

export async function renameNode(id: string, title: string): Promise<void> {
  const now = Date.now()
  await db.nodes.update(id, { title, updatedAt: now, dirty: 1 })
  scheduleSync()
}

export async function moveNode(id: string, parentId: string | null, position: number): Promise<void> {
  const now = Date.now()
  await db.nodes.update(id, { parentId: parentId ?? ROOT, position, updatedAt: now, dirty: 1 })
  scheduleSync(300)
}

/** Soft-deletes a node and every descendant, mirroring the backend's cascade. */
export async function deleteNode(id: string): Promise<void> {
  const now = Date.now()
  const all = await db.nodes.toArray()
  const byParent = new Map<string, NodeRecord[]>()
  for (const n of all) {
    const list = byParent.get(n.parentId) ?? []
    list.push(n)
    byParent.set(n.parentId, list)
  }

  const toDelete: string[] = []
  const stack = [id]
  while (stack.length) {
    const cur = stack.pop()!
    toDelete.push(cur)
    for (const child of byParent.get(cur) ?? []) stack.push(child.id)
  }

  await db.transaction('rw', db.nodes, async () => {
    for (const nid of toDelete) {
      await db.nodes.update(nid, { deletedAt: now, updatedAt: now, dirty: 1 })
    }
  })
  scheduleSync(300)
}

export async function putNoteContent(nodeId: string, contentMd: string): Promise<void> {
  const now = Date.now()
  await db.noteContent.put({ nodeId, contentMd, updatedAt: now, dirty: 1 })
  await db.nodes.update(nodeId, { updatedAt: now, dirty: 1 })
  scheduleSync()
}

/** Forces an immediate sync (e.g. right before navigating away or closing the editor). */
export function flushSync(): Promise<void> {
  return syncNow()
}
