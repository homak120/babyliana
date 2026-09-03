import type { MascotState } from '../derive'

// Liana, drawn in CSS exactly as the Phase 2 handoff draws her. Phase 7 decides
// whether she is the baby or a separate creature (Q-003) and may replace this
// with commissioned art; until then this is the design as delivered.
//
// Her states are derived and descriptive only. She never nags.

const ASLEEP: MascotState[] = ['sleeping']

export function Mascot({ state, size = 100 }: { state: MascotState; size?: number }) {
  const s = size / 100
  const px = (n: number) => `${n * s}px`
  const asleep = ASLEEP.includes(state)

  const animation =
    state === 'logged'
      ? 'lianaPop 0.6s ease-out'
      : asleep
        ? 'lianaBreathe 5s ease-in-out infinite'
        : 'lianaBreathe 7s ease-in-out infinite'

  return (
    <div
      className="mascot"
      style={{ width: px(100), height: px(96), animation }}
      aria-label={`liana is ${state}`}
      role="img"
    >
      <i className="vine" style={{ left: px(44), top: px(-8), width: px(9), height: px(16) }} />
      <i className="leaf" style={{ left: px(52), top: px(-4), width: px(16), height: px(9) }} />
      <i className="ear" style={{ left: px(12), top: px(6), width: px(27), height: px(27) }} />
      <i className="ear" style={{ right: px(12), top: px(6), width: px(27), height: px(27) }} />

      <div className="face" style={{ gap: px(5) }}>
        <div className="eyes" style={{ gap: px(20) }}>
          {asleep ? (
            <>
              <i className="eye shut" style={{ width: px(15), height: px(7) }} />
              <i className="eye shut" style={{ width: px(15), height: px(7) }} />
            </>
          ) : (
            <>
              <i className="eye" style={{ width: px(10), height: px(12) }} />
              <i className="eye" style={{ width: px(10), height: px(12) }} />
            </>
          )}
        </div>
        {state === 'hungry' ? (
          <i className="mouth open" style={{ width: px(13), height: px(11) }} />
        ) : (
          <i className="mouth" style={{ width: px(17), height: px(7) }} />
        )}
      </div>

      {asleep && (
        <>
          <i className="z" style={{ right: px(-2), top: px(6) }}>z</i>
          <i className="z slow" style={{ right: px(-8), top: px(16) }}>z</i>
        </>
      )}
    </div>
  )
}
