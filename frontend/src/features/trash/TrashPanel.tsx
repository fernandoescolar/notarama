import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { syncNow } from '../../lib/sync'
import type { TrashedNode } from '../../lib/types'
import { FileIcon, FolderIcon, TrashIcon, XIcon } from '../../components/icons'
import { useTranslation, type Translations } from '../language/LanguageContext'
import type { RelativeUnit } from '../../lib/i18n/es'

function relativeTime(ms: number, t: Translations): string {
  const diffSec = Math.round((Date.now() - ms) / 1000)
  const units: [number, RelativeUnit][] = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [7, 'day'],
    [4.345, 'week'],
    [12, 'month'],
    [Number.POSITIVE_INFINITY, 'year'],
  ]
  let value = diffSec
  for (const [factor, unit] of units) {
    if (value < factor) {
      return t.trash.relativeTime(Math.max(0, Math.floor(value)), unit)
    }
    value /= factor
  }
  return ''
}

export function TrashPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslation()
  const [items, setItems] = useState<TrashedNode[] | null>(null)
  const [error, setError] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  function reload() {
    setError(false)
    api
      .listTrash()
      .then(setItems)
      .catch(() => setError(true))
  }

  useEffect(reload, [])

  async function handleRestore(id: string) {
    setBusyId(id)
    try {
      await api.restoreNode(id)
      await syncNow()
      reload()
    } catch {
      window.alert(t.trash.restoreError)
    } finally {
      setBusyId(null)
    }
  }

  async function handlePermanentDelete(id: string, title: string) {
    if (!window.confirm(t.trash.confirmPermanentDelete(title || t.common.thisItem))) return
    setBusyId(id)
    try {
      await api.permanentlyDeleteNode(id)
      reload()
    } catch {
      window.alert(t.trash.deleteError)
    } finally {
      setBusyId(null)
    }
  }

  async function handleEmptyTrash() {
    if (!items?.length) return
    if (!window.confirm(t.trash.confirmEmptyTrash(items.length))) return
    try {
      await api.emptyTrash()
      reload()
    } catch {
      window.alert(t.trash.emptyTrashError)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-zinc-950/40 px-3 pt-16 backdrop-blur-[2px] md:pt-24" onClick={onClose}>
      <div
        className="flex max-h-[65vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <span className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            <TrashIcon size={15} className="text-zinc-400" />
            {t.trash.title}
          </span>
          <div className="flex items-center gap-1">
            {!!items?.length && (
              <button
                onClick={handleEmptyTrash}
                className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                {t.trash.emptyTrashButton}
              </button>
            )}
            <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <XIcon size={14} />
            </button>
          </div>
        </div>

        <div className="themed-scroll min-h-0 flex-1 overflow-y-auto">
          {error ? (
            <p className="px-4 py-6 text-center text-sm text-zinc-400 dark:text-zinc-600">{t.trash.loadError}</p>
          ) : items === null ? (
            <p className="px-4 py-6 text-center text-sm text-zinc-400 dark:text-zinc-600">{t.trash.loading}</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-zinc-400 dark:text-zinc-600">{t.trash.empty}</p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-2 px-4 py-2.5">
                  {item.type === 'folder' ? (
                    <FolderIcon size={15} className="shrink-0 text-zinc-400" />
                  ) : (
                    <FileIcon size={15} className="shrink-0 text-zinc-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{item.title || t.common.untitled}</p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-600">{relativeTime(item.deletedAt, t)}</p>
                  </div>
                  <button
                    disabled={busyId === item.id}
                    onClick={() => handleRestore(item.id)}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-violet-600 transition-colors hover:bg-violet-50 disabled:opacity-50 dark:text-violet-400 dark:hover:bg-violet-500/10"
                  >
                    {t.trash.restore}
                  </button>
                  <button
                    disabled={busyId === item.id}
                    onClick={() => handlePermanentDelete(item.id, item.title)}
                    className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                    title={t.trash.permanentDelete}
                  >
                    <TrashIcon size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
