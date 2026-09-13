'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { cx } from '@/lib/cx'

type ModalProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
}

/** Native <dialog>: the browser handles focus trapping, Escape, and the backdrop. */
export function Modal({ open, onClose, title, description, children, footer, className }: ModalProps) {
  const ref = useRef<HTMLDialogElement | null>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return

    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      aria-labelledby="modal-title"
      className={cx(
        'm-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-line bg-card p-0 text-ink shadow-modal',
        'backdrop:bg-transparent',
        className,
      )}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      onClose={onClose}
      ref={ref}
    >
      <div className="flex flex-col">
        <header className="px-6 pt-6 pb-4">
          <h2 className="text-lg font-semibold tracking-tight" id="modal-title">
            {title}
          </h2>
          {description ? <p className="mt-1 text-sm leading-relaxed text-ink-muted">{description}</p> : null}
        </header>
        <div className="px-6">{children}</div>
        {footer ? <footer className="px-6 pt-4 pb-6">{footer}</footer> : <div className="pb-6" />}
      </div>
    </dialog>
  )
}
