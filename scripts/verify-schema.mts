// The client's row shapes against the `app` schema, statically.
//
// **Sync upserts whole local rows.** So a field the client carries that the
// table does not have fails the upsert, `push` returns false, reconcile is
// skipped while writes are pending, and the app goes on looking perfectly
// healthy while nothing reaches the other phone. That failure has already cost
// this project one incident (D-039) and is why `supabase/README.md` says a
// migration must land before the code that writes it.
//
// The reverse direction — a column in the table the client never sends — is
// usually harmless, because the column takes its default. **Usually.** It was not
// harmless for `caregiver.user_id`: the policy is
// `with check (user_id = auth.uid())`, so a row without it is refused outright
// and takes the whole outbox down with it. That one shipped, reached a real
// phone, and looked like "logging works but nothing syncs". Hence this file, and
// hence it reports both directions.
//
// Static on purpose: it parses the migration and the types, so it runs in
// milliseconds, needs no session and no network, and catches the mistake at the
// point it is made rather than at the point someone notices the sync dot.
import { readFileSync } from 'node:fs'

const sql = readFileSync('supabase/migrations/0007_app_schema.sql', 'utf8')
const ts = readFileSync('src/types.ts', 'utf8')

const TYPES = ['uuid', 'text', 'integer', 'boolean', 'numeric', 'timestamptz', 'jsonb']

function sqlCols(table: string): string[] {
  const m = new RegExp(`create table if not exists app\\.${table} \\(([\\s\\S]*?)\\n\\);`).exec(sql)
  if (!m) throw new Error(`no create table for app.${table}`)
  return m[1]
    .replace(/--[^\n]*/g, '')
    .split('\n')
    .map((l) => new RegExp(`^\\s*([a-z_]+)\\s+(${TYPES.join('|')})`).exec(l))
    .filter((x): x is RegExpExecArray => !!x)
    .map((x) => x[1])
}

function tsCols(name: string): string[] {
  const m = new RegExp(`export type ${name} = \\{([\\s\\S]*?)\\n\\}`).exec(ts)
  if (!m) throw new Error(`no type ${name}`)
  const body = m[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
  return [...body.matchAll(/^ {2}([a-z_]+)\??:/gm)].map((x) => x[1])
}

let fail = 0
for (const [table, type] of [
  ['baby', 'Baby'],
  ['caregiver', 'Caregiver'],
  ['timeslot', 'Timeslot'],
  ['event', 'LogEvent'],
] as const) {
  const db = new Set(sqlCols(table))
  const client = new Set(tsCols(type))
  const missingInDb = [...client].filter((c) => !db.has(c))
  const missingInClient = [...db].filter((c) => !client.has(c))

  if (missingInDb.length) {
    fail++
    console.log(`  FAIL  app.${table}: the client sends ${missingInDb.join(', ')}, which the table does not have`)
    console.log('        every upsert fails and the outbox stalls silently')
  }
  if (missingInClient.length) {
    fail++
    console.log(`  FAIL  app.${table}: the table has ${missingInClient.join(', ')}, which the client never sets`)
    console.log('        harmless if the column has a default — fatal if a policy checks it')
  }
  if (!missingInDb.length && !missingInClient.length) {
    console.log(`  ok    app.${table} — ${db.size} columns, client and table agree`)
  }
}

console.log(fail === 0 ? '\n  the client and `app` agree\n' : `\n  ${fail} FAILED\n`)
process.exit(fail === 0 ? 0 : 1)
