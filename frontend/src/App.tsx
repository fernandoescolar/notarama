import { useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom'
import { useAuth } from './features/auth/useAuth'
import { Sidebar } from './features/sidebar/Sidebar'
import { NotePage } from './features/editor/Editor'
import { SearchPanel } from './features/search/SearchPanel'
import { TrashPanel } from './features/trash/TrashPanel'
import { StatusBadge } from './components/StatusBadge'
import { FileIcon, MenuIcon, SparklesIcon } from './components/icons'
import { LanguageProvider, useTranslation } from './features/language/LanguageContext'

function NoteRoute() {
  const { id } = useParams<{ id: string }>()
  if (!id) return null
  return <NotePage nodeId={id} />
}

function EmptyState() {
  const t = useTranslation()
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/20">
        <FileIcon size={26} />
      </div>
      <p className="max-w-[22rem] text-sm text-zinc-400 dark:text-zinc-500">{t.app.emptyState}</p>
    </div>
  )
}

function Shell({ me }: { me: import('./lib/types').Me }) {
  const t = useTranslation()
  const [searchOpen, setSearchOpen] = useState(false)
  const [trashOpen, setTrashOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-zinc-950">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-zinc-950/40 backdrop-blur-[2px] md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <Sidebar
        me={me}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenTrash={() => setTrashOpen(true)}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 md:hidden dark:border-zinc-800">
          <button
            title={t.app.openMenu}
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <MenuIcon size={18} />
          </button>
          <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            <SparklesIcon size={14} className="text-violet-500" />
            Notarama
          </span>
        </div>
        <main className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<EmptyState />} />
            <Route path="/n/:id" element={<NoteRoute />} />
          </Routes>
        </main>
      </div>
      {searchOpen && <SearchPanel onClose={() => setSearchOpen(false)} />}
      {trashOpen && <TrashPanel onClose={() => setTrashOpen(false)} />}
      <StatusBadge />
    </div>
  )
}

function LoadingScreen() {
  const t = useTranslation()
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-white dark:bg-zinc-950">
      <div className="flex items-center gap-2 text-sm text-zinc-400 dark:text-zinc-500">
        <span className="size-2 animate-pulse rounded-full bg-violet-500" />
        {t.app.loading}
      </div>
    </div>
  )
}

function AuthGate() {
  const auth = useAuth()

  if (auth.status !== 'authenticated') {
    return <LoadingScreen />
  }

  return (
    <BrowserRouter>
      <Shell me={auth.me} />
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthGate />
    </LanguageProvider>
  )
}
