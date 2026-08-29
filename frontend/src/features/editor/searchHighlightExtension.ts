import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const searchHighlightKey = new PluginKey<DecorationSet>('searchHighlight')

type Meta = { range: { from: number; to: number } } | { clear: true }

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    searchHighlight: {
      /** Temporarily decorates [from, to) to flag a search match — does not modify the document. */
      setSearchHighlight: (from: number, to: number) => ReturnType
      clearSearchHighlight: () => ReturnType
    }
  }
}

/**
 * Flags a range of text as a search match using a ProseMirror decoration
 * (purely visual, doesn't touch the document/markdown) so clicking a search
 * result can highlight where the term was found without persisting
 * anything.
 */
export const SearchHighlight = Extension.create({
  name: 'searchHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: searchHighlightKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const meta = tr.getMeta(searchHighlightKey) as Meta | undefined
            if (meta && 'clear' in meta) return DecorationSet.empty
            if (meta && 'range' in meta) {
              return DecorationSet.create(tr.doc, [
                Decoration.inline(meta.range.from, meta.range.to, { class: 'search-highlight' }),
              ])
            }
            return old.map(tr.mapping, tr.doc)
          },
        },
        props: {
          decorations(state) {
            return searchHighlightKey.getState(state)
          },
        },
      }),
    ]
  },

  addCommands() {
    return {
      setSearchHighlight:
        (from: number, to: number) =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(searchHighlightKey, { range: { from, to } }))
          return true
        },
      clearSearchHighlight:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(searchHighlightKey, { clear: true }))
          return true
        },
    }
  },
})
