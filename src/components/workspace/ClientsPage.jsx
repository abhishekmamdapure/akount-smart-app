import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import ClientCard from './ClientCard'
import clientStyles from './ClientManagement.module.css'
import workspaceStyles from './Workspace.module.css'
import WorkspaceIcon from './WorkspaceIcon'
import {
  CLIENT_CARD_PAGE_SIZE,
  filterClientsByQuery,
  formatClientCountBadge,
  paginateClients,
} from './clientManagementHelpers'

function buildUserHeaders(currentUser) {
  return {
    'x-user-id': currentUser?.id ?? '',
    'x-user-email': currentUser?.email ?? '',
  }
}

/**
 * Renders the redesigned client-management workspace page.
 *
 * @returns {JSX.Element} The client-management page.
 */
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

      setClients((currentClients) => currentClients.filter((client) => client.id !== deleteTarget.id))
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
    void loadClients()
  }, [authReady, currentUser?.email, currentUser?.id, clientRefreshKey])

  useEffect(() => {
    setCurrentPage(1)
  }, [query, clientRefreshKey])

  const filteredClients = useMemo(() => filterClientsByQuery(clients, query), [clients, query])
  const pagination = useMemo(
    () => paginateClients(filteredClients, currentPage, CLIENT_CARD_PAGE_SIZE),
    [filteredClients, currentPage],
  )

  useEffect(() => {
    if (currentPage !== pagination.currentPage) {
      setCurrentPage(pagination.currentPage)
    }
  }, [currentPage, pagination.currentPage])

  const totalClientCount = clients.length
  const hasSearchQuery = query.trim().length > 0
  const deleteSucceeded = deleteState === 'success'
  const showPagination = pagination.totalItems > CLIENT_CARD_PAGE_SIZE

  const resultsSummary =
    !authReady || status === 'loading'
      ? 'Fetching client records for this workspace.'
      : status === 'error'
        ? 'Client records could not be loaded for this workspace.'
        : pagination.totalItems === 0
          ? totalClientCount === 0
            ? 'No client records have been added to this workspace yet.'
            : 'No client records match the active search.'
          : `Showing ${pagination.startItemNumber} to ${pagination.endItemNumber} of ${pagination.totalItems} client record${pagination.totalItems === 1 ? '' : 's'} in view.`

  return (
    <div className={`${workspaceStyles.page} ${clientStyles.clientPage}`}>
      <section className={clientStyles.stickyToolbar}>
        <div className={clientStyles.toolbarSurface}>
          <div className={clientStyles.toolbarTopRow}>
            <div>
              <p className={clientStyles.toolbarLabel}>Clients management</p>
              <div className={clientStyles.toolbarTitleRow}>
                <h1 className={clientStyles.toolbarTitle}>Clients</h1>
                <span className={clientStyles.toolbarBadge}>{formatClientCountBadge(totalClientCount)}</span>
              </div>
            </div>

            <div className={clientStyles.toolbarActions}>
              <label className={clientStyles.filterField}>
                <WorkspaceIcon name="filter" size={16} />
                <input
                  className={clientStyles.filterInput}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filter by name, GST, PAN, email, or phone"
                  type="search"
                  value={query}
                />
              </label>

              <button className={clientStyles.primaryButton} onClick={openClientModal} type="button">
                <WorkspaceIcon name="plus" size={16} />
                <span>New Client</span>
              </button>
            </div>
          </div>

          <div className={clientStyles.resultsBar}>
            <p className={clientStyles.resultsCopy}>{resultsSummary}</p>
            <div className={clientStyles.resultsMeta}>
              {hasSearchQuery ? <span className={clientStyles.queryBadge}>Filtered by "{query.trim()}"</span> : null}
              {status === 'error' ? <span className={clientStyles.queryBadge}>Retry available</span> : null}
            </div>
          </div>
        </div>
      </section>

      {!authReady || status === 'loading' ? (
        <section className={clientStyles.statusPanel}>
          <div className={clientStyles.statusBody}>
            <span className={clientStyles.statusIcon}>
              <WorkspaceIcon name="clients" size={20} />
            </span>
            <div>
              <h2 className={clientStyles.statusTitle}>Loading clients</h2>
              <p className={clientStyles.statusText}>
                Fetching client records for the signed-in workspace and preparing the redesigned card layout.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {authReady && status === 'error' ? (
        <section className={clientStyles.statusPanel}>
          <div className={clientStyles.statusBody}>
            <span className={clientStyles.statusIcon}>
              <WorkspaceIcon name="help" size={20} />
            </span>
            <div>
              <h2 className={clientStyles.statusTitle}>Could not load clients</h2>
              <p className={`${clientStyles.statusText} ${clientStyles.statusError}`}>{errorMessage}</p>
            </div>
          </div>

          <div className={clientStyles.statusActions}>
            <button className={clientStyles.secondaryButton} onClick={loadClients} type="button">
              Retry
            </button>
          </div>
        </section>
      ) : null}

      {status === 'ready' && filteredClients.length === 0 ? (
        <section className={clientStyles.statusPanel}>
          <div className={clientStyles.statusBody}>
            <span className={clientStyles.statusIcon}>
              <WorkspaceIcon name="clients" size={20} />
            </span>
            <div>
              <h2 className={clientStyles.statusTitle}>{clients.length === 0 ? 'No clients yet' : 'No matches found'}</h2>
              <p className={clientStyles.statusText}>
                {clients.length === 0
                  ? 'Create the first client record to populate the workspace and unlock client-linked tools.'
                  : 'Try a different filter or clear the current search to see the full client list again.'}
              </p>
            </div>
          </div>

          <div className={clientStyles.statusActions}>
            {clients.length === 0 ? (
              <button className={clientStyles.primaryButton} onClick={openClientModal} type="button">
                <WorkspaceIcon name="plus" size={16} />
                <span>New Client</span>
              </button>
            ) : (
              <button className={clientStyles.ghostButton} onClick={() => setQuery('')} type="button">
                Clear Search
              </button>
            )}
          </div>
        </section>
      ) : null}

      {status === 'ready' && filteredClients.length > 0 ? (
        <>
          <section className={clientStyles.clientGrid}>
            {pagination.pageItems.map((client) => (
              <ClientCard
                client={client}
                isDeleting={actionClientId === client.id}
                key={client.id}
                onDelete={requestDeleteClient}
                onEdit={openEditClientModal}
              />
            ))}
          </section>

          {showPagination ? (
            <div className={clientStyles.paginationRow}>
              <span className={clientStyles.paginationCopy}>
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>

              <div className={clientStyles.paginationButtons}>
                <button
                  className={clientStyles.pageButton}
                  disabled={pagination.currentPage === 1}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  type="button"
                >
                  Prev
                </button>
                {Array.from({ length: pagination.totalPages }, (_, index) => index + 1).map((pageNumber) => (
                  <button
                    className={`${clientStyles.pageButton} ${pagination.currentPage === pageNumber ? clientStyles.activePageButton : ''}`}
                    key={pageNumber}
                    onClick={() => setCurrentPage(pageNumber)}
                    type="button"
                  >
                    {pageNumber}
                  </button>
                ))}
                <button
                  className={clientStyles.pageButton}
                  disabled={pagination.currentPage === pagination.totalPages}
                  onClick={() => setCurrentPage((page) => Math.min(pagination.totalPages, page + 1))}
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {deleteTarget ? (
        <div className={clientStyles.modalScrim} onClick={closeDeleteModal} role="presentation">
          <div
            aria-modal="true"
            className={clientStyles.confirmDialog}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className={clientStyles.confirmHeader}>
              <div className={clientStyles.modalHeaderContent}>
                <span
                  className={`${clientStyles.confirmIcon} ${deleteSucceeded ? clientStyles.confirmIconSuccess : ''}`}
                >
                  <WorkspaceIcon name={deleteSucceeded ? 'check' : 'trash'} size={18} />
                </span>
                <div>
                  <p className={clientStyles.dialogEyebrow}>{deleteSucceeded ? 'Deletion complete' : 'Delete client'}</p>
                  <h2 className={clientStyles.confirmTitle}>
                    {deleteSucceeded ? `${deleteTarget.name} deleted` : `Delete ${deleteTarget.name}?`}
                  </h2>
                </div>
              </div>

              {!deleteSucceeded ? (
                <button
                  aria-label="Close delete confirmation"
                  className={clientStyles.modalCloseButton}
                  disabled={Boolean(actionClientId)}
                  onClick={closeDeleteModal}
                  type="button"
                >
                  <WorkspaceIcon name="close" size={16} />
                </button>
              ) : null}
            </div>

            <p className={clientStyles.confirmText}>
              {deleteSucceeded
                ? 'The client record has been removed from the workspace and the refreshed grid is ready.'
                : 'This permanently removes the client from your CRM workspace and cannot be undone.'}
            </p>

            {!deleteSucceeded && actionErrorMessage ? <p className={clientStyles.modalError}>{actionErrorMessage}</p> : null}

            <div className={clientStyles.confirmActions}>
              {deleteSucceeded ? (
                <button className={clientStyles.primaryButton} onClick={closeDeleteModal} type="button">
                  <WorkspaceIcon name="check" size={16} />
                  <span>Done</span>
                </button>
              ) : (
                <>
                  <button
                    className={clientStyles.ghostButton}
                    disabled={Boolean(actionClientId)}
                    onClick={closeDeleteModal}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className={clientStyles.dangerButton}
                    disabled={Boolean(actionClientId)}
                    onClick={confirmDeleteClient}
                    type="button"
                  >
                    <WorkspaceIcon name="trash" size={16} />
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
