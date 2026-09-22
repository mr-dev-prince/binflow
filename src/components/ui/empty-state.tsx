import type { ReactNode } from 'react'

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 px-6 py-6 text-center">
      {icon ? (
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">{icon}</div>
      ) : null}
      <p className="text-sm text-foreground">{title}</p>
      {children ? <p className="max-w-[34ch] text-sm leading-relaxed text-muted-foreground">{children}</p> : null}
    </div>
  )
}
