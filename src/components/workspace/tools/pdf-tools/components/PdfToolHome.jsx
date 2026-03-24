import WorkspaceIcon from '../../../WorkspaceIcon'
import styles from '../../shared/Tools.module.css'
import { TOOL_CARDS } from '../pdfToolConstants'

export default function PdfToolHome({ onOpenTool }) {
  return (
    <section className={styles.uploadCard}>
      <div className={styles.uploadHeader}>
        <div>
          <span className={styles.invoiceSectionLabel}>Tools</span>
          <h2 className={styles.pdfToolHeading}>What would you like to do?</h2>
          <p className={styles.uploadHint}>Select one tool to start processing. All actions run in-browser.</p>
        </div>
      </div>

      <div className={styles.modeGrid}>
        {TOOL_CARDS.map((tool) => (
          <button className={styles.modeButton} key={tool.id} onClick={() => onOpenTool(tool.id)} type="button">
            <div className={styles.pdfToolCardTop}>
              <span className={styles.dropdownTriggerIcon}>
                <WorkspaceIcon name={tool.icon} size={16} />
              </span>
              {tool.badge ? <span className={styles.modeTag}>{tool.badge}</span> : null}
            </div>
            <h3>{tool.title}</h3>
            <p>{tool.copy}</p>
          </button>
        ))}
      </div>
    </section>
  )
}
