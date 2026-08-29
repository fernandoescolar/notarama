import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const wikiLinkKey = new PluginKey<DecorationSet>('wikiLink')

// [[Title]] wiki links are stored as plain text in the markdown source (no
// custom node/serialization needed — tiptap-markdown round-trips plain
// text verbatim). This extension only adds a purely-visual decoration that
// turns matching text into a styled, clickable pill, plus a click handler
// that resolves the title to a note.
const WIKI_LINK_PATTERN = /\[\[([^[\]]+)\]\]/g

export interface WikiLinkOptions {
  onLinkClick: (title: string) => void
}

function computeDecorations(doc: import('@tiptap/pm/model').Node): DecorationSet {
  const decorations: Decoration[] = []
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    WIKI_LINK_PATTERN.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = WIKI_LINK_PATTERN.exec(node.text))) {
      const from = pos + match.index
      const to = from + match[0].length
      decorations.push(
        Decoration.inline(from, to, {
          class: 'wiki-link',
          'data-wiki-title': match[1].trim(),
        }),
      )
    }
  })
  return DecorationSet.create(doc, decorations)
}

export const WikiLink = Extension.create<WikiLinkOptions>({
  name: 'wikiLink',

  addOptions() {
    return { onLinkClick: () => {} }
  },

  addProseMirrorPlugins() {
    const options = this.options
    return [
      new Plugin({
        key: wikiLinkKey,
        state: {
          init: (_, { doc }) => computeDecorations(doc),
          apply: (tr, old) => (tr.docChanged ? computeDecorations(tr.doc) : old),
        },
        props: {
          decorations(state) {
            return wikiLinkKey.getState(state)
          },
          handleClick(_view, _pos, event) {
            const target = event.target as HTMLElement | null
            const el = target?.closest<HTMLElement>('.wiki-link')
            const title = el?.getAttribute('data-wiki-title')
            if (!title) return false
            options.onLinkClick(title)
            return true
          },
        },
      }),
    ]
  },
})
