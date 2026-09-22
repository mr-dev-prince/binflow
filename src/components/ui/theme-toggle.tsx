'use client'

import { useLayoutEffect, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { MoonIcon, SunIcon } from '@/components/ui/icons'
import { applyTheme, isDark, subscribeTheme, toggleTheme } from '@/lib/theme'

/** The server cannot know the theme; the client corrects this as soon as it hydrates. */
const unknown = () => false

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribeTheme, isDark, unknown)

  // In development React's Strict Mode remounts the tree once and resets the
  // <html> class list to what the layout renders, undoing the head script.
  // Putting the theme back before paint is a no-op in production.
  useLayoutEffect(() => applyTheme(), [])

  // Both icons are in the markup and CSS shows one, so the right icon is on
  // screen before React loads. Only the label has to wait for hydration.
  const icon = (
    <>
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="dark:hidden" />
    </>
  )

  const label = dark ? 'Switch to light mode' : 'Switch to dark mode'

  return <Button aria-label={label} icon={icon} onClick={toggleTheme} title={label} variant="ghost" />
}
