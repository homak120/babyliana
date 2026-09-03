// Material Symbols Rounded, opsz 24 / wght 500 / FILL 1 — the set and settings
// the Phase 2 handoff specifies. Loaded from Google Fonts and runtime-cached by
// the service worker, so icons survive offline like the text font does.

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <span className="icon material-symbols-rounded" style={{ fontSize: `${size}px` }} aria-hidden>
      {name}
    </span>
  )
}
