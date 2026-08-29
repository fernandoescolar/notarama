import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { es } from '../../lib/i18n/es'
import { en } from '../../lib/i18n/en'
import { getInitialLang, persistLang, type Lang } from '../../lib/lang'

const dictionaries = { es, en }

export type Translations = typeof es

interface LanguageContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: Translations
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  function setLang(next: Lang) {
    setLangState(next)
    persistLang(next)
  }

  const value: LanguageContextValue = { lang, setLang, t: dictionaries[lang] }

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider')
  return ctx
}

/** Shorthand for the common case of just needing the translation dictionary. */
export function useTranslation(): Translations {
  return useLanguage().t
}
