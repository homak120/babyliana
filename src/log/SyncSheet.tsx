import { useEffect, useState } from 'react'
import { getCaregiverId } from '../caregiver-id'
import { hhmm } from '../day/cells'
import { getBabyId } from '../household'
import { markOverlay } from '../overlay'
import {
  lastSyncError,
  lastSyncErrorAt,
  pendingCount,
  subscribe,
  sync,
  syncState,
  syncTrail,
  type SyncState,
} from '../sync'
import { reloadApp } from '../updates'
import { Icon } from './Icon'
import { SYNC_ICON } from './syncIcon'

/**
 * What the cloud in the status row means, behind a tap on it (D-067).
 *
 * The cloud was a colour and nothing else: green, amber or red, and red covered
 * both "no signal", which clears itself, and "the server refused", which never
 * does. This sheet says which, in a sentence, and offers the two things that
 * fix most of it — try again, and reload.
 *
 * **Descriptive, never alarming.** Nothing logged is ever at risk from a sync
 * fault — the write is local and the outbox keeps it — so every sentence leads
 * with that. The developer's detail is folded away under its own heading: it is
 * there to be copied and sent, not read at 4am.
 */

const TITLE: Record<SyncState, string> = {
  idle: 'synced',
  syncing: 'syncing',
  offline: 'offline',
  error: 'not syncing',
}

const SAY: Record<SyncState, string> = {
  idle: 'everything logged here has been sent, and this phone has the latest from everyone else.',
  syncing: 'sending and fetching now.',
  offline:
    'no connection. anything you log is kept on this phone and sent when the connection comes back.',
  error:
    'this phone can’t reach the log right now. anything you log is kept on this phone and sent once it can. reloading the app usually clears this.',
}

function ago(at: number | null, now: number): string {
  if (at === null) return 'not yet, since the app opened'
  const mins = Math.round((now - at) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  return `at ${hhmm(new Date(at).toISOString())}`
}

const stamp = (at: number | null) => (at === null ? '—' : new Date(at).toISOString())

/** Plain text, so it survives being pasted into a message. */
function report(pending: number | null): string {
  const { state, lastSyncedAt } = syncState()
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches
  const lines = [
    `babyliana sync report — ${new Date().toISOString()}`,
    `build: ${__BUILD_TIME__}`,
    `state: ${state}`,
    `online: ${navigator.onLine}`,
    `waiting to send: ${pending ?? '?'}`,
    `last synced: ${stamp(lastSyncedAt)}`,
    `last error: ${lastSyncError() ?? '—'}`,
    `last error at: ${stamp(lastSyncErrorAt())}`,
    `baby: ${getBabyId() ?? '—'}`,
    `caregiver: ${getCaregiverId() ?? '—'}`,
    `installed: ${standalone ? 'yes' : 'no'}`,
    `service worker: ${navigator.serviceWorker?.controller ? 'active' : 'none'}`,
    `agent: ${navigator.userAgent}`,
    '',
    'trail, newest first:',
    ...[...syncTrail()].reverse().map(
      (t) => `${new Date(t.at).toISOString()}  ${t.msg}${t.n ? ` (×${t.n})` : ''}`,
    ),
  ]
  return lines.join('\n')
}

export function SyncSheet({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState(syncState())
  const [pending, setPending] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  // Captured with each read rather than at render, so "3 min ago" is measured
  // from the moment the state was looked at.
  const [now, setNow] = useState(() => Date.now())

  // The tab bar hides behind any sheet (D-028).
  useEffect(() => {
    markOverlay(true)
    return () => markOverlay(false)
  }, [])

  useEffect(() => {
    const read = () => {
      setS(syncState())
      setNow(Date.now())
      void pendingCount().then(setPending)
    }
    read()
    return subscribe(read)
  }, [])

  const error = lastSyncError()

  return (
    <div className="sheet syncsheet" role="dialog" aria-label="sync">
      <header className="sheet-head">
        <h2 className={`sync ${s.state}`}>
          <Icon name={SYNC_ICON[s.state]} size={20} /> {TITLE[s.state]}
        </h2>
        <button type="button" className="x" onClick={onClose} aria-label="close">
          <Icon name="close" size={20} />
        </button>
      </header>

      <p className="syncsay">{SAY[s.state]}</p>

      <section className="block syncfacts">
        <div className="setrow">
          <span className="setlabel">waiting to send</span>
          <span className="syncval">{pending === null ? '…' : pending === 0 ? 'nothing' : pending}</span>
        </div>
        <div className="setrow">
          <span className="setlabel">last synced</span>
          <span className="syncval">{ago(s.lastSyncedAt, now)}</span>
        </div>
        <div className="setrow">
          <span className="setlabel">connection</span>
          <span className="syncval">{navigator.onLine ? 'online' : 'offline'}</span>
        </div>
        {error && s.state !== 'idle' && (
          <div className="setrow">
            <span className="setlabel">what stopped it</span>
            <span className="syncval syncerr">{error}</span>
          </div>
        )}
      </section>

      <div className="syncacts">
        <button
          type="button"
          className="syncact"
          disabled={s.state === 'syncing'}
          onClick={() => void sync()}
        >
          <Icon name="sync" size={18} /> try again
        </button>
        <button type="button" className="syncact" onClick={reloadApp}>
          <Icon name="refresh" size={18} /> reload app
        </button>
      </div>

      <details className="syncdebug">
        <summary>details for the developer</summary>
        <pre>{report(pending)}</pre>
        <button
          type="button"
          className="syncact"
          onClick={() => {
            void navigator.clipboard?.writeText(report(pending)).then(
              () => setCopied(true),
              () => setCopied(false),
            )
          }}
        >
          <Icon name={copied ? 'check' : 'content_copy'} size={18} /> {copied ? 'copied' : 'copy'}
        </button>
      </details>
    </div>
  )
}
