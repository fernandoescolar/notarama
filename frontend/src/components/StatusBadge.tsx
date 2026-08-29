import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { CloudOfflineIcon } from './icons'
import { useTranslation } from '../features/language/LanguageContext'

function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

export function StatusBadge() {
  const t = useTranslation()
  const online = useOnline()
  const dirtyNodes = useLiveQuery(() => db.nodes.where('dirty').equals(1).count(), []) ?? 0
  const dirtyNotes = useLiveQuery(() => db.noteContent.where('dirty').equals(1).count(), []) ?? 0
  const pending = dirtyNodes + dirtyNotes

  if (online && pending === 0) return null

  return (
    <div className="fixed bottom-3 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-zinc-900/90 px-3 py-1.5 text-xs text-white shadow-lg shadow-zinc-900/20 backdrop-blur-sm dark:bg-zinc-800/90 dark:ring-1 dark:ring-white/10">
      <CloudOfflineIcon size={13} className={online ? 'text-violet-400' : 'text-amber-400'} />
      {online ? t.statusBadge.syncing(pending) : t.statusBadge.offline}
    </div>
  )
}
