# Open questions

Deliberately unanswered. **Do not guess these.** Each is marked with what will
close it. Guessing an answer here and building on it is worse than the hole.

---

### Q-001 — What is on the primary logging surface?

Which controls are large and permanent, and what sits behind a secondary
affordance.

**Closed by:** Phase 2 prototype, by tapping it. Not by reasoning (D-007).

**Constraints it must satisfy:** every event type reachable (D-006); feed and
diaper are the only types with evidence of constant use (D-010); it must be
operable one-handed, in the dark, without reading carefully.

---

### Q-002 — What does the screen lead with?

Provisionally *time since last feed*. Alternatives worth putting in front of
someone: last feed volume and source; a combined "3h 40m ago, 60mL (F)" line; a
mascot state instead of a number.

**Closed by:** Phase 2 prototype.

---

### Q-003 — Is the mascot the baby, or a separate creature?

This determines whether the app is a personal keepsake with a tracking function,
or a product with a personal skin. Both are legitimate. They are different apps.

**Closed by:** Phase 7, owner's decision.

**Note:** if the product path stays open, the art must be original in style.
Anything recognisably derived from an existing IP becomes a problem the moment
money is involved.

---

### Q-004 — Does Safari evict IndexedDB, and on what timeline?

Load-bearing. If local data can vanish, the local replica is not a disaster
recovery plan and the export becomes mandatory rather than prudent.

**Closed by:** Phase 3 spike — install it and leave it alone for a week.

---

### Q-005 — Is realtime latency acceptable in practice?

Expected to be seconds. Fine for "did she already feed her". Needs confirming on
a real home network with a backgrounded PWA, which is a different case from a
foregrounded tab.

**Closed by:** Phase 3 spike.

---

### Q-006 — Which secondary event types get promoted?

Sleep, weight, temperature, supplements, spit-up all exist in the registry. Some
may deserve the primary surface.

**Closed by:** Phase 8 solo run — observed use, not prediction (D-013).

---

### Q-007 — Does the app need a "row" concept?

The paper log's unit is a moment, not an event: one line often carries both a
feed and a diaper. Two separate events is the right storage model, but the
*entry flow* may want a combined "log what happened just now" that creates both
at once.

**Closed by:** Phase 2 prototype, then confirmed in Phase 8.

---

### Q-008 — Final name

"BabyLiana" is a working title. Keep it out of anything expensive to change.

**Closed by:** Phase 7.

---

### Q-009 — How faithful does the day view need to be to the paper page?

`.specify/memory/product-definition.md` names two things paper cannot do, and
one of them — remote visibility — is a *reading* problem. But Q-001 and Q-002
are both about the logging surface. Nothing currently tests whether the day view
is as scannable as the paper page, which is genuinely good at this: four
columns, date inherited down the rows, days separated by a blank line, roughly
eight rows.

The coverage test is "enter all seven days and compare to the photograph." That
test cannot be run without a read-back view, and the comparison is the point.

**Closed by:** Phase 2 prototype, alongside Q-001 and Q-002.

**Constraint it must satisfy:** blank and `?` must stay visually distinct — see
`.specify/memory/paper-log-baseline.md` § Blank is not unknown.

---

### Q-010 — What exactly do `corrects` and `deleted` mean?

`.specify/memory/event-model.md` lists `deleted` as an envelope field *and* says
a deletion is a tombstone event. Those are two different designs. If `deleted`
is a flag set on the original, that mutates an event in place and breaks a
non-negotiable. If a tombstone is a new event carrying `deleted` plus
`corrects`, the field is fine but the envelope table reads as though it belongs
on every event.

Unresolved alongside it: if B corrects A and C corrects B, does `corrects` point
at the immediate predecessor or at the head of the chain? Union-by-id merge
means two devices can each produce a correction to the same event while offline.
"There is no conflict to resolve" is true of storage and not true of the reader.

**Closed by:** Phase 4, on ground the spike has proven.

**Do not** write correction or deletion code before this closes.
