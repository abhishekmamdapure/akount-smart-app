import WorkspaceIcon from '../../../WorkspaceIcon'
import styles from '../../shared/Tools.module.css'
import { TOOL_CARDS } from '../pdfToolConstants'
import { joinClasses } from './helpers'

export default function PdfToolHome({ onOpenTool }) {
  return (
    <section className={styles.uploadCard}>
      <div className={styles.uploadHeader}>
      </div>

      <div className={styles.modeGrid}>
        {TOOL_CARDS.map((tool) => (
          <button className={styles.modeButton} key={tool.id} onClick={() => onOpenTool(tool.id)} type="button">
            <div className={styles.pdfToolCardTop}>
              <span
                className={joinClasses(
                  styles.pdfToolCardIcon,
                  tool.secondaryIcon && styles.pdfToolCardIconStack,
                )}
              >
                <WorkspaceIcon name={tool.icon} size={34} />
                {tool.secondaryIcon ? (
                  <WorkspaceIcon className={styles.pdfToolCardIconSecondary} name={tool.secondaryIcon} size={22} />
                ) : null}
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
