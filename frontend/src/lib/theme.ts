export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'notarama-theme'

export function getStoredTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    // localStorage unavailable (private mode, etc.) — fall through to default
  }
  return 'system'
}

function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** Applies (or removes) the `.dark` class on <html> for the given mode. */
export function applyTheme(mode: ThemeMode): void {
  const isDark = mode === 'dark' || (mode === 'system' && prefersDark())
  document.documentElement.classList.toggle('dark', isDark)
}

export function persistTheme(mode: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // ignore — theme just won't persist across reloads
  }
}
