import { useEditor, EditorContent, type Editor as TiptapEditor } from '@tiptap/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useLocation, useNavigate } from 'react-router-dom'
import { db } from '../../lib/db'
import { createNode, putNoteContent, renameNode } from '../../lib/localStore'
import { buildExtensions } from './extensions'
import { Toolbar } from './Toolbar'
import { TableOfContents } from './TableOfContents'
import { extractHeadings, scrollToDocPos, type HeadingEntry } from './headings'
import { findFirstMatch } from './searchMatch'
import { detectWikiQuery, type WikiSuggestState } from './wikiSuggest'
import { WikiLinkMenu } from './WikiLinkMenu'
import { useBacklinks } from './useBacklinks'
import { api } from '../../lib/api'
import { ListIcon } from '../../components/icons'
import type { NodeRecord } from '../../lib/db'
import { useTranslation } from '../language/LanguageContext'

const HIGHLIGHT_DURATION_MS = 2500
const WIKI_RESULT_LIMIT = 8

function getMarkdown(editor: TiptapEditor): string | null {
  // Guards against a race on fast note-switching: our unmount-flush effect
  // (below) can still be queued after TipTap's own cleanup has already torn
  // the editor down, in which case `.storage` is no longer populated.
  if (editor.isDestroyed) return null
  // provided by the Markdown extension's storage namespace
  return (editor.storage as any).markdown?.getMarkdown() ?? null
}

export function NotePage({ nodeId }: { nodeId: string }) {
  return <Editor key={nodeId} nodeId={nodeId} />
}

