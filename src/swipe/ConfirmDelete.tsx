import { Icon } from '../log/Icon'

/**
 * Q-012: the design's confirm sheet, chosen over D-025's undo toast.
 *
 * The case for it is D-003 — a hard delete with no tombstone. Once it is gone
 * there is nothing to restore it from, and it syncs to the other phone. So this
 * names the entry back rather than asking abstractly, and "keep it" is the
 * wider, calmer target of the two.
 */
export function ConfirmDelete({
  label, onKeep, onDelete,
}: {
  label: string
  onKeep: () => void
  onDelete: () => void
}) {
  return (
    <div className="confirm-scrim" onClick={onKeep}>
      <div
        className="confirm"
        role="dialog"
        aria-modal="true"
        aria-label="delete this entry?"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>delete this entry?</h2>
        <p className="confirm-what">{label}</p>
        <p className="confirm-note">this removes everything logged at that time.</p>

        <div className="confirm-actions">
          <button type="button" className="keep" onClick={onKeep}>
            keep it
          </button>
          <button type="button" className="del" onClick={onDelete}>
            <Icon name="delete" size={20} />
            delete
          </button>
        </div>
      </div>
    </div>
  )
}
