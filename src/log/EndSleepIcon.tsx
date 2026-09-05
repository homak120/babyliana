// The one icon in the app that is not a Material Symbol.
//
// The handoff draws it by hand — a crescent moon with an arrow rising out of
// the notch — because nothing in the set reads as *waking*. `wb_twilight` is
// the closest and it says "dawn", which is a time of day rather than an
// action. 2px stroke in `currentColor`, round caps, so it sits at the same
// weight as the icons beside it and inherits whatever colour its button sets.
export function EndSleepIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M11.6 5.4A6.4 6.4 0 1 0 19 12.8 8.4 8.4 0 0 1 11.6 5.4Z" />
      <path d="M16.6 8.6 21.2 4" />
      <path d="M17.6 3.6h3.8v3.8" />
    </svg>
  )
}
