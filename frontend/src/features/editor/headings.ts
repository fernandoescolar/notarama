import type { Editor } from '@tiptap/react'

export interface HeadingEntry {
  level: number
  text: string
  pos: number
}

export function extractHeadings(editor: Editor): HeadingEntry[] {
  const headings: HeadingEntry[] = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      headings.push({ level: node.attrs.level as number, text: node.textContent || '(sin título)', pos })
    }
  })
  return headings
}

export function scrollToHeading(editor: Editor, pos: number) {
  const { node } = editor.view.domAtPos(pos)
  let el: HTMLElement | null = node.nodeType === 1 ? (node as HTMLElement) : node.parentElement
  while (el && !/^H[1-6]$/.test(el.tagName)) el = el.parentElement
  ;(el ?? (node as HTMLElement)).scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** Scrolls the element at an arbitrary doc position into view (centered). */
export function scrollToDocPos(editor: Editor, pos: number) {
  const { node } = editor.view.domAtPos(pos)
  const el = node.nodeType === 1 ? (node as HTMLElement) : node.parentElement
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
