import type { NodeRecord } from '../../lib/db'
import { FileIcon, PlusIcon } from '../../components/icons'
import { useTranslation } from '../language/LanguageContext'

export function WikiLinkMenu({
  top,
  left,
  query,
  results,
  showCreate,
  selectedIndex,
  onSelect,
  onCreate,
}: {
  top: number
  left: number
  query: string
  results: NodeRecord[]
  showCreate: boolean
  selectedIndex: number
  onSelect: (note: NodeRecord) => void
  onCreate: () => void
}) {
  const t = useTranslation()
  return (
    <div
      className="fixed z-50 max-h-64 w-64 overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-2xl ring-1 ring-black/5 dark:border-zinc-800 dark:bg-zinc-900 dark:ring-white/10"
      style={{ top, left }}
    >
      {results.length === 0 && !showCreate && (
        <p className="px-3 py-2 text-xs text-zinc-400 dark:text-zinc-600">{t.wikiMenu.searchPrompt}</p>
      )}
      {results.map((note, i) => (
        <button
          key={note.id}
          onMouseDown={(e) => {
            e.preventDefault()
            onSelect(note)
          }}
          className={[
            'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors',
            i === selectedIndex
              ? 'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-300'
              : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
          ].join(' ')}
        >
          <FileIcon size={13} className="shrink-0 text-zinc-400" />
          <span className="truncate">{note.title || t.common.untitled}</span>
        </button>
      ))}
      {showCreate && (
        <button
          onMouseDown={(e) => {
            e.preventDefault()
            onCreate()
          }}
          className={[
            'flex w-full items-center gap-2 border-t border-zinc-100 px-3 py-1.5 text-left text-sm transition-colors dark:border-zinc-800',
            selectedIndex === results.length
              ? 'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-300'
              : 'text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-500/10',
          ].join(' ')}
        >
          <PlusIcon size={13} className="shrink-0" />
          <span className="truncate">{t.wikiMenu.createNote(query.trim())}</span>
        </button>
      )}
    </div>
  )
}
