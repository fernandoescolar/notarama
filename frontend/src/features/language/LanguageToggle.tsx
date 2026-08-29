import type { Lang } from '../../lib/lang'
import { useLanguage } from './LanguageContext'

const OPTIONS: { lang: Lang; label: string }[] = [
  { lang: 'es', label: 'ES' },
  { lang: 'en', label: 'EN' },
]

export function LanguageToggle() {
  const { lang, setLang, t } = useLanguage()

  return (
    <div className="flex items-center gap-0.5 rounded-full bg-zinc-100 p-0.5 dark:bg-zinc-800">
      {OPTIONS.map(({ lang: l, label }) => (
        <button
          key={l}
          title={l === 'es' ? t.language.spanish : t.language.english}
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={[
            'flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[10px] font-semibold transition-colors',
            lang === l
              ? 'bg-white text-violet-600 shadow-sm dark:bg-zinc-700 dark:text-violet-400'
              : 'text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300',
          ].join(' ')}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
