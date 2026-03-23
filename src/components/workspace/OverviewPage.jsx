import styles from './Workspace.module.css'
import WorkspaceIcon from './WorkspaceIcon'
import {
  dashboardMetrics,
  dashboardPlanUsage,
  priorityQueue,
  toolDistribution,
  usageTrendData,
} from './workspaceData'

function joinClasses(...values) {
  return values.filter(Boolean).join(' ')
}

function statusClass(status) {
  if (status === 'Verified') {
    return styles.chipSuccess
  }

  if (status === 'Processing') {
    return styles.chipWarn
  }

  return styles.chipNeutral
}

export default function OverviewPage() {
  const usagePercent = Math.round((dashboardPlanUsage.used / dashboardPlanUsage.total) * 100)

  return (
    <div className={styles.page}>
      <section className={styles.pageIntro}>
        <div>
          <p className={styles.eyebrow}>Executive dashboard</p>
          <h1 className={styles.pageTitle}>Good morning, Alex Sterling!</h1>
          <p className={styles.pageText}>
            October 24, 2026. Track plan usage, document flow, and audit bottlenecks
            across the firm from one workspace.
          </p>
        </div>

        <div className={styles.pageActions}>
          <div className={styles.tabRow}>
            <button className={joinClasses(styles.tabButton, styles.tabButtonActive)} type="button">
              Overview
            </button>
            <button className={styles.tabButton} type="button">Analytics</button>
            <button className={styles.tabButton} type="button">Audit Log</button>
          </div>

          <button className={styles.ghostButton} type="button">All Clients</button>
        </div>
      </section>

      <section className={joinClasses(styles.panel, styles.planPanel)}>
        <div className={styles.planHeader}>
          <div className={styles.planBadge}>
            <WorkspaceIcon name="spark" size={18} />
            <span>{dashboardPlanUsage.planName}</span>
          </div>
          <button className={styles.secondaryButton} type="button">Upgrade</button>
        </div>

        <div className={styles.planContent}>
          <div>
            <p className={styles.metricLabel}>Plan usage</p>
            <h2 className={styles.planTitle}>
              {dashboardPlanUsage.used} of {dashboardPlanUsage.total} clients used
            </h2>
            <p className={styles.planNote}>{dashboardPlanUsage.note}</p>
          </div>

          <div className={styles.planActions}>
            <span className={styles.planStat}>{usagePercent}% full</span>
            <button className={styles.ghostButton} type="button">Add 3 more</button>
          </div>
        </div>

        <div className={styles.progressTrack} aria-hidden="true">
          <div className={styles.progressFill} style={{ width: `${usagePercent}%` }} />
        </div>
      </section>

      <section className={styles.metricGrid}>
        {dashboardMetrics.map((metric) => (
          <article
            className={joinClasses(
              styles.metricCard,
              metric.wide && styles.metricCardWide,
              metric.tone === 'primary' && styles.metricCardPrimary,
              metric.tone === 'warm' && styles.metricCardWarm,
            )}
            key={metric.label}
          >
            <div className={styles.metricHeader}>
              <div className={styles.metricIcon}>
                <WorkspaceIcon name={metric.icon} size={18} />
              </div>
              {metric.badge ? <span className={styles.metricBadge}>{metric.badge}</span> : null}
            </div>
            <p className={styles.metricLabel}>{metric.label}</p>
            <div className={styles.metricValue}>{metric.value}</div>
            <p className={styles.metricNote}>{metric.note}</p>
          </article>
        ))}
      </section>

      <section className={styles.twoColumnGrid}>
        <article className={joinClasses(styles.panel, styles.chartPanel)}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Monthly Usage Trends</h2>
              <p className={styles.panelText}>Aggregate document volume by month.</p>
            </div>

            <div className={styles.legendRow}>
              <span className={styles.legendItem}>
                <span className={joinClasses(styles.legendDot, styles.legendDotCurrent)} />
                Current year
              </span>
              <span className={styles.legendItem}>
                <span className={joinClasses(styles.legendDot, styles.legendDotPrevious)} />
                Previous year
              </span>
            </div>
          </div>

          <div className={styles.chartColumns}>
            {usageTrendData.map((item) => (
              <div className={styles.chartMonth} key={item.month}>
                <div className={styles.chartBars}>
                  <span className={styles.chartBarPrevious} style={{ height: `${item.previous}%` }} />
                  <span className={styles.chartBarCurrent} style={{ height: `${item.current}%` }} />
                </div>
                <span className={styles.chartLabel}>{item.month}</span>
              </div>
            ))}
          </div>
        </article>

        <article className={joinClasses(styles.panel, styles.distributionPanel)}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Tool Distribution</h2>
              <p className={styles.panelText}>Volume split across the active toolset.</p>
            </div>
          </div>

          <div className={styles.distributionList}>
            {toolDistribution.map((item) => (
              <div className={styles.distributionItem} key={item.name}>
                <div className={styles.distributionCopy}>
                  <span>{item.name}</span>
                  <strong>{item.value}</strong>
                </div>
                <div className={styles.distributionTrack}>
                  <span className={styles.distributionFill} style={{ width: `${item.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className={joinClasses(styles.panel, styles.tablePanel)}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.panelTitle}>Priority Processing Queue</h2>
            <p className={styles.panelText}>Documents needing review, cleanup, or approval.</p>
          </div>

          <button className={styles.linkButton} type="button">
            View Complete Queue
            <WorkspaceIcon name="arrowRight" size={16} />
          </button>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Document name</th>
                <th>Client entity</th>
                <th>Submission date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {priorityQueue.map((item) => (
                <tr key={item.name}>
                  <td>
                    <div className={styles.entityCell}>
                      <span className={styles.entityMark}>
                        <WorkspaceIcon name={item.icon} size={16} />
                      </span>
                      <div className={styles.entityMeta}>
                        <strong>{item.name}</strong>
                      </div>
                    </div>
                  </td>
                  <td>{item.entity}</td>
                  <td>{item.submitted}</td>
                  <td>
                    <span className={joinClasses(styles.chip, statusClass(item.status))}>{item.status}</span>
                  </td>
                  <td>
                    <button className={styles.linkButtonInline} type="button">{item.action}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
