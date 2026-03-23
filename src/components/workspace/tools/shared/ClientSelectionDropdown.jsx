import { useEffect, useRef, useState } from 'react'
import WorkspaceIcon from '../../WorkspaceIcon'
import workspaceStyles from '../../Workspace.module.css'
import styles from './Tools.module.css'

function joinClasses(...values) {
  return values.filter(Boolean).join(' ')
}

export default function ClientSelectionDropdown({
  clients,
  errorMessage,
  filteredClients,
  onCreateClient,
  onQueryChange,
  onRetry,
  onSelectClient,
  query,
  selectedClient,
  status,
}) {
  const containerRef = useRef(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  useEffect(() => {
    if (status !== 'ready') {
      setOpen(false)
    }
  }, [status])

  function handleSelect(clientId) {
    onSelectClient(clientId)
    setOpen(false)
  }

  const triggerLabel = selectedClient ? selectedClient.name : 'Select client'
  const triggerMeta = selectedClient
    ? selectedClient.tradeName || selectedClient.gst || selectedClient.email || 'Client selected'
    : status === 'loading'
      ? 'Loading clients'
      : 'Choose one client to continue'

  return (
    <div className={styles.dropdownWrap} ref={containerRef}>
      <button
        aria-expanded={open}
        className={joinClasses(styles.dropdownTrigger, open && styles.dropdownTriggerActive)}
        disabled={status !== 'ready'}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <div className={styles.dropdownTriggerContent}>
          <span className={styles.dropdownTriggerIcon}>
            <WorkspaceIcon name="clients" size={18} />
          </span>
          <div className={styles.dropdownTriggerText}>
            <span className={styles.dropdownTriggerLabel}>Client</span>
            <strong>{triggerLabel}</strong>
            <span>{triggerMeta}</span>
          </div>
        </div>
        <span className={joinClasses(styles.dropdownChevron, open && styles.dropdownChevronOpen)}>
          <WorkspaceIcon name="chevronDown" size={18} />
        </span>
      </button>

      {open ? (
        <div className={styles.dropdownMenu}>
          <div className={styles.dropdownMenuHeader}>
            <div>
              <p className={workspaceStyles.eyebrow}>Client selection</p>
              <h3>Choose one client for this tool run</h3>
            </div>
            <button className={workspaceStyles.gradientButton} onClick={onCreateClient} type="button">
              <WorkspaceIcon name="plus" size={14} />
              <span>New Client</span>
            </button>
          </div>

          <label className={styles.dropdownSearch}>
            <WorkspaceIcon name="search" size={16} />
            <input
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search client name, GST, PAN, trade name"
              type="search"
              value={query}
            />
          </label>

          {status === 'loading' ? (
            <div className={styles.dropdownState}>
              <span className={styles.clientStateIcon}>
                <WorkspaceIcon name="clients" size={18} />
              </span>
              <div>
                <h4>Loading clients</h4>
                <p>Fetching client entities for the signed-in user.</p>
              </div>
            </div>
          ) : null}

          {status === 'error' ? (
            <div className={styles.dropdownState}>
              <span className={styles.clientStateIcon}>
                <WorkspaceIcon name="help" size={18} />
              </span>
              <div>
                <h4>Could not load clients</h4>
                <p>{errorMessage}</p>
              </div>
              <button className={workspaceStyles.secondaryButton} onClick={onRetry} type="button">
                Retry
              </button>
            </div>
          ) : null}

          {status === 'ready' ? (
            <div className={styles.dropdownList}>
              {filteredClients.length > 0 ? (
                filteredClients.map((client) => {
                  const isSelected = selectedClient?.id === client.id

                  return (
                    <button
                      className={joinClasses(styles.dropdownOption, isSelected && styles.dropdownOptionActive)}
                      key={client.id}
                      onClick={() => handleSelect(client.id)}
                      type="button"
                    >
                      <div className={styles.dropdownOptionMain}>
                        <span className={styles.dropdownOptionBadge}>{client.name.slice(0, 1).toUpperCase()}</span>
                        <div className={styles.dropdownOptionText}>
                          <strong>{client.name}</strong>
                          <span>{client.tradeName || 'Trade name not set'}</span>
                        </div>
                      </div>
                      <div className={styles.dropdownOptionMeta}>
                        <span>{client.gst || 'GST not set'}</span>
                        <span>{client.pan || 'PAN not set'}</span>
                      </div>
                    </button>
                  )
                })
              ) : (
                <div className={styles.dropdownEmpty}>
                  <span className={styles.clientStateIcon}>
                    <WorkspaceIcon name="clients" size={18} />
                  </span>
                  <h4>{clients.length === 0 ? 'No clients found' : 'No clients match this search'}</h4>
                  <p>
                    {clients.length === 0
                      ? 'Create a client record first. Every tool flow starts with a client selection.'
                      : 'Try a different search term or clear the current filter.'}
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
