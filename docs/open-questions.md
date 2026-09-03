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

### Q-006 — Which secondary event types get promoted?

Sleep, weight, temperature, supplements, spit-up all exist in the registry. Some
may deserve the primary surface.

**Closed by:** Phase 8 solo run — observed use, not prediction (D-013).

---

### Q-007 — How does the timeslot appear in the entry flow?

**The storage half is settled** — D-019 makes a timeslot a first-class table, so
a moment holding several events is the model, not a UI convenience. What remains
is how that feels to use.

Open: does the user tap once to open a moment and then add things to it, or pick
an event type first and have the timeslot form around it? How is a second event
added to a moment already saved? Does the moment ever need to be visible as a
concept, or should it stay invisible plumbing?

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

**Constraint it must satisfy:** in the Milk column, blank and `?` must stay
visually distinct — see `.specify/memory/paper-log-baseline.md` § Blank is not
unknown. This is about *volume* only. Times carry no `?`, by D-018.
