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

- [ ] A feed with a single volume — `60`
- [ ] A feed split by source — `25(B) + 45(F)`
- [ ] A feed split without source — `30 + 30`
- [ ] A pee
- [ ] A poop
- [ ] A poop with colour and consistency — `2 (G→Y liquid)`
- [ ] A pee and a poop in the same change
- [ ] An entry with an unknown or approximate time — `04:?`
- [ ] An entry with an unknown volume — `?`
- [ ] An entry logged out of order, hours after it happened
- [ ] An entry corrected after it was recorded
- [ ] An entry deleted after it was recorded
- [ ] A row with a diaper and no feed
- [ ] A row with a feed and no diaper
- [ ] Anything not anticipated above — free-text note on any event

The last item is the one that makes the list survive contact with reality. It is
the app's equivalent of paper accepting a stray scribble.

## How to test it

Take the photographed log. Enter all seven days into the app. If any entry
cannot be represented faithfully, the app is not ready.

This is a real test that should be run before Phase 9 (reveal).
