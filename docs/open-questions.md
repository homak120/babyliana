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
