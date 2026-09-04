import { useEffect, useRef, useState } from 'react'

// A readout of what a real finger actually produces, on the phone that is
// failing. Three swipe fixes passed on desktop and on the iOS Simulator and
// still did nothing for the owner, so the next move is not another guess —
// it is his own device reporting what it sends.
//
// The decision logic here is a copy of DayRow's on purpose. If this says the
// axis locked to 'y', that is exactly why the row would not move.

const DECIDE_AT = 10
const ENGAGE_AT = 8
const ACTIONS_W = 176
const SNAP_AT = 40

type Line = { t: string; detail: string; bad?: boolean }

/**
 * What the tab bar actually has to work with on this device.
 *
 * The owner's day screen shows ~104pt below the FAB where 56 is expected, and
 * it is not reproducible in any desktop browser — safe-area insets are 0 there.
 * Rather than guess at iOS a fifth time, this reads the numbers off the phone.
 */
function Viewport() {
  const probe = useRef<HTMLDivElement>(null)
  const [v, setV] = useState<Record<string, string>>({})

  useEffect(() => {
    const read = () => {
      const cs = probe.current ? getComputedStyle(probe.current) : null
      const nav = document.querySelector('nav.tabs')
      setV({
        'screen': `${screen.width} x ${screen.height}`,
        'window.inner': `${innerWidth} x ${innerHeight}`,
        'visualViewport': visualViewport ? `${Math.round(visualViewport.width)} x ${Math.round(visualViewport.height)}` : 'n/a',
        'documentElement': `${document.documentElement.clientWidth} x ${document.documentElement.clientHeight}`,
        'inset top': cs?.paddingTop ?? '?',
        'inset right': cs?.paddingRight ?? '?',
        'inset bottom': cs?.paddingBottom ?? '?',
        'inset left': cs?.paddingLeft ?? '?',
        'devicePixelRatio': String(devicePixelRatio),
        'nav bottom vs viewport': nav
          ? `${Math.round(nav.getBoundingClientRect().bottom)} / ${innerHeight}`
          : 'nav not on this page',
      })
    }
    read()
    addEventListener('resize', read)
    visualViewport?.addEventListener('resize', read)
    return () => {
      removeEventListener('resize', read)
      visualViewport?.removeEventListener('resize', read)
    }
  }, [])

  return (
    <>
      {/* Its padding *is* the four insets; reading it back is the only way to
          see what env() actually resolves to on the device. */}
      <div
        ref={probe}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 0,
          height: 0,
          paddingTop: 'env(safe-area-inset-top)',
          paddingRight: 'env(safe-area-inset-right)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          pointerEvents: 'none',
          visibility: 'hidden',
        }}
      />
      <h2 style={{ font: '700 17px/1.3 system-ui', margin: '1.5rem 0 0.5rem' }}>viewport</h2>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {Object.entries(v).map(([k, val]) => (
          <li key={k}><b>{k}</b> {val}</li>
        ))}
      </ul>
    </>
  )
}

export default function TouchProbe() {
  const [lines, setLines] = useState<Line[]>([])
  const [verdict, setVerdict] = useState<string | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    let from: { x: number; y: number } | null = null
    let axis: 'x' | 'y' | null = null
    let moves = 0
    let travelled = 0
    let prevented = false
    const log = (t: string, detail: string, bad?: boolean) =>
      setLines((l) => [...l.slice(-40), { t, detail, bad }])

    const down = (e: TouchEvent) => {
      const p = e.touches[0]
      from = { x: p.clientX, y: p.clientY }
      axis = null
      moves = 0
      travelled = 0
      prevented = false
      setLines([])
      setVerdict(null)
      log('touchstart', `at ${Math.round(p.clientX)},${Math.round(p.clientY)}`)
    }

    const move = (e: TouchEvent) => {
      if (!from) return
      const p = e.touches[0]
      const mx = p.clientX - from.x
      const my = p.clientY - from.y
      moves++

      if (axis === null) {
        const d = Math.hypot(mx, my)
        if (d < DECIDE_AT) {
          if (moves <= 6) log(`move ${moves}`, `dx ${mx.toFixed(0)} dy ${my.toFixed(0)} — under ${DECIDE_AT}px, undecided`)
          return
        }
        axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y'
        log(
          `decided after ${moves} moves`,
          `dx ${mx.toFixed(0)} dy ${my.toFixed(0)} -> axis ${axis.toUpperCase()}`,
          axis === 'y',
        )
      }
      if (axis === 'y') return

      e.preventDefault()
      prevented = true
      if (Math.abs(mx) < ENGAGE_AT && travelled === 0) return
      travelled = Math.max(-ACTIONS_W, Math.min(0, mx))
    }

    const up = (e: TouchEvent) => {
      if (!from) return
      log(e.type, `${moves} moves, axis ${axis ?? 'never decided'}, offset ${travelled.toFixed(0)}`, e.type === 'touchcancel')
      if (e.type === 'touchcancel') {
        setVerdict('iOS CANCELLED the touch — something else took the gesture')
      } else if (axis === null) {
        setVerdict(`never moved ${DECIDE_AT}px — too short to be a swipe`)
      } else if (axis === 'y') {
        setVerdict('read as a VERTICAL scroll — this is why the row would not open')
      } else if (!prevented) {
        setVerdict('horizontal, but preventDefault never ran')
      } else if (travelled < -SNAP_AT) {
        setVerdict('WOULD OPEN — this swipe works')
      } else {
        setVerdict(`horizontal but only ${Math.abs(travelled).toFixed(0)}px; needs ${SNAP_AT}px`)
      }
      from = null
    }

    el.addEventListener('touchstart', down, { passive: true })
    el.addEventListener('touchmove', move, { passive: false })
    el.addEventListener('touchend', up)
    el.addEventListener('touchcancel', up)
    return () => {
      el.removeEventListener('touchstart', down)
      el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', up)
      el.removeEventListener('touchcancel', up)
    }
  }, [])

  return (
    <main style={{ font: '15px/1.5 ui-monospace, Menlo, monospace', padding: '1rem', paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
      <h1 style={{ font: '700 19px/1.3 system-ui', margin: '0 0 0.5rem' }}>touch probe</h1>
      <p style={{ margin: '0 0 1rem', color: '#666' }}>
        Swipe left across the grey bar exactly as you would on a row. Then screenshot this page.
      </p>

      <div
        ref={boxRef}
        style={{
          height: 84,
          display: 'grid',
          placeItems: 'center',
          background: '#e9e4de',
          borderRadius: 12,
          touchAction: 'pan-y',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          WebkitTouchCallout: 'none',
        }}
      >
        swipe here
      </div>

      {verdict && (
        <p
          style={{
            margin: '1rem 0',
            padding: '0.75rem',
            borderRadius: 10,
            fontWeight: 700,
            background: verdict.startsWith('WOULD OPEN') ? '#d8f0dd' : '#f6dcdc',
          }}
        >
          {verdict}
        </p>
      )}

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {lines.map((l, i) => (
          <li key={i} style={{ color: l.bad ? '#a11' : '#222' }}>
            <b>{l.t}</b> {l.detail}
          </li>
        ))}
      </ul>

      <Viewport />

      <p style={{ marginTop: '1.5rem', color: '#666' }}>
        build {__BUILD_TIME__} · standalone {String(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window.navigator as any).standalone ?? matchMedia('(display-mode: standalone)').matches,
        )}
      </p>
    </main>
  )
}
