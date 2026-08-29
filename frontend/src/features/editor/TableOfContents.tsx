import type { Editor } from '@tiptap/react'
import { scrollToHeading, type HeadingEntry } from './headings'
import { FileIcon, LinkIcon, ListIcon, XIcon } from '../../components/icons'
import type { Backlink } from '../../lib/types'
import { useTranslation } from '../language/LanguageContext'

function closeOnMobile(onClose: () => void) {
  // On mobile the panel overlays the note, so close it to reveal what was
  // just navigated/scrolled to; on desktop it's a static column and should
  // stay open for browsing more.
  if (window.matchMedia('(max-width: 767px)').matches) onClose()
}

export function TableOfContents({
  editor,
  headings,
  backlinks,
  backlinksOffline,
  onSelectBacklink,
  onClose,
}: {
  editor: Editor | null
  headings: HeadingEntry[]
  backlinks: Backlink[]
  backlinksOffline: boolean
  onSelectBacklink: (id: string) => void
  onClose: () => void
}) {
  const t = useTranslation()
  return (
    <aside
      className={[
        'fixed inset-y-0 right-0 z-40 flex h-full w-72 max-w-[85vw] shrink-0 flex-col border-l border-zinc-200 bg-zinc-50 shadow-2xl',
        'md:static md:z-auto md:w-56 md:max-w-none md:bg-zinc-50/60 md:shadow-none',
        'dark:border-zinc-800 dark:bg-zinc-900 md:dark:bg-zinc-900/40',
      ].join(' ')}
    >
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
        <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          <ListIcon size={13} />
          {t.toc.title}
        </span>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <XIcon size={14} />
        </button>
      </div>
      <nav className="themed-scroll min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {headings.length === 0 ? (
          <p className="px-2 py-4 text-xs text-zinc-400 dark:text-zinc-600">{t.toc.emptyHeadings}</p>
        ) : (
          <ul className="space-y-0.5">
            {headings.map((h, i) => (
              <li key={i}>
                <button
                  onClick={() => {
                    if (editor) scrollToHeading(editor, h.pos)
                    closeOnMobile(onClose)
                  }}
                  className="block w-full truncate rounded-lg px-2 py-1 text-left text-sm text-zinc-600 transition-colors hover:bg-violet-100 hover:text-violet-800 dark:text-zinc-400 dark:hover:bg-violet-500/15 dark:hover:text-violet-300"
                  style={{ paddingLeft: 8 + (h.level - 1) * 12 }}
                  title={h.text}
                >
                  {h.text}
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>

      <div className="themed-scroll max-h-64 min-h-0 shrink-0 overflow-y-auto border-t border-zinc-200 px-2 py-2 dark:border-zinc-800">
        <div className="flex items-center gap-1.5 px-2 pb-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          <LinkIcon size={12} />
          {t.toc.mentions}
        </div>
        {backlinksOffline && <p className="px-2 pb-1.5 text-[11px] text-amber-600 dark:text-amber-500">{t.toc.offlineLocal}</p>}
        {backlinks.length === 0 ? (
          <p className="px-2 py-2 text-xs text-zinc-400 dark:text-zinc-600">
            {t.toc.mentionsEmptyPrefix} <code className="rounded bg-zinc-200/70 px-1 dark:bg-zinc-800">[[…]]</code>.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {backlinks.map((b) => (
              <li key={b.id}>
                <button
                  onClick={() => {
                    onSelectBacklink(b.id)
                    closeOnMobile(onClose)
                  }}
                  className="flex w-full items-center gap-1.5 truncate rounded-lg px-2 py-1 text-left text-sm text-zinc-600 transition-colors hover:bg-violet-100 hover:text-violet-800 dark:text-zinc-400 dark:hover:bg-violet-500/15 dark:hover:text-violet-300"
                  title={b.title}
                >
                  <FileIcon size={12} className="shrink-0 text-zinc-400" />
                  <span className="truncate">{b.title || t.common.untitled}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
