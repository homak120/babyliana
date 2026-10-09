# Feed alert — the bottle prompt, on the lock screen

Status: **built, not yet deployed** (D-069). Needs the server steps in
`supabase/README.md` § The feed alert before it does anything on a phone.

## What it is

A push notification at the moment the card's **make milk** prompt goes up —
the target wake time minus the prep lead (D-036, D-055). Same instant, same
words, same rule. It is that prompt, delivered to a phone that is in a pocket.

```
make milk
Liana · next feed by 3:40 AM
```

It derives nothing the card does not already derive. There is no new threshold,
no new rule about when to feed, and no view about whether anyone did — the tone
rule holds for the same reason it holds on the card.

## Rules

- **One alert per target.** It fires once when the prompt goes up. It does not
  repeat, escalate, or fire again at the target itself.
- **Silent when the card is silent.** No feed logged yet, or a feed running —
  the same conditions that hide the wake line.
- **Logging a feed cancels it.** The target moves, so the pending alert moves
  with it. Nothing is dismissed and nothing is stored about a dismissal.
- **Stale alerts are dropped, not delivered late.** If the moment passed more
  than 30 minutes ago — a backdated feed, a server that was asleep — nothing is
  sent. A notification about a bottle that was due an hour ago is noise.
- **Per device, opt-in.** A switch in settings, *only here*. Whoever is on duty
  turns theirs on; whoever is asleep leaves theirs off. Nothing is on by
  default, and nobody is asked on first run.
- **Every subscribed device for the baby gets it.** No "whose turn" logic —
  the switch is that logic, held by a person.

## How it works

A PWA that is not open cannot schedule its own notification. The server sends
it.

1. **After every successful sync, the phone publishes the alert time** — one row
   per baby in `app.feed_alert`: `fire_at` (target minus lead) and `target_at`.
   Computed by the same functions the card uses (`targetWake`, `ongoingFeed`,
   the shared cycles and lead), on the phone, in the phone's timezone. Both
   phones compute the same answer from the same synced log; last write wins and
   they agree.
   **The cycle and the lead are read off the synced baby row**, not the local
   cache — the cache catches up only when the log screen reconciles, and a
   phone publishing from a stale cache would overwrite the right time with the
   old one (`effective` in `settings.ts`).
2. **A turned-on device registers a Web Push subscription** in
   `app.push_subscription` — endpoint, keys, which baby, and its clock format.
3. **`pg_cron` calls the `feed-alert` edge function every minute.** It claims
   every row whose `fire_at` has arrived and has not been sent (atomically, so
   two overlapping runs cannot double-send), and pushes to that baby's
   subscriptions. An endpoint the push service says is gone is deleted.
4. **The service worker shows it** (`public/push-sw.js`) and a tap opens the app.

Why the phone computes the time rather than the server: the cycle windows are
clock-of-day in the phone's timezone (`cycleFor`), and the card's rule lives in
TypeScript. Re-deriving it in SQL would be a second copy of D-036 to drift.

## Known gap, accepted

A feed logged on a phone with no signal has not reached the server, so the
server may send an alert for the target that feed replaced. Harmless — a prompt
for a bottle already made — and it closes when that phone syncs. Not a reason to
change how sync works (D-058).

Delivery is best-effort. A claimed alert whose push fails is not retried.

## Platform

iOS delivers Web Push only to a PWA added to the home screen (16.4+). In a
Safari tab the switch says to add the app to the home screen instead. The
permission prompt has to come from a tap, which is why the switch asks and first
run does not.

## Not this

- The playful "I love you" message from the baby — separate, not yet decided.
- Any alert other than the bottle prompt. A second kind of alert is a new
  decision, not a new row in this file.
