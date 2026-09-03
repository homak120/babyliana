// The baby this deployment logs for.
//
// Hard-coded rather than stored, for MVP only — see D-022. There is no pairing
// flow: two phones, one baby, and both use this id. It is not in localStorage
// because a second copy could disagree with this one; when pairing arrives
// post-MVP, localStorage becomes its right home, since it will then arrive from
// a join rather than a constant.
//
// The row was created once through the REST API. The app never inserts it and
// only ever reads it — a missing baby is a setup error and should fail loudly
// rather than be papered over.
export const BABY_ID = '94c55231-e3dd-46d0-8567-fa8d0b90d809'
