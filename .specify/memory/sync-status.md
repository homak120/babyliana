# Sync status

What the user sees about sync, and what is kept for the developer. D-067.

## States

| State | Cloud icon | Colour | Means | Reload button in status row |
| --- | --- | --- | --- | --- |
| `idle` | `cloud_done` | mint | everything sent and fetched | no |
| `syncing` | `cloud_sync` | amber | a run is in progress | no |
| `offline` | `cloud_off` | accent | the phone reports no connection, or no server configured | no |
| `error` | `sync_problem` | accent | a push or pull failed | **yes** |

## Surfaces

- **Status row cloud** — a button; opens the sync sheet.
- **Sync sheet** — state in words, one sentence, waiting-to-send count, last
  synced, version and build time (D-068), connection, what stopped it (when not idle). *Try again*, *reload
  app*. Folded *details for the developer*: plain-text report and *copy*.
- **Add sheet** — a line under the header while `offline` or `error`. Never
  disables save.
- **After a write from the tab bar** (bottle, bedtime, end, resume) — a line
  above the bar for 4s if the post-write sync ends `offline` or `error`.

## The trail

`localStorage['babyliana.sync_trail']`, last 80 notes, `{at, msg, n?}`.
Survives a reload. Written on: a push that sent something, each fault (with
its message), going offline, coming back online, the first successful sync
after a non-idle state, and live-update channel states other than
`SUBSCRIBED`. A note identical to the previous one increments `n` instead of
adding a line.

## Rules

- Nothing here may block a write (non-negotiable 1).
- Sentences are descriptive and lead with the entry being kept on this phone.
- The raw error text is shown in the sheet's *what stopped it* row and the
  developer report — nowhere else.
