import { useEffect, useState } from 'react'
import { applyTheme, getStoredTheme, persistTheme, type ThemeMode } from '../../lib/theme'

export function useTheme(): { mode: ThemeMode; setMode: (mode: ThemeMode) => void } {
  const [mode, setModeState] = useState<ThemeMode>(getStoredTheme)

  useEffect(() => {
    applyTheme(mode)
    if (mode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [mode])

  function setMode(next: ThemeMode) {
    setModeState(next)
    persistTheme(next)
  }

  return { mode, setMode }
}
