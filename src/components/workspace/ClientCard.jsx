import WorkspaceIcon from './WorkspaceIcon'
import styles from './ClientManagement.module.css'
import {
  formatClientCardSummary,
  formatClientDate,
  getClientAvatarTone,
  getClientInitials,
} from './clientManagementHelpers'

/**
 * Renders a client record card for the redesigned management grid.
 *
 * @param {object} props - The component props.
 * @param {object} props.client - The serialized client record.
 * @param {boolean} [props.isDeleting=false] - Whether a delete request is in progress for the card.
 * @param {(client: object) => void} props.onDelete - Invoked when the delete action is selected.
 * @param {(client: object) => void} props.onEdit - Invoked when the edit action is selected.
 * @returns {JSX.Element} The rendered client card.
 */
export default function ClientCard({ client, isDeleting = false, onDelete, onEdit }) {
  const avatarTone = getClientAvatarTone(client.id || client.name)

  return (
    <article className={styles.clientCard}>
      <div className={styles.clientCardHeader}>
        <span
          aria-hidden="true"
          className={styles.clientAvatar}
          style={{
            '--client-avatar-background': avatarTone.background,
            '--client-avatar-foreground': avatarTone.foreground,
          }}
        >
          {getClientInitials(client.name)}
        </span>

        <div className={styles.clientIdentity}>
          <h2 className={styles.clientName}>{client.name}</h2>
          <p className={styles.clientMeta}>{formatClientCardSummary(client)}</p>
        </div>
      </div>

      <div className={styles.clientCardFooter}>
        <span className={styles.clientDateValue}>{formatClientDate(client.createdAt)}</span>

        <div className={styles.clientCardActions}>
          <button
            aria-label={`Edit ${client.name}`}
            className={styles.iconActionButton}
            onClick={() => onEdit?.(client)}
            type="button"
          >
            <WorkspaceIcon name="edit" size={16} />
          </button>
          <button
            aria-label={`Delete ${client.name}`}
            className={`${styles.iconActionButton} ${styles.iconActionButtonDanger}`}
            disabled={isDeleting}
            onClick={() => onDelete?.(client)}
            type="button"
          >
            <WorkspaceIcon name="trash" size={16} />
          </button>
        </div>
      </div>
    </article>
  )
}
