import { type RelativeUnit, es } from './es'

const RELATIVE_UNIT_EN: Record<RelativeUnit, string> = {
  second: 'second',
  minute: 'minute',
  hour: 'hour',
  day: 'day',
  week: 'week',
  month: 'month',
  year: 'year',
}

// Typed against `typeof es` so a missing or mismatched key/signature is a
// compile error instead of a silently-untranslated string in production.
export const en: typeof es = {
  common: {
    untitled: 'Untitled',
    thisItem: 'this item',
  },
  app: {
    emptyState: 'Select a note or create a new one from the sidebar.',
    openMenu: 'Open menu',
    loading: 'Loading Notarama…',
  },
  sidebar: {
    search: 'Search',
    newNote: 'New note',
    newFolder: 'New folder',
    trash: 'Trash',
    closeMenu: 'Close menu',
    logout: 'Log out',
    empty: 'No notes yet. Create a folder or note with the buttons above.',
    confirmDelete: (title: string) => `Delete "${title}"? This also deletes its contents.`,
    delete: 'Delete',
  },
  editor: {
    showToc: 'Show table of contents',
    confirmCreateLinkedNote: (title: string) => `The note "${title}" doesn't exist yet. Create it?`,
    uploadImageError: "Couldn't upload the image. Are you still connected?",
  },
  toolbar: {
    bold: 'Bold (Ctrl+B)',
    italic: 'Italic (Ctrl+I)',
    underline: 'Underline (Ctrl+U)',
    strike: 'Strikethrough',
    inlineCode: 'Inline code',
    heading1: 'Heading 1',
    heading2: 'Heading 2',
    heading3: 'Heading 3',
    bulletList: 'Bulleted list',
    orderedList: 'Numbered list',
    taskList: 'Task list',
    blockquote: 'Quote',
    codeBlock: 'Code block',
    textColor: 'Text color',
    highlight: 'Highlight',
    insertTable: 'Insert table',
    insertLink: 'Insert link',
    linkPrompt: 'Link URL:',
    insertImage: 'Insert image',
    togglePlainPaste: 'Paste as plain text (toggle)',
  },
  toc: {
    title: 'Contents',
    emptyHeadings: 'This note’s headings will show up here.',
    mentions: 'Mentions',
    offlineLocal: 'Offline: local result.',
    mentionsEmptyPrefix: 'No note links here yet with',
  },
  wikiMenu: {
    searchPrompt: 'Type to search for a note…',
    createNote: (query: string) => `Create note "${query}"`,
  },
  search: {
    placeholder: 'Search your notes…',
    offlineLocal: 'Offline: showing results from the local database.',
    noResults: 'No results.',
    typeToSearch: 'Type to search by title or content.',
  },
  trash: {
    title: 'Trash',
    emptyTrashButton: 'Empty trash',
    loadError: "Couldn't load the trash. Are you still connected?",
    loading: 'Loading…',
    empty: 'The trash is empty.',
    restore: 'Restore',
    permanentDelete: 'Delete permanently',
    restoreError: "Couldn't restore. Are you still connected?",
    deleteError: "Couldn't delete. Are you still connected?",
    emptyTrashError: "Couldn't empty the trash. Are you still connected?",
    confirmPermanentDelete: (title: string) => `Permanently delete "${title}". This action cannot be undone.`,
    confirmEmptyTrash: (count: number) => `Permanently empty the trash (${count} item${count === 1 ? '' : 's'}).`,
    relativeTime: (n: number, unit: RelativeUnit) => {
      const label = RELATIVE_UNIT_EN[unit]
      return n <= 1 ? `a ${label} ago` : `${n} ${label}s ago`
    },
  },
  theme: {
    light: 'Light',
    system: 'System',
    dark: 'Dark',
  },
  language: {
    spanish: 'Español',
    english: 'English',
  },
  statusBadge: {
    syncing: (n: number) => `Syncing ${n} change${n === 1 ? '' : 's'}…`,
    offline: 'Offline — changes are saved locally',
  },
}
