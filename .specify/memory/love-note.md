# Love note — Liana, in her own voice

Status: **built, not yet deployed** (D-070). Needs `0011` run and the
`feed-alert` function redeployed before it does anything.

## What it is

A playful push in Liana's voice, to whoever holds the phone, by their caregiver
name:

```
Liana
Mom, I love you!
```

Forty lines, picked at random, in `public/push-sw.js` — the last ten in baby
language. Every line carries the
caregiver's name (`mom` → *Mom*). The mascot is Liana (Q-003, closed by D-070),
so she speaks as herself.

## Rules

- **Only while she reads *awake*.** The window is the mascot's own (`awakeWindow`
  in `derive.ts`, the `HOLDS` thresholds of D-035): 1h30–1h45 after a breast
  feed, 2h–2h30 after anything else. A note lands as the card's art turns to
  *awake*, never on any other state.
- **Daytime only, because *awake* is.** Overnight the mascot reads *sleeping*, so
  there is no window to land in — which also keeps a note off a sleeping parent's
  lock screen. A window running into the evening is cut at 20:00.
- **None while a feed or a logged sleep is running.** Both outrank *awake*.
- **Twice a day at most, per device, in random windows.** Each window gets one
  roll per device, winning with *notes left today ÷ windows left today* (daylight
  to 20:00 over a three-hour feed). Two spread across the day; never a third.
  Each device rolls separately, so Mom's and Dad's notes are independent.
- **On by default, for devices that already have alerts on.** They have already
  allowed notifications. Each device can switch them off in settings, beside the
  feed alert switch.
- **No line says she is awake or just woke.** The window is the clock's guess,
  not an observation.
- **Warm and nothing else.** No line asks for anything, mentions hunger or being
  alone, or has a view about how anyone is doing — the tone rule, for words.
  `verify-alerts` checks for the obvious words.

## How it works

The feed alert's machinery (`feed-alert.md`), extended:

1. The phone publishes `awake_from` / `awake_until` on `app.feed_alert`, beside
   `fire_at`, after every successful sync.
2. The subscription row carries the device's `caregiver_id`, its timezone (for
   "a day") and its `love` switch.
3. Each minute the same edge function also calls `claim_love_notes()`, which
   rolls once per device per open window, counts per local day, and returns the
   winners. The function sends `{ kind: 'love', name, baby }`.
4. The service worker picks the line.

A device with no caregiver name, or a timezone Postgres does not recognise, is
skipped rather than guessed at.
