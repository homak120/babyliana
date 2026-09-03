import { registerSW } from 'virtual:pwa-register'

// Keeping both phones on the same build, without ever interrupting anyone.
//
// An installed PWA only picks up a new build on a fresh navigation, and on iOS
// that means terminating it rather than just closing it — so after any deploy,
// two parents on two different builds is the normal state (plan.md, Phase 4).
// Left alone it can persist for days.
//
// The rule: reload when the app becomes visible AND nothing is half-entered.
// Never a modal. A dialog at 4am asking about a new version is exactly the
// friction that sends someone back to the pen, and a reload mid-entry would
// throw away what they were typing.

let waiting = false
let entryInProgress = false
let applyUpdate: ((reload?: boolean) => Promise<void>) | null = null

/** The add sheet holds this open, so an update cannot land mid-entry. */
export function setEntryInProgress(value: boolean) {
  entryInProgress = value
  if (!value) maybeApply()
}

function maybeApply() {
  if (!waiting || entryInProgress) return
  if (document.visibilityState !== 'visible') return
  waiting = false
  void applyUpdate?.(true)
}

export function registerUpdates() {
  applyUpdate = registerSW({
    onNeedRefresh() {
      waiting = true
      maybeApply()
    },
    onRegisteredSW(_url, registration) {
      // Coming back to the foreground is the moment worth checking: it is when
      // a phone that has been in a pocket for hours rejoins the world.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return
        void registration?.update()
        maybeApply()
      })
    },
  })
}
