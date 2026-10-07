/**
 * Which build this is, in a form a person can compare (D-068).
 *
 * The version is the commit — the same seven characters `git log --oneline`
 * and GitHub print — so "is this phone on the latest?" is answered by matching
 * it against the top of the commit list, with no version number to remember to
 * bump.
 */
export const VERSION = __BUILD_SHA__

/** When this build was made, in this phone's own time zone and clock. */
export function builtAt(): string {
  const d = new Date(__BUILD_TIME__)
  if (Number.isNaN(d.getTime())) return __BUILD_TIME__
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export const versionLine = () => `version ${VERSION} · built ${builtAt()}`
