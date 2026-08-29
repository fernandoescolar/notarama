import { useMemo, useState, type DragEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { buildTree, useTree } from './useTree'
import { SidebarContext, type SidebarCtxValue } from './SidebarContext'
import { TreeItem } from './TreeItem'
import { computeDropTarget, type DropZone } from './dnd'
import { createNode, deleteNode, moveNode, renameNode } from '../../lib/localStore'
import { ROOT, type NodeRecord } from '../../lib/db'
import { FilePlusIcon, FolderPlusIcon, LogOutIcon, SearchIcon, SparklesIcon, TrashIcon, XIcon } from '../../components/icons'
import { ThemeToggle } from '../theme/ThemeToggle'
import { LanguageToggle } from '../language/LanguageToggle'
import { useTranslation } from '../language/LanguageContext'
import type { Me } from '../../lib/types'
import { api } from '../../lib/api'

function iconButtonClass(extra = '') {
  return [
    'rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-200/70 hover:text-zinc-800',
    'dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
    extra,
  ].join(' ')
}

export function Sidebar({
  me,
  onOpenSearch,
  onOpenTrash,
  open,
  onClose,
}: {
  me: Me
  onOpenSearch: () => void
  onOpenTrash: () => void
  open: boolean
  onClose: () => void
}) {
  const t = useTranslation()
  const nodes = useTree()
  const navigate = useNavigate()
  const params = useParams<{ id: string }>()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: string; zone: DropZone } | null>(null)
  const [rootDragOver, setRootDragOver] = useState(false)

  const tree = useMemo(() => buildTree(nodes ?? []), [nodes])

  async function handleCreateChild(parentId: string | null, type: 'folder' | 'note') {
    const node = await createNode({ parentId, type, title: type === 'folder' ? t.sidebar.newFolder : t.sidebar.newNote })
    if (parentId) setExpanded((s) => new Set(s).add(parentId))
    setEditingId(node.id)
    if (type === 'note') {
      navigate(`/n/${node.id}`)
      onClose()
    }
  }

  async function handleDelete(id: string) {
    const node = nodes?.find((n) => n.id === id)
    const label = node?.title || t.common.thisItem
    if (!window.confirm(t.sidebar.confirmDelete(label))) return
    await deleteNode(id)
    if (params.id === id) navigate('/')
  }

  function handleDrop() {
    if (!dragId || !dropTarget || !nodes) {
      setDragId(null)
      setDropTarget(null)
      return
    }
    const result = computeDropTarget(nodes, dragId, dropTarget.id, dropTarget.zone)
    if (result) void moveNode(dragId, result.parentId === ROOT ? null : result.parentId, result.position)
    setDragId(null)
    setDropTarget(null)
  }

  function handleRootDrop(e: DragEvent) {
    e.preventDefault()
    setRootDragOver(false)
    if (!dragId || !nodes) return
    const rootSiblings = nodes.filter((n) => n.parentId === ROOT && n.id !== dragId)
    const last = rootSiblings.sort((a, b) => a.position - b.position).at(-1)
    void moveNode(dragId, null, last ? last.position + 1000 : 1000)
    setDragId(null)
    setDropTarget(null)
  }

  const ctx: SidebarCtxValue = {
    nodes: nodes ?? [],
    selectedId: params.id ?? null,
    expanded,
    toggleExpand: (id) =>
      setExpanded((s) => {
        const next = new Set(s)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      }),
    editingId,
    setEditingId,
    onSelect: (node: NodeRecord) => {
      if (node.type === 'note') {
        navigate(`/n/${node.id}`)
        onClose()
      }
    },
    onCreateChild: handleCreateChild,
    onDelete: handleDelete,
    onRename: (id, title) => void renameNode(id, title),
    dragId,
    dropTarget,
    onDragStart: setDragId,
    onDragOverItem: (id, zone) => setDropTarget({ id, zone }),
    onDrop: handleDrop,
    onDragEnd: () => {
      setDragId(null)
      setDropTarget(null)
    },
  }

  const initial = (me.name || me.email || '?').trim().charAt(0).toUpperCase()

  return (
    <aside
      className={[
        'fixed inset-y-0 left-0 z-40 flex h-full w-72 max-w-[85vw] shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 transition-transform duration-200 ease-out',
        'md:static md:z-auto md:translate-x-0 md:bg-zinc-50/60 md:transition-none',
        'dark:border-zinc-800 dark:bg-zinc-900 md:dark:bg-zinc-900/40',
        open ? 'translate-x-0 shadow-2xl md:shadow-none' : '-translate-x-full',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-1 border-b border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          <span className="flex size-5 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
            <SparklesIcon size={11} />
          </span>
          Notarama
        </span>
        <div className="flex items-center gap-0.5">
          <button
            title={t.sidebar.search}
            onClick={() => {
              // On mobile the sidebar is a full overlay sitting above the
              // search modal's own backdrop, so close it first or its edges
              // stay visible/dimmed around the (narrower) search box.
              onClose()
              onOpenSearch()
            }}
            className={iconButtonClass()}
          >
            <SearchIcon size={15} />
          </button>
          <button title={t.sidebar.newNote} onClick={() => handleCreateChild(null, 'note')} className={iconButtonClass()}>
            <FilePlusIcon size={15} />
          </button>
          <button title={t.sidebar.newFolder} onClick={() => handleCreateChild(null, 'folder')} className={iconButtonClass()}>
            <FolderPlusIcon size={15} />
          </button>
          <button
            title={t.sidebar.trash}
            onClick={() => {
              onClose()
              onOpenTrash()
            }}
            className={iconButtonClass()}
          >
            <TrashIcon size={15} />
          </button>
          <button title={t.sidebar.closeMenu} onClick={onClose} className={iconButtonClass('md:hidden')}>
            <XIcon size={15} />
          </button>
        </div>
      </div>

      <SidebarContext.Provider value={ctx}>
        <div
          className="themed-scroll min-h-0 flex-1 overflow-y-auto px-2 py-2"
          onDragOver={(e) => {
            e.preventDefault()
            setRootDragOver(true)
          }}
          onDragLeave={() => setRootDragOver(false)}
          onDrop={handleRootDrop}
        >
          {tree.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-zinc-400 dark:text-zinc-600">{t.sidebar.empty}</p>
          ) : (
            tree.map((node) => <TreeItem key={node.id} node={node} depth={0} />)
          )}
          <div className={`h-8 rounded-lg ${rootDragOver && dragId ? 'tree-drag-over' : ''}`} />
        </div>
      </SidebarContext.Provider>

      <div className="flex items-center justify-between gap-2 border-t border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
            {initial}
          </span>
          <span className="min-w-0 truncate text-xs font-medium text-zinc-600 dark:text-zinc-400" title={me.email}>
            {me.name}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
          <button
            title={t.sidebar.logout}
            onClick={() => api.logout().finally(() => window.location.assign('/'))}
            className={iconButtonClass()}
          >
            <LogOutIcon size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}
