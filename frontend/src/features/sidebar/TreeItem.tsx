import { useEffect, useRef, useState, type DragEvent } from 'react'
import { ChevronRightIcon, FileIcon, FilePlusIcon, FolderIcon, FolderPlusIcon, TrashIcon } from '../../components/icons'
import type { TreeNode } from './useTree'
import { useSidebarCtx } from './SidebarContext'
import type { DropZone } from './dnd'
import { useTranslation } from '../language/LanguageContext'

export function TreeItem({ node, depth }: { node: TreeNode; depth: number }) {
  const ctx = useSidebarCtx()
  const t = useTranslation()
  const isFolder = node.type === 'folder'
  const isExpanded = ctx.expanded.has(node.id)
  const isSelected = ctx.selectedId === node.id
  const isEditing = ctx.editingId === node.id
  const isDragging = ctx.dragId === node.id
  const [hover, setHover] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [draftTitle, setDraftTitle] = useState(node.title)

  useEffect(() => {
    if (isEditing) {
      setDraftTitle(node.title)
      inputRef.current?.focus()
      inputRef.current?.select()
    }
    // Only re-run when edit mode is toggled on/off, not on every title change
    // (which would steal focus back while the user is actively typing).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing])

  const zone = ctx.dropTarget?.id === node.id ? ctx.dropTarget.zone : null

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    // Stop the sidebar's root-level drop zone from also seeing this
    // dragover (it would otherwise show its own "drop at root" highlight
    // while hovering directly over a row).
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const offsetY = e.clientY - rect.top
    const ratio = offsetY / rect.height
    let z: DropZone
    if (isFolder && ratio > 0.25 && ratio < 0.75) z = 'into'
    else if (ratio <= 0.5) z = 'before'
    else z = 'after'
    ctx.onDragOverItem(node.id, z)
  }

  return (
    <div>
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move'
          ctx.onDragStart(node.id)
        }}
        onDragOver={handleDragOver}
        onDrop={(e) => {
          e.preventDefault()
          // Without this, the drop would also bubble to the sidebar's
          // root-level drop zone and immediately move the node back to
          // root right after this handler placed it correctly.
          e.stopPropagation()
          ctx.onDrop()
        }}
        onDragEnd={ctx.onDragEnd}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => {
          if (isFolder) ctx.toggleExpand(node.id)
          ctx.onSelect(node)
        }}
        onDoubleClick={() => ctx.setEditingId(node.id)}
        className={[
          'group flex cursor-pointer items-center gap-1 rounded-lg px-1.5 py-1 text-sm transition-colors select-none',
          isSelected
            ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'
            : 'text-zinc-700 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800',
          isDragging ? 'opacity-40' : '',
          zone === 'into' ? 'tree-drag-over' : '',
        ].join(' ')}
        style={{
          paddingLeft: 6 + depth * 16,
          borderTop: zone === 'before' ? '2px solid #a78bfa' : '2px solid transparent',
          borderBottom: zone === 'after' ? '2px solid #a78bfa' : '2px solid transparent',
        }}
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-zinc-400 dark:text-zinc-500">
          {isFolder ? (
            <ChevronRightIcon
              className={isExpanded ? 'rotate-90 transition-transform' : 'transition-transform'}
              size={14}
            />
          ) : null}
        </span>
        <span className={`shrink-0 ${isSelected ? 'text-violet-500 dark:text-violet-400' : 'text-zinc-400 dark:text-zinc-500'}`}>
          {isFolder ? <FolderIcon size={15} /> : <FileIcon size={15} />}
        </span>

        {isEditing ? (
          <input
            ref={inputRef}
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={() => {
              ctx.onRename(node.id, draftTitle.trim() || t.common.untitled)
              ctx.setEditingId(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') {
                setDraftTitle(node.title)
                ctx.setEditingId(null)
              }
            }}
            className="min-w-0 flex-1 rounded-md border border-violet-300 bg-white px-1 py-0 text-sm text-zinc-900 outline-none dark:border-violet-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        ) : (
          <span className="min-w-0 flex-1 truncate">{node.title || t.common.untitled}</span>
        )}

        {hover && !isEditing && (
          <span className="flex shrink-0 items-center gap-0.5 text-zinc-400 dark:text-zinc-500">
            {isFolder && (
              <>
                <button
                  title={t.sidebar.newNote}
                  className="rounded-md p-0.5 hover:bg-zinc-300/60 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                  onClick={(e) => {
                    e.stopPropagation()
                    ctx.onCreateChild(node.id, 'note')
                  }}
                >
                  <FilePlusIcon size={13} />
                </button>
                <button
                  title={t.sidebar.newFolder}
                  className="rounded-md p-0.5 hover:bg-zinc-300/60 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                  onClick={(e) => {
                    e.stopPropagation()
                    ctx.onCreateChild(node.id, 'folder')
                  }}
                >
                  <FolderPlusIcon size={13} />
                </button>
              </>
            )}
            <button
              title={t.sidebar.delete}
              className="rounded-md p-0.5 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-500/20 dark:hover:text-red-400"
              onClick={(e) => {
                e.stopPropagation()
                ctx.onDelete(node.id)
              }}
            >
              <TrashIcon size={13} />
            </button>
          </span>
        )}
      </div>

      {isFolder && isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeItem key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}
