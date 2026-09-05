import { useSyncExternalStore } from 'react'

// Whether a full-screen overlay is open, so the tab bar can get out of the way.
//
// The bar is a flex row at the bottom of the shell, not a fixed overlay, and a
// sheet scrolled to its end put the save button inside the bar's band — a 56px
// overlap on a 56px button. The sheet's bottom padding could be grown to clear
// it, but the bar has no business being there at all: it navigates between the
// two main screens, and a sheet is neither.

let open = 0
const listeners = new Set<() => void>()

/** Call on mount, and undo on unmount. Counted, so nested overlays are safe. */
export function markOverlay(isOpen: boolean) {
  open = Math.max(0, open + (isOpen ? 1 : -1))
  for (const l of listeners) l()
}

export function useOverlayOpen(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => open > 0,
    () => false,
  )
}
