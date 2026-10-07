import type { SyncState } from '../sync'

/** The cloud's glyph per state (D-067): offline and failing are different reds. */
export const SYNC_ICON: Record<SyncState, string> = {
  idle: 'cloud_done',
  syncing: 'cloud_sync',
  offline: 'cloud_off',
  error: 'sync_problem',
}
