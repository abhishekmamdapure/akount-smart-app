import styles from '../../shared/Tools.module.css'
import { formatDurationMs, getToolLabel } from '../pdfToolsOperations'
import { formatDateTime, joinClasses } from './helpers'

export default function PdfHistoryPanel({ history, historyStatus, historyError, totalsByTool }) {
  const totals = [
    { id: 'split_merge', label: 'Split / Merge', count: totalsByTool.split_merge || 0 },
    { id: 'reorder_delete', label: 'Reorder / Delete', count: totalsByTool.reorder_delete || 0 },
    { id: 'page_numbers', label: 'Page Numbers', count: totalsByTool.page_numbers || 0 },
    { id: 'watermark', label: 'Watermark', count: totalsByTool.watermark || 0 },
    { id: 'to_word', label: 'Convert to Word', count: totalsByTool.to_word || 0 },
    { id: 'to_excel', label: 'Convert to Excel', count: totalsByTool.to_excel || 0 },
  ]

  return (
    <section className={styles.invoiceHistorySection}>
      <div className={styles.invoiceHistoryHeader}>
        <h2>Usage History</h2>
      </div>

      <div className={styles.heroStats}>
        {totals.map((item) => (
          <article className={styles.heroStat} key={item.id}>
            <span className={styles.heroStatLabel}>{item.label}</span>
            <strong>{item.count}</strong>
            <span>Total runs logged</span>
          </article>
        ))}
      </div>

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
            {history.length > 0 ? (
              history.map((item) => (
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
              ))
            ) : (
              <tr>
                <td className={styles.invoiceHistoryEmpty} colSpan={5}>
                  {historyStatus === 'loading'
                    ? 'Loading PDF usage history...'
                    : historyError || 'No PDF tool runs have been logged yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