function Editor({ nodeId }: { nodeId: string }) {
  const t = useTranslation()
  const node = useLiveQuery(() => db.nodes.get(nodeId), [nodeId])
  const contentRecord = useLiveQuery(() => db.noteContent.get(nodeId), [nodeId])
  const location = useLocation()
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  // On mobile the TOC is a full overlay, so don't cover the note by default
  // the moment it opens — only on desktop, where it's a slim static column.
  const [tocOpen, setTocOpen] = useState(() => !window.matchMedia('(max-width: 767px)').matches)
  const [headings, setHeadings] = useState<HeadingEntry[]>([])
  const [plainPaste, setPlainPaste] = useState(false)
  const plainPasteRef = useRef(plainPaste)
  plainPasteRef.current = plainPaste

  const [wikiSuggest, setWikiSuggest] = useState<WikiSuggestState | null>(null)
  const [wikiSelectedIndex, setWikiSelectedIndex] = useState(0)
  const wikiSuggestRef = useRef(wikiSuggest)
  wikiSuggestRef.current = wikiSuggest
  const wikiSelectedIndexRef = useRef(wikiSelectedIndex)
  wikiSelectedIndexRef.current = wikiSelectedIndex

  const { backlinks, offline: backlinksOffline } = useBacklinks(nodeId)

  const loadedRef = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Tracks the last navigation (location.key) whose highlightQuery was
  // already consumed, so re-searching while the same note stays mounted
  // (no remount, since NotePage keys by nodeId) still re-triggers.
  const highlightConsumedForRef = useRef<string | null>(null)

  // Re-sync whenever the title changes underneath us too (not just on
  // initial load) — e.g. renaming this note from the sidebar while its
  // editor is already open. Harmless no-op when the change originated from
  // this input's own onChange (it already set the same value locally).
  useEffect(() => {
    if (node) setTitle(node.title)
  }, [node?.id, node?.title])

  async function handleWikiLinkClick(linkTitle: string) {
    const match = await db.nodes
      .filter((n) => n.type === 'note' && n.deletedAt == null && n.title.trim().toLowerCase() === linkTitle.trim().toLowerCase())
      .first()
    if (match) {
      navigate(`/n/${match.id}`)
      return
    }
    if (window.confirm(t.editor.confirmCreateLinkedNote(linkTitle))) {
      const created = await createNode({ parentId: null, type: 'note', title: linkTitle })
      navigate(`/n/${created.id}`)
    }
  }

  // Built once per mounted note (this component remounts per nodeId via
  // NotePage's key), so the closure below stays correctly scoped even
  // though it isn't in the dependency array.
  const extensions = useMemo(() => buildExtensions((clickedTitle) => void handleWikiLinkClick(clickedTitle)), [])

  const wikiResults =
    useLiveQuery(async () => {
      if (!wikiSuggest) return []
      const q = wikiSuggest.query.trim().toLowerCase()
      const all = await db.nodes.filter((n) => n.type === 'note' && n.deletedAt == null).toArray()
      const filtered = q ? all.filter((n) => n.title.toLowerCase().includes(q)) : all
      return filtered.slice(0, WIKI_RESULT_LIMIT)
    }, [wikiSuggest?.query]) ?? []
  const wikiResultsRef = useRef(wikiResults)
  wikiResultsRef.current = wikiResults

  const wikiShowCreate = !!wikiSuggest?.query.trim() && !wikiResults.some((n) => n.title.trim().toLowerCase() === wikiSuggest.query.trim().toLowerCase())
  const wikiShowCreateRef = useRef(wikiShowCreate)
  wikiShowCreateRef.current = wikiShowCreate

  useEffect(() => {
    setWikiSelectedIndex(0)
  }, [wikiSuggest?.query])

  const editor = useEditor({
    extensions,
    content: '',
    editorProps: {
      attributes: { class: 'editor-prose ProseMirror h-full' },
      handlePaste(view, event) {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'))
        if (files.length > 0) {
          event.preventDefault()
          for (const file of files) void uploadAndInsert(file)
          return true
        }
        if (plainPasteRef.current) {
          const text = event.clipboardData?.getData('text/plain')
          if (text != null) {
            event.preventDefault()
            const { state, dispatch } = view
            dispatch(state.tr.insertText(text, state.selection.from, state.selection.to))
            return true
          }
        }
        return false
      },
      handleDrop(_view, event) {
        const files = Array.from(event.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'))
        if (files.length > 0) {
          event.preventDefault()
          for (const file of files) void uploadAndInsert(file)
          return true
        }
        return false
      },
      handleKeyDown(_view, event) {
        if (!wikiSuggestRef.current) return false
        const total = wikiResultsRef.current.length + (wikiShowCreateRef.current ? 1 : 0)
        if (total === 0 && event.key !== 'Escape') return false

        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setWikiSelectedIndex((i) => (i + 1) % total)
          return true
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          setWikiSelectedIndex((i) => (i - 1 + total) % total)
          return true
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          event.preventDefault()
          confirmWikiSelection()
          return true
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          setWikiSuggest(null)
          return true
        }
        return false
      },
    },
    onUpdate: ({ editor }) => {
      setHeadings(extractHeadings(editor))
      setWikiSuggest(detectWikiQuery(editor))
      scheduleSave()
    },
    onSelectionUpdate: ({ editor }) => {
      setWikiSuggest(detectWikiQuery(editor))
    },
  })

  function scheduleSave() {
    if (!editor) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const markdown = getMarkdown(editor)
      if (markdown !== null) void putNoteContent(nodeId, markdown)
    }, 500)
  }

  function insertWikiLink(linkTitle: string) {
    if (!editor || !wikiSuggestRef.current) return
    const { from, to } = wikiSuggestRef.current
    editor
      .chain()
      .focus()
      .insertContentAt({ from, to }, `[[${linkTitle}]] `)
      .run()
    setWikiSuggest(null)
  }

  function confirmWikiSelection() {
    const results = wikiResultsRef.current
    const idx = wikiSelectedIndexRef.current
    if (idx < results.length) {
      insertWikiLink(results[idx].title)
    } else if (wikiShowCreateRef.current && wikiSuggestRef.current) {
      void createAndLinkNote(wikiSuggestRef.current.query.trim())
    }
  }

  async function createAndLinkNote(newTitle: string) {
    if (!newTitle) return
    await createNode({ parentId: null, type: 'note', title: newTitle })
    insertWikiLink(newTitle)
  }

  async function uploadAndInsert(file: File) {
    if (!editor) return
    try {
      const { url } = await api.upload(file, nodeId)
      editor.chain().focus().setImage({ src: url }).run()
    } catch {
      window.alert(t.editor.uploadImageError)
    }
  }

  // Load persisted content into the editor exactly once per note.
  useEffect(() => {
    if (!editor || loadedRef.current || contentRecord === undefined) return
    editor.commands.setContent(contentRecord?.contentMd ?? '', { emitUpdate: false })
    loadedRef.current = true
    setHeadings(extractHeadings(editor))
  }, [editor, contentRecord])

  // Arriving from a search result: scroll to and briefly highlight the
  // matched text. Runs once content has been loaded (same commit as the
  // effect above, since setContent is synchronous).
  useEffect(() => {
    if (!editor || !loadedRef.current || highlightConsumedForRef.current === location.key) return
    highlightConsumedForRef.current = location.key
    const query = (location.state as { highlightQuery?: string } | null)?.highlightQuery
    if (!query) return
    const match = findFirstMatch(editor, query)
    if (!match) return
    editor.commands.setSearchHighlight(match.from, match.to)
    scrollToDocPos(editor, match.from)
    setTimeout(() => editor.commands.clearSearchHighlight(), HIGHLIGHT_DURATION_MS)
  }, [editor, contentRecord, location.key, location.state])

  // Flush any pending debounced save when leaving the note.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        const markdown = editor ? getMarkdown(editor) : null
        if (markdown !== null) void putNoteContent(nodeId, markdown)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!editor || !node) {
    return <div className="flex-1" />
  }

  const wikiMenuPos = wikiSuggest ? editor.view.coordsAtPos(wikiSuggest.from) : null

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2 px-4 pt-4 md:px-6 md:pt-6">
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              void renameNode(nodeId, e.target.value)
            }}
            placeholder={t.common.untitled}
            className="w-full min-w-0 border-none text-2xl font-bold tracking-tight text-zinc-900 outline-none placeholder:text-zinc-300 md:text-3xl dark:text-zinc-50 dark:placeholder:text-zinc-700"
          />
          {!tocOpen && (
            <button
              title={t.editor.showToc}
              onClick={() => setTocOpen(true)}
              className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <ListIcon size={16} />
            </button>
          )}
        </div>

        <Toolbar
          editor={editor}
          onUploadImage={(file) => void uploadAndInsert(file)}
          plainPaste={plainPaste}
          onTogglePlainPaste={() => setPlainPaste((v) => !v)}
        />

        <div className="themed-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
          <EditorContent editor={editor} className="h-full" />
        </div>
      </div>

      {wikiSuggest && wikiMenuPos && (
        <WikiLinkMenu
          top={wikiMenuPos.bottom + 4}
          left={wikiMenuPos.left}
          query={wikiSuggest.query}
          results={wikiResults}
          showCreate={wikiShowCreate}
          selectedIndex={wikiSelectedIndex}
          onSelect={(n: NodeRecord) => insertWikiLink(n.title)}
          onCreate={() => void createAndLinkNote(wikiSuggest.query.trim())}
        />
      )}

      {tocOpen && (
        <>
          <div
            className="fixed inset-0 z-30 bg-zinc-950/40 backdrop-blur-[2px] md:hidden"
            onClick={() => setTocOpen(false)}
            aria-hidden="true"
          />
          <TableOfContents
            editor={editor}
            headings={headings}
            backlinks={backlinks}
            backlinksOffline={backlinksOffline}
            onSelectBacklink={(id) => navigate(`/n/${id}`)}
            onClose={() => setTocOpen(false)}
          />
        </>
      )}
    </div>
  )
}
