import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import styles from './Workspace.module.css'
import WorkspaceIcon from './WorkspaceIcon'

function getInitials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function formatDate(dateValue) {
  if (!dateValue) {
    return '-'
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateValue))
}

function formatSearchableText(client) {
  return [client.name, client.tradeName, client.gst, client.pan, client.email, client.phone]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function formatClientBadge(count) {
  return `#${String(count).padStart(2, '0')}`
}

function buildUserHeaders(currentUser) {
  return {
    'x-user-id': currentUser?.id ?? '',
    'x-user-email': currentUser?.email ?? '',
  }
}

export default function ClientsPage() {
  const outletContext = useOutletContext() ?? {}
  const authReady = outletContext.authReady ?? false
  const currentUser = outletContext.currentUser ?? null
  const openClientModal = outletContext.openClientModal ?? (() => { })
  const openEditClientModal = outletContext.openEditClientModal ?? (() => { })
  const clientRefreshKey = outletContext.clientRefreshKey ?? 0

  const [clients, setClients] = useState([])
  const [query, setQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [status, setStatus] = useState('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [actionErrorMessage, setActionErrorMessage] = useState('')
  const [actionClientId, setActionClientId] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteState, setDeleteState] = useState('confirm')
  const pageSize = 10

  async function loadClients() {
    if (!authReady) {
      return
    }

    if (!currentUser?.id || !currentUser?.email) {
      setStatus('error')
      setErrorMessage('No signed-in user was found. Please sign in again.')
      return
    }

    setStatus('loading')
    setErrorMessage('')
    setActionErrorMessage('')

    try {
      const response = await fetch('/api/clients', {
        headers: buildUserHeaders(currentUser),
      })
      const data = await response.json()

      if (!response.ok) {
        setStatus('error')
        setErrorMessage(data.error || 'Unable to load clients.')
        return
      }

      setClients(Array.isArray(data.clients) ? data.clients : [])
      setStatus('ready')
    } catch (error) {
      setStatus('error')
      setErrorMessage('Unable to load clients. Please check the API connection.')
    }
  }

  function requestDeleteClient(client) {
    setActionErrorMessage('')
    setDeleteTarget(client)
    setDeleteState('confirm')
  }

  function closeDeleteModal() {
    if (actionClientId) {
      return
    }

    setDeleteTarget(null)
    setDeleteState('confirm')
    setActionErrorMessage('')
  }

  async function confirmDeleteClient() {
    if (!deleteTarget) {
      return
    }

    setDeleteState('submitting')
    setActionClientId(deleteTarget.id)
    setActionErrorMessage('')

    try {
      const response = await fetch(`/api/clients?clientId=${encodeURIComponent(deleteTarget.id)}`, {
        method: 'DELETE',
        headers: buildUserHeaders(currentUser),
      })
      const data = await response.json()

      if (!response.ok) {
        setActionErrorMessage(data.error || 'Unable to delete this client.')
        setDeleteState('confirm')
        return
      }

      setClients((current) => current.filter((entry) => entry.id !== deleteTarget.id))
      setDeleteState('success')
      setActionErrorMessage('')
    } catch (error) {
      setActionErrorMessage('Unable to delete this client. Please try again.')
      setDeleteState('confirm')
    } finally {
      setActionClientId('')
    }
  }

  useEffect(() => {
    loadClients()
  }, [authReady, currentUser?.email, currentUser?.id, clientRefreshKey])

  useEffect(() => {
    setCurrentPage(1)
  }, [query, clientRefreshKey])

  const filteredClients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) {
      return clients
    }

    return clients.filter((client) => formatSearchableText(client).includes(normalizedQuery))
  }, [clients, query])

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / pageSize))
  const showPagination = filteredClients.length > pageSize

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const visibleClients = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredClients.slice(startIndex, startIndex + pageSize)
  }, [filteredClients, currentPage])

  const totalClientCount = clients.length
  const countMeta = query.trim()
  const deleteSucceeded = deleteState === 'success'

  return (
    <div className={styles.page}>
      <section className={styles.pageToolbar}>
        <div className={styles.clientsCountCard}>
          <div className={styles.clientsCountRow}>
            <h1 className={styles.clientsCountTitle}>Clients</h1>
            <span className={styles.clientsCountBadge}>{formatClientBadge(totalClientCount)}</span>
          </div>
          <p className={styles.clientsCountMeta}>{countMeta}</p>
        </div>

        <label className={styles.inlineSearch}>
          <WorkspaceIcon name="filter" size={16} />
          <input
            className={styles.inlineSearchInput}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by name, GST, PAN, email, or phone"
            type="search"
            value={query}
          />
        </label>

        <button className={styles.gradientButton} onClick={openClientModal} type="button">
          <WorkspaceIcon name="plus" size={16} />
          <span>New Client</span>
        </button>
      </section>

      {!authReady || status === 'loading' ? (
        <section className={styles.statusPanel}>
          <WorkspaceIcon name="clients" size={20} />
          <div>
            <h2>Loading clients</h2>
            <p className={styles.statusText}>Fetching client records for the signed-in user from MongoDB.</p>
          </div>
        </section>
      ) : null}

      {authReady && status === 'error' ? (
        <section className={styles.statusPanel}>
          <WorkspaceIcon name="help" size={20} />
          <div>
            <h2>Could not load clients</h2>
            <p className={styles.errorText}>{errorMessage}</p>
          </div>
          <button className={styles.secondaryButton} onClick={loadClients} type="button">
            Retry
          </button>
        </section>
      ) : null}

      {status === 'ready' && filteredClients.length === 0 ? (
        <section className={styles.emptyState}>
          <span className={styles.emptyStateIcon}>
            <WorkspaceIcon name="clients" size={22} />
          </span>
          <h2>{clients.length === 0 ? 'No Client Found' : 'No Matching Client'}</h2>
          <p className={styles.statusText}>
            {clients.length === 0
              ? 'This user does not have any clients attached yet. Add one to populate the CRM workspace.'
              : 'Try a different search term or clear the current filter.'}
          </p>
          <div className={styles.statusActions}>
            {clients.length === 0 ? (
              <button className={styles.gradientButton} onClick={openClientModal} type="button">
                <WorkspaceIcon name="plus" size={16} />
                <span>New Client</span>
              </button>
            ) : (
              <button className={styles.ghostButton} onClick={() => setQuery('')} type="button">
                Clear Search
              </button>
            )}
          </div>
        </section>
      ) : null}

      {status === 'ready' && filteredClients.length > 0 ? (
        <section className={styles.panel}>
          <div className={styles.clientsPanelHeader}>
            <p className={styles.panelText}>
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredClients.length)} of{' '}
              {filteredClients.length} client record{filteredClients.length === 1 ? '' : 's'} in view.
            </p>
            {actionErrorMessage ? <p className={styles.inlineError}>{actionErrorMessage}</p> : null}
          </div>

          <div className={styles.tableWrap}>
            <table className={`${styles.dataTable} ${styles.clientsTable}`}>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Trade name</th>
                  <th>GST / PAN</th>
                  <th>Contact</th>
                  <th>Added on</th>
                  <th className={styles.actionsColumn}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleClients.map((client) => {
                  const isDeleting = actionClientId === client.id

                  return (
                    <tr key={client.id}>
                      <td>
                        <div className={styles.entityCell}>
                          <span className={styles.entityMark}>{getInitials(client.name)}</span>
                          <div className={styles.entityMeta}>
                            <strong>{client.name}</strong>
                            <span className={styles.metaNote}>{client.address}</span>
                          </div>
                        </div>
                      </td>
                      <td>{client.tradeName || 'Not set'}</td>
                      <td>
                        <div className={styles.codeStack}>
                          <code>{client.gst || 'Not set'}</code>
                          <span>{client.pan || 'PAN not set'}</span>
                        </div>
                      </td>
                      <td>
                        <div className={styles.contactStack}>
                          <span>
                            <WorkspaceIcon name="mail" size={14} />
                            {client.email}
                          </span>
                          <span>
                            <WorkspaceIcon name="phone" size={14} />
                            {client.phone}
                          </span>
                        </div>
                      </td>
                      <td>{formatDate(client.createdAt)}</td>
                      <td>
                        <div className={styles.rowActions}>
                          <button
                            className={styles.rowActionButton}
                            disabled={isDeleting}
                            onClick={() => openEditClientModal(client)}
                            type="button"
                          >
                            <WorkspaceIcon name="edit" size={14} />
                            <span>Edit</span>
                          </button>
                          <button
                            className={`${styles.rowActionButton} ${styles.rowActionButtonDanger}`}
                            disabled={isDeleting}
                            onClick={() => requestDeleteClient(client)}
                            type="button"
                          >
                            <WorkspaceIcon name="trash" size={14} />
                            <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className={styles.mobileClientGrid}>
            {visibleClients.map((client) => {
              const isDeleting = actionClientId === client.id

              return (
                <article className={styles.mobileClientCard} key={client.id}>
                  <div className={styles.mobileClientHeader}>
                    <span className={styles.entityMark}>{getInitials(client.name)}</span>
                    <div className={styles.entityMeta}>
                      <strong>{client.name}</strong>
                      <span>{client.tradeName || 'Trade name not set'}</span>
                    </div>
                  </div>

                  <div className={styles.mobileClientMeta}>
                    <span>{client.gst || 'GST not set'}</span>
                    <span>{client.pan || 'PAN not set'}</span>
                    <span>{client.email}</span>
                    <span>{client.phone}</span>
                    <span>{client.address}</span>
                  </div>

                  <div className={styles.mobileClientFooter}>
                    <span>{formatDate(client.createdAt)}</span>
                    <div className={styles.rowActions}>
                      <button className={styles.rowActionButton} onClick={() => openEditClientModal(client)} type="button">
                        <WorkspaceIcon name="edit" size={14} />
                        <span>Edit</span>
                      </button>
                      <button
                        className={`${styles.rowActionButton} ${styles.rowActionButtonDanger}`}
                        disabled={isDeleting}
                        onClick={() => requestDeleteClient(client)}
                        type="button"
                      >
                        <WorkspaceIcon name="trash" size={14} />
                        <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>

          {showPagination ? (
            <div className={styles.paginationRow}>
              <span>
                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredClients.length)} of{' '}
                {filteredClients.length} clients
              </span>

              <div className={styles.paginationButtons}>
                <button
                  className={styles.pageButton}
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  type="button"
                >
                  Prev
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                  <button
                    className={`${styles.pageButton} ${currentPage === pageNumber ? styles.pageButtonActive : ''}`}
                    key={pageNumber}
                    onClick={() => setCurrentPage(pageNumber)}
                    type="button"
                  >
                    {pageNumber}
                  </button>
                ))}
                <button
                  className={styles.pageButton}
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {deleteTarget ? (
        <div className={styles.modalScrim} onClick={closeDeleteModal} role="presentation">
          <div
            aria-modal="true"
            className={styles.confirmModal}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className={styles.confirmHeader}>
              <span className={`${styles.confirmIcon} ${deleteSucceeded ? styles.confirmIconSuccess : ''}`}>
                <WorkspaceIcon className={deleteSucceeded ? styles.confirmTick : ''} name={deleteSucceeded ? 'check' : 'trash'} size={18} />
              </span>
              <div>
                <p className={styles.eyebrow}>{deleteSucceeded ? 'Deletion Complete' : 'Delete Client'}</p>
                <h2 className={styles.confirmTitle}>
                  {deleteSucceeded ? `${deleteTarget.name} deleted` : `Delete ${deleteTarget.name}?`}
                </h2>
              </div>
            </div>

            <p className={styles.confirmText}>
              {deleteSucceeded
                ? 'Client deletion was successful. The record has been removed from your CRM workspace.'
                : 'This will permanently remove the client and all its associated data from your workspace.'}
            </p>

            {!deleteSucceeded && actionErrorMessage ? <p className={styles.modalError}>{actionErrorMessage}</p> : null}

            <div className={styles.confirmActions}>
              {deleteSucceeded ? (
                <button className={styles.gradientButton} onClick={closeDeleteModal} type="button">
                  <WorkspaceIcon name="check" size={14} />
                  <span>Done</span>
                </button>
              ) : (
                <>
                  <button className={styles.textButton} disabled={Boolean(actionClientId)} onClick={closeDeleteModal} type="button">
                    Cancel
                  </button>
                  <button
                    className={styles.dangerButton}
                    disabled={Boolean(actionClientId)}
                    onClick={confirmDeleteClient}
                    type="button"
                  >
                    <WorkspaceIcon name="trash" size={14} />
                    <span>{actionClientId ? 'Deleting...' : 'Delete Client'}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}