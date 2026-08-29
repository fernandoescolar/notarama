export type Lang = 'es' | 'en'

const STORAGE_KEY = 'notarama-lang'

function getStoredLang(): Lang | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'es' || v === 'en') return v
  } catch {
    // localStorage unavailable — fall through to detection
  }
  return null
}

/** Spanish if any of the browser's preferred languages is Spanish, English otherwise (the only two we support). */
function detectBrowserLang(): Lang {
  const candidates = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const l of candidates) {
    if (l?.toLowerCase().startsWith('es')) return 'es'
  }
  return 'en'
}

export function getInitialLang(): Lang {
  return getStoredLang() ?? detectBrowserLang()
}

export function persistLang(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // ignore — language just won't persist across reloads
  }
}
