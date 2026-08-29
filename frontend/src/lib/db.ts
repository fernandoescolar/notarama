import Dexie, { type Table } from 'dexie'

// Local mirror of the server's nodes/note_content tables (see
// internal/db/sql/0001_init.sql), used so the whole UI can read and write
// against IndexedDB directly and work offline. `dirty` marks rows the sync
// engine still needs to push to the server. `parentId` uses '' as a
// sentinel for "root" instead of null, purely so Dexie can index/query it
// (`.where('parentId').equals('')`) without any ambiguity around IDB null
// handling; it is translated to/from JSON `null` at the API boundary.
export const ROOT = ''

export interface NodeRecord {
  id: string
  parentId: string
  type: 'folder' | 'note'
  title: string
  position: number
  createdAt: number
  updatedAt: number
  deletedAt: number | null
  dirty: 0 | 1
}

export interface NoteContentRecord {
  nodeId: string
  contentMd: string
  updatedAt: number
  dirty: 0 | 1
}

export interface MetaRecord {
  key: string
  value: number
}

class NotaramaDB extends Dexie {
  nodes!: Table<NodeRecord, string>
  noteContent!: Table<NoteContentRecord, string>
  meta!: Table<MetaRecord, string>

  constructor() {
    super('notarama')
    this.version(1).stores({
      nodes: 'id, parentId, [parentId+position], dirty, deletedAt',
      noteContent: 'nodeId, dirty',
      meta: 'key',
    })
  }
}

export const db = new NotaramaDB()

export async function getLastSyncTime(): Promise<number> {
  const row = await db.meta.get('lastSyncTime')
  return row?.value ?? 0
}

export async function setLastSyncTime(value: number): Promise<void> {
  await db.meta.put({ key: 'lastSyncTime', value })
}

export async function clearLocalDatabase(): Promise<void> {
  await db.transaction('rw', db.nodes, db.noteContent, db.meta, async () => {
    await db.nodes.clear()
    await db.noteContent.clear()
    await db.meta.clear()
  })
}
