// Mirrors the schema in supabase/migrations/0001_initial_schema.sql.
// Keep the two in step — event-model.md § Schema (Postgres) is the reference.

export type EventType =
  | 'feed'
  | 'diaper'
  | 'sleep'
  | 'weight'
  | 'temperature'
  | 'supplement'
  | 'spit_up'
  | 'other'

export type Source = 'breast_milk' | 'formula' | 'unknown'
export type PoopColour = 'yellow' | 'green' | 'brown' | 'dark' | 'other'
export type PoopConsistency = 'liquid' | 'soft' | 'seedy' | 'firm' | 'other'

export type Baby = {
  id: string
  name: string
  created_at: string
  updated_at: string
  updated_by: string | null
}

export type Device = {
  id: string
  name: string | null
  created_at: string
  updated_at: string
  updated_by: string | null
}

/** A moment. One time, one or more entries hanging off it (D-019). */
export type Timeslot = {
  id: string
  baby_id: string
  logged_by: string
  occurred_at: string
  /** Null is a point in time; set makes the moment a period (D-020). */
  ended_at: string | null
  recorded_at: string
  updated_at: string
  updated_by: string | null
  note: string | null
}

/**
 * One thing that happened inside a moment. Named LogEvent rather than Event to
 * avoid shadowing the DOM's Event; the table is `event`.
 */
export type LogEvent = {
  id: string
  timeslot_id: string
  type: EventType
  note: string | null
  recorded_at: string
  updated_at: string
  updated_by: string | null

  // feed — one volume, one source. A split feed is two of these in one
  // moment, not one row with two halves (D-019).
  volume_ml: number | null
  source: Source | null

  // diaper — both may be true on one change
  pee: boolean | null
  poop: boolean | null
  poop_colour: PoopColour | null
  poop_consistency: PoopConsistency | null

  // weight / temperature
  grams: number | null
  celsius: number | null

  // supplement
  supplement_name: string | null
  amount: string | null

  // spit_up
  severity: string | null
}

/** A moment with its entries, which is how the UI always deals with them. */
export type Moment = { timeslot: Timeslot; events: LogEvent[] }

/** What the add sheet produces before ids and timestamps are attached. */
export type DraftEntry = Partial<
  Pick<
    LogEvent,
    | 'volume_ml'
    | 'source'
    | 'pee'
    | 'poop'
    | 'poop_colour'
    | 'poop_consistency'
    | 'grams'
    | 'celsius'
    | 'supplement_name'
    | 'amount'
    | 'severity'
    | 'note'
  >
> & { type: EventType }
