import type { Editor } from '@tiptap/react'

export interface DocMatch {
  from: number
  to: number
}

function findTerm(editor: Editor, term: string): DocMatch | null {
  let result: DocMatch | null = null
  editor.state.doc.descendants((node, pos) => {
    if (result || !node.isText || !node.text) return
    const idx = node.text.toLowerCase().indexOf(term)
    if (idx >= 0) result = { from: pos + idx, to: pos + idx + term.length }
  })
  return result
}

/**
 * Finds the first occurrence of a search query in the document's visible
 * text. Tries the whole (trimmed) query first — it may be an exact phrase —
 * then falls back to each individual word, since the backend's FTS5 search
 * matches documents containing all words as prefixes rather than requiring
 * them to be adjacent.
 */
export function findFirstMatch(editor: Editor, query: string): DocMatch | null {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return null
  const candidates = [trimmed, ...trimmed.split(/\s+/)]
  for (const term of candidates) {
    if (!term) continue
    const match = findTerm(editor, term)
    if (match) return match
  }
  return null
}
