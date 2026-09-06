// The second icon in the app that is not a Material Symbol, for the same reason
// as the first (`EndSleepIcon`): nothing in the set is a baby bottle. The
// closest is `local_drink`, a paper cup with a straw, which is what "end feed"
// wore until the owner pointed out it reads as a milk *cup*. Material Symbols
// has bar glasses and a coffee cup and no bottle.
//
// 2px stroke in `currentColor`, round caps and joins, so it sits at the same
// weight as the Material icons beside it and inherits whatever colour its
// button sets — the same contract `EndSleepIcon` keeps.
export function BottleIcon({ size = 18 }: { size?: number }) {
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
      {/* Teat, collar, body. The two ticks are the measurement marks — they are
          what stops the body reading as a plain flask at 18px. */}
      <path d="M10.4 5.2c0-2 .5-3 1.6-3s1.6 1 1.6 3" />
      <path d="M9.2 5.2h5.6v2H9.2z" />
      <path d="M9.6 7.2h4.8a2.6 2.6 0 0 1 2.6 2.6v8.4a2.6 2.6 0 0 1-2.6 2.6H9.6A2.6 2.6 0 0 1 7 18.2V9.8a2.6 2.6 0 0 1 2.6-2.6Z" />
      <path d="M9.2 12.2h2.4" />
      <path d="M9.2 15.4h2.4" />
    </svg>
  )
}
