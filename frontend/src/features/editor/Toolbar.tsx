import type { Editor } from '@tiptap/react'
import { useRef } from 'react'
import {
  BoldIcon,
  BulletListIcon,
  CodeBlockIcon,
  ColorIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  HighlighterIcon,
  ImageIcon,
  InlineCodeIcon,
  ItalicIcon,
  LinkIcon,
  OrderedListIcon,
  PlainPasteIcon,
  QuoteIcon,
  StrikethroughIcon,
  TableIcon,
  TaskListIcon,
  UnderlineIcon,
} from '../../components/icons'
import { useTranslation } from '../language/LanguageContext'

function Btn({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={[
        'flex items-center justify-center rounded-lg p-1.5 transition-colors',
        active
          ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300'
          : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <span className="mx-1 h-5 w-px self-center bg-zinc-200 dark:bg-zinc-800" />
}

export function Toolbar({
  editor,
  onUploadImage,
  plainPaste,
  onTogglePlainPaste,
}: {
  editor: Editor
  onUploadImage: (file: File) => void
  plainPaste: boolean
  onTogglePlainPaste: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const t = useTranslation()

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-zinc-200 bg-white/60 px-2 py-1.5 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/60">
      <Btn title={t.toolbar.bold} active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <BoldIcon size={16} />
      </Btn>
      <Btn title={t.toolbar.italic} active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <ItalicIcon size={16} />
      </Btn>
      <Btn title={t.toolbar.underline} active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon size={16} />
      </Btn>
      <Btn title={t.toolbar.strike} active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <StrikethroughIcon size={16} />
      </Btn>
      <Btn title={t.toolbar.inlineCode} active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>
        <InlineCodeIcon size={16} />
      </Btn>

      <Sep />

      <Btn title={t.toolbar.heading1} active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1Icon size={16} />
      </Btn>
      <Btn title={t.toolbar.heading2} active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2Icon size={16} />
      </Btn>
      <Btn title={t.toolbar.heading3} active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3Icon size={16} />
      </Btn>

      <Sep />

      <Btn title={t.toolbar.bulletList} active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <BulletListIcon size={16} />
      </Btn>
      <Btn title={t.toolbar.orderedList} active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <OrderedListIcon size={16} />
      </Btn>
      <Btn title={t.toolbar.taskList} active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()}>
        <TaskListIcon size={16} />
      </Btn>
      <Btn title={t.toolbar.blockquote} active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <QuoteIcon size={16} />
      </Btn>
      <Btn title={t.toolbar.codeBlock} active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <CodeBlockIcon size={16} />
      </Btn>

      <Sep />

      <label
        title={t.toolbar.textColor}
        className="flex cursor-pointer items-center rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <ColorIcon size={16} style={{ color: editor.getAttributes('textStyle').color || undefined }} />
        <input
          type="color"
          className="sr-only"
          value={editor.getAttributes('textStyle').color || '#111827'}
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
        />
      </label>
      <label
        title={t.toolbar.highlight}
        className="flex cursor-pointer items-center rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <HighlighterIcon size={16} className="text-amber-500" />
        <input
          type="color"
          className="sr-only"
          defaultValue="#fef08a"
          onChange={(e) => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()}
        />
      </label>

      <Sep />

      <Btn title={t.toolbar.insertTable} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
        <TableIcon size={16} />
      </Btn>
      <Btn
        title={t.toolbar.insertLink}
        active={editor.isActive('link')}
        onClick={() => {
          const url = window.prompt(t.toolbar.linkPrompt, editor.getAttributes('link').href || 'https://')
          if (url === null) return
          if (url === '') editor.chain().focus().unsetLink().run()
          else editor.chain().focus().setLink({ href: url }).run()
        }}
      >
        <LinkIcon size={16} />
      </Btn>
      <Btn title={t.toolbar.insertImage} onClick={() => fileRef.current?.click()}>
        <ImageIcon size={16} />
      </Btn>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onUploadImage(file)
          e.target.value = ''
        }}
      />

      <Sep />

      <Btn title={t.toolbar.togglePlainPaste} active={plainPaste} onClick={onTogglePlainPaste}>
        <PlainPasteIcon size={16} />
      </Btn>
    </div>
  )
}
