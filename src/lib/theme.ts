/**
 * Light or dark, the Playarka way: a `.dark` class on <html>.
 *
 * The app follows the system until the header button says otherwise. That
 * choice is kept in localStorage and put on <html> by a script in the root
 * layout's <head>, before the first paint, so there is no flash of the wrong
 * theme. Choosing what the system already shows forgets the choice again, so
 * the app goes back to following the system without needing a third state.
 */

export type Theme = 'light' | 'dark'

export const THEME_KEY = 'streambits-theme'

const SYSTEM_DARK = '(prefers-color-scheme: dark)'

/** The saved choice, if any. Storage can be blocked, and its contents are not trusted. */
function saved(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

function system(): Theme {
  return window.matchMedia(SYSTEM_DARK).matches ? 'dark' : 'light'
}

/** The theme the page should be showing right now. */
export function resolveTheme(): Theme {
  return saved() ?? system()
}

export function applyTheme(theme: Theme = resolveTheme()) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

/** Reads the class rather than storage, so it agrees with what is on screen. */
export function isDark() {
  return document.documentElement.classList.contains('dark')
}

export function toggleTheme() {
  const next: Theme = isDark() ? 'light' : 'dark'

  try {
    if (next === system()) localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, next)
  } catch {
    // Blocked storage: the choice still holds until the page is reloaded.
  }

  applyTheme(next)
}

/** Fires whenever the class on <html> changes, whoever changed it. */
export function subscribeTheme(listener: () => void) {
  const observer = new MutationObserver(listener)
  observer.observe(document.documentElement, { attributeFilter: ['class'] })
  return () => observer.disconnect()
}

/**
 * The <head> script. It runs while the HTML is still being parsed, long before
 * the bundle, so it is plain ES5 in a string and repeats resolveTheme() rather
 * than importing it. It also keeps following the system while the tab stays
 * open, for as long as there is no saved choice.
 */
export const THEME_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_KEY)};var m=window.matchMedia(${JSON.stringify(SYSTEM_DARK)});var r=document.documentElement;var s=function(){var t=null;try{t=localStorage.getItem(k)}catch(e){}r.classList.toggle('dark',t==='dark'||(t!=='light'&&m.matches))};s();m.addEventListener('change',s)}catch(e){}})()`
