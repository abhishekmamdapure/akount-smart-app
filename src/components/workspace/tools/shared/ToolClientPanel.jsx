import ClientSelectionDropdown from './ClientSelectionDropdown'
import workspaceStyles from '../../Workspace.module.css'
import styles from './Tools.module.css'

function joinClasses(...values) {
  return values.filter(Boolean).join(' ')
}

function formatUsagePercent(clientsUsed, clientLimit) {
  if (!clientLimit) {
    return 0
  }

  return Math.min(100, Math.round((clientsUsed / clientLimit) * 100))
}

export default function ToolClientPanel({
  clients,
  clientsUsed,
  clientLimit,
  errorMessage,
  filteredClients,
  onCreateClient,
  onQueryChange,
  onRetry,
  onSelectClient,
  planName,
  query,
  selectedClient,
  status,
}) {
  const usagePercent = formatUsagePercent(clientsUsed, clientLimit)

  return (
    <section className={joinClasses(workspaceStyles.panel, styles.clientPanel)}>
      <div className={styles.clientPanelHeader}>
        <div>
          <p className={workspaceStyles.eyebrow}>Client context</p>
          <h2 className={styles.sectionTitle}>Choose a client before using this tool</h2>
          <p className={workspaceStyles.panelText}>
            Subscription usage is client-based, so every tool begins by pulling the signed-in user&apos;s client list and asking which entity this run belongs to.
          </p>
        </div>

        <div className={styles.planCard}>
          <div className={styles.planCardTop}>
            <span className={workspaceStyles.chip}>{planName}</span>
            <span className={styles.planValue}>
              {clientsUsed} / {clientLimit} clients
            </span>
          </div>
          <span className={workspaceStyles.accountUsageTrack}>
            <span className={workspaceStyles.accountUsageFill} style={{ width: `${usagePercent}%` }} />
          </span>
          <p className={styles.planMeta}>
            {clients.length} client{clients.length === 1 ? '' : 's'} available in this workspace
          </p>
        </div>
      </div>

      <div className={styles.clientSelectionRow}>
        <div className={styles.clientDropdownBlock}>
          <ClientSelectionDropdown
            clients={clients}
            errorMessage={errorMessage}
            filteredClients={filteredClients}
            onCreateClient={onCreateClient}
            onQueryChange={onQueryChange}
            onRetry={onRetry}
            onSelectClient={onSelectClient}
            query={query}
            selectedClient={selectedClient}
            status={status}
          />
          <p className={styles.clientSelectionHint}>
            The selected client is used for invoice upload, processing mode, and downstream export context.
          </p>
        </div>

        <aside className={styles.clientSummary}>
          <p className={workspaceStyles.eyebrow}>Selected client</p>
          {selectedClient ? (
            <>
              <div className={styles.clientSummaryHeader}>
                <span className={styles.clientSummaryMark}>{selectedClient.name.slice(0, 1).toUpperCase()}</span>
                <div>
                  <h3>{selectedClient.name}</h3>
                  <p>{selectedClient.tradeName || 'Trade name not set'}</p>
                </div>
              </div>

              <dl className={styles.clientSummaryGrid}>
                <div>
                  <dt>GST</dt>
                  <dd>{selectedClient.gst || 'Not set'}</dd>
                </div>
                <div>
                  <dt>PAN</dt>
                  <dd>{selectedClient.pan || 'Not set'}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{selectedClient.email || 'Not set'}</dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{selectedClient.phone || 'Not set'}</dd>
                </div>
              </dl>

              <p className={styles.clientSummaryNote}>
                This entity remains attached to the current invoice-processing run until another client is selected.
              </p>
            </>
          ) : (
            <div className={styles.clientSummaryEmpty}>
              <span className={styles.clientStateIcon}>
                <span className={styles.clientSummaryEmptyIconInner}>01</span>
              </span>
              <h3>No client selected</h3>
              <p>Open the dropdown and choose one client before upload, review, or processing actions become available.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
