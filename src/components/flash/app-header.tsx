import { BoltIcon } from '@/components/ui/icons'
import { StatusDot } from '@/components/ui/status-dot'

export function AppHeader({ supported }: { supported: boolean | null }) {
  const tone = supported === true ? 'ok' : supported === false ? 'error' : 'neutral'
  const label = supported === true ? 'Web Serial ready' : supported === false ? 'Web Serial unavailable' : 'Checking browser'

  return (
    <header className="flex shrink-0 items-center justify-between gap-4 px-5 py-4 lg:px-6">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cocoa text-paper shadow-card">
          <BoltIcon className="h-4.5 w-4.5" />
        </span>
        <div>
          <h1 className="text-base font-semibold leading-tight tracking-tight text-ink">binflow</h1>
          <p className="text-xs text-ink-muted">Plug in. Pick a file. Flash.</p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1.5 text-xs text-ink-muted shadow-card">
        <StatusDot tone={tone} />
        {label}
      </div>
    </header>
  )
}
