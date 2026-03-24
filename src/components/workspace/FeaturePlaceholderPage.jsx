import { Link, useOutletContext } from 'react-router-dom'
import styles from './Workspace.module.css'
import WorkspaceIcon from './WorkspaceIcon'
import ToolPageHeader from './tools/shared/ToolPageHeader'
import { useWorkspaceToolClient } from './tools/shared/toolClientState'

function joinClasses(...values) {
  return values.filter(Boolean).join(' ')
}

export default function FeaturePlaceholderPage({
  clientContextEnabled = true,
  eyebrow,
  title,
  description,
  highlights,
}) {
  const outletContext = useOutletContext() ?? {}
  const openClientModal = outletContext.openClientModal ?? (() => {})
  const {
    clients,
    errorMessage,
    filteredClients,
    handleSelectClient,
    query,
    reloadClients,
    selectedClient,
    setQuery,
    status,
  } = useWorkspaceToolClient(outletContext)

  return (
    <div className={styles.page}>
      {clientContextEnabled ? (
        <ToolPageHeader
          action={
            <div className={styles.placeholderActions}>
              <Link className={styles.gradientButton} to="/dashboard/clients">
                Open Clients Management
              </Link>
              <Link className={styles.ghostButton} to="/dashboard">
                Back to Dashboard
              </Link>
            </div>
          }
          clientPicker={{
            clients,
            errorMessage,
            filteredClients,
            onCreateClient: openClientModal,
            onQueryChange: setQuery,
            onRetry: reloadClients,
            onSelectClient: handleSelectClient,
            query,
            selectedClient,
            status,
          }}
          description={description}
          eyebrow={eyebrow}
          selectedClient={selectedClient}
          stats={[
            {
              label: 'Client context',
              value: selectedClient ? selectedClient.name : 'Choose client',
              description: 'The shared header keeps the same entity-selection pattern used by live tools.',
            },
            {
              label: 'Module status',
              value: 'Planned',
              description: 'This workspace is still placeholder-only, but the client context is already in place.',
            },
            {
              label: 'Next step',
              value: 'Hook real workflow',
              description: 'The content area below can be replaced with the live tool without moving the selector.',
            },
          ]}
          title={title}
        />
      ) : (
        <section className={joinClasses(styles.panel, styles.placeholderHero)}>
          <div>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h1 className={styles.pageTitle}>{title}</h1>
            <p className={styles.pageText}>{description}</p>
          </div>

          <div className={styles.placeholderActions}>
            <Link className={styles.gradientButton} to="/dashboard/clients">
              Open Clients Management
            </Link>
            <Link className={styles.ghostButton} to="/dashboard">
              Back to Dashboard
            </Link>
          </div>
        </section>
      )}

      <section className={styles.placeholderGrid}>
        {highlights.map((item) => (
          <article className={styles.placeholderCard} key={item.title}>
            <span className={styles.placeholderIcon}>
              <WorkspaceIcon name={item.icon} size={20} />
            </span>
            <h2>{item.title}</h2>
            <p>{item.copy}</p>
          </article>
        ))}
      </section>
    </div>
  )
}
