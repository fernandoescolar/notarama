import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { createLowlight, common } from 'lowlight'
import { Markdown } from 'tiptap-markdown'
import { SearchHighlight } from './searchHighlightExtension'
import { WikiLink } from './wikiLinkExtension'

const lowlight = createLowlight(common)

export function buildExtensions(onWikiLinkClick: (title: string) => void) {
  return [
    StarterKit.configure({
      codeBlock: false, // replaced by CodeBlockLowlight below (syntax highlighting)
      link: { openOnClick: false, autolink: true },
    }),
    Image.configure({ inline: false, allowBase64: false }),
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    Placeholder.configure({ placeholder: 'Escribe algo, o pega contenido desde cualquier sitio…' }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    CodeBlockLowlight.configure({ lowlight }),
    Markdown.configure({
      html: true,
      tightLists: true,
      bulletListMarker: '-',
      linkify: true,
      breaks: false,
      transformPastedText: false,
    }),
    SearchHighlight,
    WikiLink.configure({ onLinkClick: onWikiLinkClick }),
  ]
}
