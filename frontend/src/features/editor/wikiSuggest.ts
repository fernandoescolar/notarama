import type { Editor } from '@tiptap/react'

export interface WikiSuggestState {
  from: number
  to: number
  query: string
}

/**
 * Detects whether the cursor sits right after an unclosed "[[query" so the
 * caller can show the note-picker dropdown. Only looks within the current
 * text block and a bounded lookback, so it never runs away scanning the
 * whole document.
 */
export function detectWikiQuery(editor: Editor): WikiSuggestState | null {
  const { state } = editor
  const { $from, empty } = state.selection
  if (!empty) return null

  const start = Math.max(0, $from.parentOffset - 80)
  const textBefore = $from.parent.textBetween(start, $from.parentOffset, undefined, '￼')
  const match = /\[\[([^[\]]*)$/.exec(textBefore)
  if (!match) return null

  const to = $from.pos
  const from = to - match[0].length
  return { from, to, query: match[1] }
}
