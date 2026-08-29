import { MonitorIcon, MoonIcon, SunIcon } from '../../components/icons'
import type { ThemeMode } from '../../lib/theme'
import { useTranslation } from '../language/LanguageContext'
import { useTheme } from './useTheme'

export function ThemeToggle() {
  const { mode, setMode } = useTheme()
  const t = useTranslation()

  const options: { mode: ThemeMode; label: string; icon: typeof SunIcon }[] = [
    { mode: 'light', label: t.theme.light, icon: SunIcon },
    { mode: 'system', label: t.theme.system, icon: MonitorIcon },
    { mode: 'dark', label: t.theme.dark, icon: MoonIcon },
  ]

  return (
    <div className="flex items-center gap-0.5 rounded-full bg-zinc-100 p-0.5 dark:bg-zinc-800">
      {options.map(({ mode: m, label, icon: Icon }) => (
        <button
          key={m}
          title={label}
          onClick={() => setMode(m)}
          aria-pressed={mode === m}
          className={[
            'flex h-6 w-6 items-center justify-center rounded-full transition-colors',
            mode === m
              ? 'bg-white text-violet-600 shadow-sm dark:bg-zinc-700 dark:text-violet-400'
              : 'text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300',
          ].join(' ')}
        >
          <Icon size={13} />
        </button>
      ))}
    </div>
  )
}
