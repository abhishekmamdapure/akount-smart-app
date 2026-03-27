import WorkspaceIcon from '../../WorkspaceIcon'
import workspaceStyles from '../../Workspace.module.css'
import styles from './PasswordManagerPage.module.css'

/**
 * Renders the inline custom-section title editor used in the vault modal header.
 *
 * @param {object} props - Component props.
 * @param {boolean} props.editing - Whether the title is currently editable.
 * @param {(event: import('react').ChangeEvent<HTMLInputElement>) => void} props.onChange - Title change handler.
 * @param {() => void} props.onEditEnd - Called when inline editing should finish.
 * @param {() => void} props.onEditStart - Called when inline editing should begin.
 * @param {string} props.title - The current custom section title.
 * @returns {JSX.Element} Inline title editor content.
 */
export default function CustomSectionTitleEditor({
  editing,
  onChange,
  onEditEnd,
  onEditStart,
  title,
}) {
  const displayTitle = String(title || '').trim() || 'Custom Section'

  if (editing) {
    return (
      <div className={styles.editorSectionTitleGroup}>
        <input
          autoFocus
          className={`${workspaceStyles.fieldInput} ${styles.editorSectionTitleInput}`}
          onBlur={onEditEnd}
          onChange={onChange}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onEditEnd()
            }
          }}
          placeholder="Custom Section"
          type="text"
          value={title || ''}
        />
      </div>
    )
  }

  return (
    <div className={styles.editorSectionTitleGroup}>
      <h3>{displayTitle}</h3>
      <button
        aria-label="Edit section title"
        className={styles.editorSectionTitleButton}
        onClick={onEditStart}
        type="button"
      >
        <WorkspaceIcon name="edit" size={14} />
      </button>
    </div>
  )
}
