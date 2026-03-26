import ClientSelectionDropdown from './ClientSelectionDropdown'
import styles from './Tools.module.css'

function joinClasses(...values) {
  return values.filter(Boolean).join(' ')
}

/**
 * Renders the standard client-selector shell used across workspace tools.
 *
 * @param {Object} props - Component props.
 * @param {string} [props.className] - Optional extra class names for the slot.
 * @param {boolean} [props.fullWidth=false] - Expands the slot to the full available width.
 * @param {string} [props.menuAlign='end'] - Dropdown menu alignment.
 * @returns {JSX.Element} Shared client-selector wrapper.
 */
export default function ToolClientSelector({
  className = '',
  fullWidth = false,
  menuAlign = 'end',
  ...dropdownProps
}) {
  return (
    <div
      className={joinClasses(
        styles.toolClientSelectorSlot,
        fullWidth && styles.toolClientSelectorSlotFull,
        className,
      )}
    >
      <ClientSelectionDropdown menuAlign={menuAlign} {...dropdownProps} />
    </div>
  )
}
