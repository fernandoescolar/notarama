import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { db } from '../../lib/db'
import type { SearchResult } from '../../lib/types'
import { FileIcon, SearchIcon, XIcon } from '../../components/icons'
import { useTranslation } from '../language/LanguageContext'

// The backend wraps matched terms with \x01/\x02 sentinels instead of real
// HTML (see internal/search/search.go) precisely so the rest of the snippet
// — raw user note content — can be escaped before any of it is rendered as
// HTML, and only the sentinels turned into an actual <mark> tag.
function snippetToSafeHtml(snippet: string): string {
  const escaped = snippet
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped.replaceAll('\x01', '<mark>').replaceAll('\x02', '</mark>')
}

async function localFallbackSearch(q: string): Promise<SearchResult[]> {
  const query = q.trim().toLowerCase()
  if (!query) return []
  const [nodes, notes] = await Promise.all([db.nodes.toArray(), db.noteContent.toArray()])
  const contentByNode = new Map(notes.map((n) => [n.nodeId, n.contentMd]))
  return nodes
    .filter((n) => n.type === 'note' && n.deletedAt == null)
    .filter((n) => n.title.toLowerCase().includes(query) || (contentByNode.get(n.id) ?? '').toLowerCase().includes(query))
    .slice(0, 50)
    .map((n) => {
      const content = contentByNode.get(n.id) ?? ''
      const idx = content.toLowerCase().indexOf(query)
      const snippet = idx >= 0 ? content.slice(Math.max(0, idx - 30), idx + 60) : content.slice(0, 90)
      return { nodeId: n.id, title: n.title, snippet }
    })
}

export function SearchPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslation()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [offline, setOffline] = useState(false)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    let cancelled = false
    const query = q.trim()
    if (!query) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.search(query)
        if (!cancelled) {
          setOffline(false)
          setResults(res)
        }
      } catch {
        const res = await localFallbackSearch(query)
        if (!cancelled) {
          setOffline(true)
          setResults(res)
        }
      }
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [q])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-zinc-950/40 px-3 pt-16 backdrop-blur-[2px] md:pt-24"
      onClick={onClose}
    >
      <div
        className="flex max-h-[60vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
          <SearchIcon className="shrink-0 text-violet-500" size={16} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
            placeholder={t.search.placeholder}
            className="min-w-0 flex-1 border-none bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-600"
          />
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <XIcon size={14} />
          </button>
        </div>
        {offline && (
          <p className="border-b border-amber-100 bg-amber-50 px-3 py-1.5 text-xs text-amber-700 dark:border-amber-900/40 dark:bg-amber-500/10 dark:text-amber-400">
            {t.search.offlineLocal}
          </p>
        )}
        <div className="themed-scroll min-h-0 flex-1 overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-zinc-400 dark:text-zinc-600">
              {q.trim() ? t.search.noResults : t.search.typeToSearch}
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {results.map((r) => (
                <li key={r.nodeId}>
                  <button
                    onClick={() => {
                      navigate(`/n/${r.nodeId}`, { state: { highlightQuery: q } })
                      onClose()
                    }}
                    className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                  >
                    <FileIcon className="mt-0.5 shrink-0 text-zinc-400 dark:text-zinc-600" size={15} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{r.title || t.common.untitled}</span>
                      <span
                        className="block truncate text-xs text-zinc-500 [&_mark]:rounded-sm [&_mark]:bg-amber-200 [&_mark]:text-inherit dark:text-zinc-500 dark:[&_mark]:bg-amber-500/30"
                        dangerouslySetInnerHTML={{ __html: snippetToSafeHtml(r.snippet) }}
                      />
                    </span>
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
