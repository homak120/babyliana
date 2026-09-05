# The coverage requirement

## The rule

**Every mark on the paper page must have a home in the app.**

If any mark does not, the pen stays on the nightstand. Once the pen is on the
nightstand, both systems are in use, and the app has failed regardless of how
good the parts it does cover are.

This is the acceptance test for the product. It is not a nice-to-have.

## Why this overrides "ship the minimum"

The standard advice is to ship two event types and add the rest later. That is
wrong here, and the reason is specific to this user and this competitor.

The competitor is paper. Paper's advantage is not speed — it is that it accepts
anything. A strikethrough, a question mark, an arrow, a value squeezed into a
margin, a note nobody planned a column for. A partial app does not replace
paper; it sits next to it.

So breadth at launch beats minimalism at launch, even at some cost to speed.

## The checklist

Derived directly from `paper-log-baseline.md`. Every item must be expressible:

- [x] A feed with a single volume — `60`
- [x] A feed split by source — `25(B) + 45(F)`
- [x] A feed split without source — `30 + 30`
- [x] A pee
- [x] A poop
- [x] A poop with colour and consistency — `2 (G→Y liquid)`
- [x] A pee and a poop in the same change
- [x] An entry whose time is set by hand, long after it happened — the app has
      no `?` for time (D-018), so this must be fast rather than expressible
- [x] An entry with an unknown volume — `?`
- [x] An entry logged out of order, hours after it happened
- [x] An entry corrected after it was recorded
- [x] An entry deleted after it was recorded
- [x] A row with a diaper and no feed
- [x] A row with a feed and no diaper
- [x] Something that took a stretch of time rather than happening at an instant
- [x] Anything not anticipated above — the `other` type, plus a free-text note
      on any event (D-020)

The last item is the one that makes the list survive contact with reality. It is
the app's equivalent of paper accepting a stray scribble.

## How to test it

Take the photographed log. Enter **all ten days** into the app — the photographs
run 8/26 through 9/4, three days past what `paper-log-baseline.md` writes up. If
any entry cannot be represented faithfully, the app is not ready.

**Four marks cannot be read at all** — two overwritten hours on 8/30, one
ambiguous milk cell on 9/1, and 8/31's out-of-order `12:40`. They are holes in
the source, not failures of the app; skip them and do not let them fail the test.
`docs/status.md` § Open threads describes each.

**"Faithfully" means every fact is represented, not every glyph reproduced.**
The one deliberate divergence is time: `04:?` becomes an ordinary time, because
D-018 removed the precision marker on purpose. Everything else on the page —
including `?` in the Milk column, which is a *volume* and is unaffected — must
still come through. When comparing against the photograph, judge whether the
same events at the same moments with the same values are there. Do not fail the
test on the missing question mark, and do not let it excuse anything else.

This is a real test that should be run before Phase 9 (reveal).
