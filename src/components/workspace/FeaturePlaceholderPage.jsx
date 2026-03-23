import { Link } from 'react-router-dom'
import styles from './Workspace.module.css'
import WorkspaceIcon from './WorkspaceIcon'

function joinClasses(...values) {
  return values.filter(Boolean).join(' ')
}

export default function FeaturePlaceholderPage({
  eyebrow,
  title,
  description,
  highlights,
}) {
  return (
    <div className={styles.page}>
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
