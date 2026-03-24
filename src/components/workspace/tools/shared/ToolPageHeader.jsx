import workspaceStyles from '../../Workspace.module.css'
import ClientSelectionDropdown from './ClientSelectionDropdown'
import styles from './Tools.module.css'

function joinClasses(...values) {
  return values.filter(Boolean).join(' ')
}

function buildClientMeta(selectedClient) {
  if (!selectedClient) {
    return 'Select a client to lock context for this tool.'
  }

  return selectedClient.tradeName || selectedClient.gst || selectedClient.email || 'Client context locked for this tool.'
}

export default function ToolPageHeader({
  action,
  clientPicker,
  description,
  eyebrow,
  selectedClient,
  stats = [],
  title,
}) {
  return (
    <section className={styles.toolHero}>
      <div className={styles.toolHeroHeader}>
        <div className={styles.toolHeroCopy}>
          <p className={workspaceStyles.eyebrow}>{eyebrow}</p>
          <h1 className={workspaceStyles.pageTitle}>{title}</h1>
          <p className={workspaceStyles.pageText}>{description}</p>
          {action ? <div className={styles.toolHeroActions}>{action}</div> : null}
        </div>

        <aside className={styles.toolHeroCorner}>
          <div className={styles.toolHeroCornerTop}>
            <span className={styles.toolHeroCornerLabel}>Client selector</span>
            <ClientSelectionDropdown compact menuAlign="end" {...clientPicker} />
          </div>

          <div
            className={joinClasses(
              styles.toolHeroClientCard,
              selectedClient && styles.toolHeroClientCardActive,
            )}
          >
            <div className={styles.toolHeroClientMain}>
              <span className={styles.toolHeroClientMark}>
                {selectedClient?.name?.slice(0, 1).toUpperCase() || 'CL'}
              </span>
              <div>
                <span className={styles.toolHeroClientLabel}>Current client</span>
                <strong>{selectedClient ? selectedClient.name : 'No client selected'}</strong>
              </div>
            </div>

            <p className={styles.toolHeroClientMeta}>{buildClientMeta(selectedClient)}</p>
          </div>
        </aside>
      </div>

      {stats.length > 0 ? (
        <div className={styles.heroStats}>
          {stats.map((item) => (
            <article className={styles.heroStat} key={item.label}>
              <span className={styles.heroStatLabel}>{item.label}</span>
              <strong>{item.value}</strong>
              <span>{item.description}</span>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}
