import { Link } from 'react-router-dom'
import styles from './Workspace.module.css'
import WorkspaceIcon from './WorkspaceIcon'
import { workspaceRoutes } from '../../workspaceRoutes'

export default function DashboardComingSoonPage() {
  return (
    <div className={styles.page}>
      <section className={`${styles.panel} ${styles.dashboardPlaceholder}`}>
        <span className={styles.dashboardPlaceholderIcon}>
          <WorkspaceIcon name="toolDashboard" size={20} />
        </span>
        <p className={styles.eyebrow}>Dashboard view</p>
        <h1 className={styles.pageTitle}>Coming soon...</h1>
        <p className={styles.pageText}>
          This home dashboard is reserved for your upcoming overview screen. Use Clients Management for the current
          workspace.
        </p>
        <Link className={styles.gradientButton} to={workspaceRoutes.clients}>
          Open Clients Management
        </Link>
      </section>
    </div>
  )
}
