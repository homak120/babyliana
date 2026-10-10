// The feed alert's sender (D-069), and since D-070 the love note's too. Called
// once a minute by `pg_cron` (supabase/migrations/0010_feed_alert.sql § 4);
// nothing else calls it.
//
// Two claims per minute, each atomic in the database: feed alerts that are due
// (0010) and love notes whose roll came up (0011). Everything here is sending.
//
// It derives nothing. The phones publish when the next alert is due, from the
// same functions the card uses; this claims whatever has arrived and pushes it
// to that baby's subscribed devices. `.specify/memory/feed-alert.md` is the spec.
//
// Deployed with `--no-verify-jwt`, because the caller is the database and holds
// no user session. The shared secret is what stands in for one. Even without
// it the worst a caller could do is send an alert that was due anyway.
//
// Secrets (Edge Functions → Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// VAPID_SUBJECT (the app's https URL or a mailto:), CRON_SECRET. SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are injected by the platform.

import { createClient } from 'npm:@supabase/supabase-js@2.95.0'
import webpush from 'npm:web-push@3.6.7'

const env = (k: string) => {
  const v = Deno.env.get(k)
  if (!v) throw new Error(`missing secret ${k}`)
  return v
}

webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'))

const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  db: { schema: 'app' },
  auth: { persistSession: false },
})

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

type Due = { baby_id: string; baby_name: string; target_at: string | null }
type Sub = { endpoint: string; p256dh: string; auth: string; clock: string | null }

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== env('CRON_SECRET')) return json({ error: 'forbidden' }, 403)

  const { data, error } = await db.rpc('claim_feed_alerts')
  if (error) return json({ error: error.message }, 500)
  const due = (data ?? []) as Due[]

  let sent = 0
  let gone = 0
  const failed: string[] = []

  for (const alert of due) {
    const { data: subs, error: subErr } = await db
      .from('push_subscription')
      .select('endpoint, p256dh, auth, clock')
      .eq('baby_id', alert.baby_id)
    if (subErr) {
      failed.push(`${alert.baby_id}: ${subErr.message}`)
      continue
    }

    for (const s of (subs ?? []) as Sub[]) {
      // The words are the service worker's (public/push-sw.js), so the phone
      // formats the time in its own timezone. This sends facts, not prose.
      const payload = JSON.stringify({
        kind: 'feed',
        baby: alert.baby_name,
        targetAt: alert.target_at,
        clock: s.clock,
      })
      try {
        // TTL matches the staleness cut-off in `claim_feed_alerts`: a phone that
        // is off for half an hour should not light up with it afterwards.
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 30 * 60, urgency: 'high' },
        )
        sent++
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        // 404 / 410: the push service has forgotten this install — the app was
        // deleted, or permission withdrawn. The row can never deliver again.
        if (code === 404 || code === 410) {
          await db.from('push_subscription').delete().eq('endpoint', s.endpoint)
          gone++
        } else {
          failed.push(`${code ?? '?'}: ${e instanceof Error ? e.message : String(e)}`)
        }
      }
    }
  }

  // Love notes (D-070). The database already decided who gets one and marked
  // it, so this only sends. The words are the service worker's: it picks the
  // line, so changing them is a deploy of the app, not of this function.
  const { data: loveData, error: loveErr } = await db.rpc('claim_love_notes')
  if (loveErr) failed.push(`love: ${loveErr.message}`)
  const love = (loveData ?? []) as { endpoint: string; caregiver_name: string; baby_name: string }[]
  let loved = 0

  for (const note of love) {
    const { data: sub } = await db
      .from('push_subscription')
      .select('endpoint, p256dh, auth')
      .eq('endpoint', note.endpoint)
      .maybeSingle()
    if (!sub) continue
    try {
      // A short TTL: a note that cannot arrive while she is awake should not
      // arrive at all.
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ kind: 'love', name: note.caregiver_name, baby: note.baby_name }),
        { TTL: 15 * 60, urgency: 'normal' },
      )
      loved++
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) {
        await db.from('push_subscription').delete().eq('endpoint', sub.endpoint)
        gone++
      } else {
        failed.push(`love ${code ?? '?'}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

  return json({ due: due.length, sent, love: love.length, loved, gone, failed })
})
