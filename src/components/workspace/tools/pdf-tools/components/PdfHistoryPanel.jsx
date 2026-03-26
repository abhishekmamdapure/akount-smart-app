import styles from '../../shared/Tools.module.css'
import { formatDurationMs, getToolLabel } from '../pdfToolsOperations'
import { formatDateTime, joinClasses } from './helpers'
import { buildPdfUsageSummaryCards } from '../pdfUsageSummary'

export default function PdfHistoryPanel({ history, historyStatus, historyError, totalsByTool }) {
  const totals = buildPdfUsageSummaryCards({ history, totalsByTool })

  return (
    <section className={styles.invoiceHistorySection}>
      <div className={styles.pdfUsageHistoryHeader}>
        <h2 className={styles.pdfUsageHistoryTitle}>Usage History</h2>
      </div>

      <div className={styles.pdfUsageSummaryStrip}>
        {totals.map((item) => (
          <article
            className={joinClasses(
              styles.pdfUsageSummaryCard,
              item.count > 0 ? styles.pdfUsageSummaryCardActive : styles.pdfUsageSummaryCardInactive,
            )}
            aria-label={`${item.label}: ${item.count}`}
            key={item.id}
            title={`${item.label}: ${item.count}`}
          >
            <span className={styles.pdfUsageSummaryLabel}>{item.label}</span>
            <strong
              className={joinClasses(
                styles.pdfUsageSummaryValue,
                item.count > 0 ? styles.pdfUsageSummaryValueActive : styles.pdfUsageSummaryValueIdle,
              )}
            >
              {item.count}
            </strong>
            <span className={styles.pdfUsageSummaryStatus}>
              <span
                className={joinClasses(
                  styles.pdfUsageSummaryDot,
                  item.count > 0 ? styles.pdfUsageSummaryDotActive : styles.pdfUsageSummaryDotIdle,
                )}
                aria-hidden="true"
              />
            </span>
          </article>
        ))}
      </div>

      {history.length > 0 ? (
        <div className={styles.invoiceHistoryTableWrap}>
          <table className={styles.invoiceHistoryTable}>
            <thead>
              <tr>
                <th>Tool</th>
                <th>Status</th>
                <th>Summary</th>
                <th>When</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <td>{getToolLabel(item.tool)}</td>
                  <td>
                    <span
                      className={joinClasses(
                        styles.invoiceHistoryStatus,
                        item.status === 'completed' && styles.invoiceHistoryStatusCompleted,
                        item.status === 'failed' && styles.invoiceHistoryStatusFailed,
                      )}
                    >
                      <span>{item.status === 'completed' ? 'Completed' : 'Failed'}</span>
                    </span>
                  </td>
                  <td>{item.summary || '-'}</td>
                  <td>{formatDateTime(item.createdAt)}</td>
                  <td>{formatDurationMs(item.durationMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : historyStatus === 'loading' || historyError ? (
        <p className={styles.invoiceHistoryMuted}>
          {historyStatus === 'loading' ? 'Loading PDF usage history...' : historyError}
        </p>
      ) : null}
    </section>
  )
}
