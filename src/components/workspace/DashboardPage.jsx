import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import WorkspaceIcon from './WorkspaceIcon'
import {
  getGreeting,
  getFormattedDate,
  shapeToolDistribution,
  getChartMax,
  getBrowserTimeZone,
  assignToolColors,
} from './dashboardHelpers'
import styles from './Dashboard.module.css'

function buildUserHeaders(currentUser) {
  return {
    'x-user-id': currentUser?.id ?? '',
    'x-user-email': currentUser?.email ?? '',
  }
}

/**
 * Builds the SVG area-chart path data for the activity buckets.
 *
 * @param {{ label: string, count: number }[]} buckets
 * @param {number} chartMax
 * @param {number} width
 * @param {number} height
 * @param {number} padLeft
 * @param {number} padTop
 * @param {number} padBottom
 * @returns {{ areaPath: string, linePath: string, points: { x: number, y: number, count: number, label: string }[] }}
 */
function buildChartPaths(buckets, chartMax, width, height, padLeft = 50, padTop = 16, padBottom = 36) {
  const drawWidth = width - padLeft - 20
  const drawHeight = height - padTop - padBottom
  const count = buckets.length

  if (count === 0) {
    return { areaPath: '', linePath: '', points: [] }
  }

  const points = buckets.map((bucket, i) => {
    const x = padLeft + (i / Math.max(1, count - 1)) * drawWidth
    const rawY = padTop + drawHeight - (bucket.count / chartMax) * drawHeight
    const y = Number.isFinite(rawY) ? rawY : padTop + drawHeight
    return { x, y, count: bucket.count, label: bucket.label }
  })

  // Catmull-Rom to cubic bezier conversion for smooth curves
  function catmullRomToBezier(pts) {
    if (pts.length < 2) return `M ${pts[0].x},${pts[0].y}`
    if (pts.length === 2) return `M ${pts[0].x},${pts[0].y} L ${pts[1].x},${pts[1].y}`

    let d = `M ${pts[0].x},${pts[0].y}`
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)]
      const p1 = pts[i]
      const p2 = pts[Math.min(pts.length - 1, i + 1)]
      const p3 = pts[Math.min(pts.length - 1, i + 2)]

      const cp1x = p1.x + (p2.x - p0.x) / 6
      const cp1y = p1.y + (p2.y - p0.y) / 6
      const cp2x = p2.x - (p3.x - p1.x) / 6
      const cp2y = p2.y - (p3.y - p1.y) / 6

      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`
    }
    return d
  }

  const linePath = catmullRomToBezier(points)
  const baseline = padTop + drawHeight
  const areaPath = `${linePath} L ${points[points.length - 1].x},${baseline} L ${points[0].x},${baseline} Z`

  return { areaPath, linePath, points }
}

/**
 * KPI Card Component
 */
function KpiCard({ label, value, note, iconName }) {
  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiHeader}>
        <span className={styles.kpiLabel}>{label}</span>
        <span className={styles.kpiIcon}>
          <WorkspaceIcon name={iconName} size={18} />
        </span>
      </div>
      <div className={styles.kpiValue}>{value}</div>
      {note ? <div className={styles.kpiNote}>{note}</div> : null}
    </div>
  )
}

/**
 * Top Clients KPI Component
 */
function TopClientsCard({ clients }) {
  if (!clients || clients.length === 0) {
    return (
      <div className={styles.kpiCard}>
        <div className={styles.kpiHeader}>
          <span className={styles.kpiLabel}>Top Clients</span>
          <span className={styles.kpiIcon}>
            <WorkspaceIcon name="users" size={18} />
          </span>
        </div>
        <div className={styles.kpiValue} style={{ fontSize: '1.4rem' }}>No data</div>
        <div className={styles.kpiNote}>No documents processed</div>
      </div>
    )
  }

  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiHeader}>
        <span className={styles.kpiLabel}>Top Clients</span>
        <span className={styles.kpiIcon}>
          <WorkspaceIcon name="users" size={18} />
        </span>
      </div>
      <div className={styles.topClientsWrap}>
        {clients.map((c, i) => (
          <div key={i} className={styles.topClientRow}>
            <span className={styles.topClientName} title={c.name}>{c.name}</span>
            <span className={styles.topClientCount}>{c.count} {c.count === 1 ? 'doc' : 'docs'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Activity Area Chart Component
 */
function ActivityChart({ buckets, chartMax }) {
  const [hoveredIndex, setHoveredIndex] = useState(null)
  const svgWidth = 700
  const svgHeight = 260
  const padLeft = 48
  const padTop = 20
  const padBottom = 40

  const { areaPath, linePath, points } = buildChartPaths(
    buckets,
    chartMax,
    svgWidth,
    svgHeight,
    padLeft,
    padTop,
    padBottom,
  )

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((frac) => {
    const drawHeight = svgHeight - padTop - padBottom
    const y = padTop + drawHeight - frac * drawHeight
    const labelValue = Math.round(frac * chartMax)
    return { y, label: labelValue }
  })

  return (
    <div className={styles.chartWrap}>
      <svg className={styles.chartSvg} viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="dashAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7db3ff" stopOpacity="0.35" />
            <stop offset="60%" stopColor="#a8ccff" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#d0e4ff" stopOpacity="0.03" />
          </linearGradient>
        </defs>

        {gridLines.map((g, i) => (
          <g key={`grid-${i}`}>
            <line className={styles.chartGridLine} x1={padLeft} y1={g.y} x2={svgWidth - 20} y2={g.y} />
            <text className={styles.chartLabelY} x={padLeft - 10} y={g.y + 4}>
              {g.label}
            </text>
          </g>
        ))}

        {areaPath ? <path className={styles.chartArea} d={areaPath} fill="url(#dashAreaGrad)" /> : null}
        {linePath ? (
          <path className={styles.chartLine} d={linePath} fill="none" stroke="#5b9aff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        ) : null}

        {points.map((p, i) => (
          <g key={`dot-${i}`}>
            <text className={styles.chartLabelX} x={p.x} y={svgHeight - 10}>
              {p.label}
            </text>
            {hoveredIndex === i ? (
              <circle cx={p.x} cy={p.y} r={12} fill="rgba(91,154,255,0.12)" />
            ) : null}
            <circle
              className={styles.chartDot}
              cx={p.x}
              cy={p.y}
              r={hoveredIndex === i ? 5 : 3.5}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          </g>
        ))}
      </svg>

      {hoveredIndex !== null && points[hoveredIndex] ? (
        <div
          className={`${styles.chartTooltip} ${styles.chartTooltipVisible}`}
          style={{
            left: `${(points[hoveredIndex].x / svgWidth) * 100}%`,
            top: `${(points[hoveredIndex].y / svgHeight) * 100}%`,
          }}
        >
          {points[hoveredIndex].count} files · {points[hoveredIndex].label}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Client Overview Panel Component
 */
function ClientOverviewPanel({ data }) {
  const usedPercent = data.clientLimit > 0 ? Math.min(100, (data.clientsUsed / data.clientLimit) * 100) : 0

  return (
    <div className={styles.clientPanel}>
      <div className={styles.clientPanelHeader}>
        <span className={styles.clientPanelTitle}>Client Overview</span>
        <span className={styles.planBadge}>{data.planName}</span>
      </div>
      <div className={styles.capacityTrack}>
        <span className={styles.capacityFill} style={{ width: `${usedPercent}%` }} />
      </div>
      <div className={styles.capacityNote}>
        {data.clientsUsed} of {data.clientLimit} client slots used
      </div>
    </div>
  )
}

/**
 * Tool Distribution Panel Component
 */
function ToolDistributionPanel({ toolTotals }) {
  const distribution = shapeToolDistribution(toolTotals)
  const coloredDistribution = assignToolColors(distribution)
  const maxCount = distribution.length > 0 ? Math.max(1, distribution[0].count) : 1

  if (distribution.length === 0) {
    return (
      <div className={styles.toolPanel}>
        <div className={styles.toolPanelTitle}>Tool Usage Distribution</div>
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>
            <WorkspaceIcon name="chart" size={22} />
          </span>
          <div className={styles.emptyTitle}>No usage yet</div>
          <div className={styles.emptyText}>Start using tools to see your distribution here.</div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.toolPanel}>
      <div className={styles.toolPanelTitle}>Tool Usage Distribution</div>
      <div className={styles.toolList}>
        {coloredDistribution.map((item) => (
          <div className={styles.toolRow} key={item.tool}>
            <span className={styles.toolDot} style={{ background: item.color }} />
            <span className={styles.toolLabel}>{item.label}</span>
            <span className={styles.toolCount}>{item.count}</span>
            <span className={styles.toolBar}>
              <span
                className={styles.toolBarFill}
                style={{
                  width: `${Math.max(4, (item.count / maxCount) * 100)}%`,
                  background: item.color,
                }}
              />
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Loading Skeleton
 */
function DashboardSkeleton() {
  return (
    <div className={styles.dashboardPage}>
      <div className={`${styles.skeleton} ${styles.skeletonHeader}`} />
      <div className={styles.kpiStrip}>
        <div className={`${styles.skeleton} ${styles.skeletonKpi}`} />
        <div className={`${styles.skeleton} ${styles.skeletonKpi}`} />
        <div className={`${styles.skeleton} ${styles.skeletonKpi}`} />
        <div className={`${styles.skeleton} ${styles.skeletonKpi}`} />
      </div>
      <div className={styles.mainGrid}>
        <div className={`${styles.skeleton} ${styles.skeletonChart}`} />
        <div className={styles.rightRail}>
          <div className={`${styles.skeleton} ${styles.skeletonRail}`} />
          <div className={`${styles.skeleton} ${styles.skeletonRail}`} />
        </div>
      </div>
    </div>
  )
}

/**
 * Main Dashboard Page Component
 */
export default function DashboardPage() {
  const { currentUser, userProfile } = useOutletContext()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [range, setRange] = useState('30d')
  const [fading, setFading] = useState(false)

  const firstName = userProfile?.profile?.firstName || ''

  useEffect(() => {
    if (!currentUser?.id || !currentUser?.email) {
      return
    }

    let cancelled = false

    async function fetchDashboard() {
      setLoading(true)
      setError(null)

      try {
        const tz = getBrowserTimeZone()
        const response = await fetch(`/api/dashboard-summary?timeZone=${encodeURIComponent(tz)}`, {
          headers: buildUserHeaders(currentUser),
        })

        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error(body.error || 'Unable to load dashboard data.')
        }

        const result = await response.json()

        if (!cancelled) {
          setData(result)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchDashboard()

    return () => {
      cancelled = true
    }
  }, [currentUser?.id, currentUser?.email])

  function switchRange(nextRange) {
    if (nextRange === range) {
      return
    }

    setFading(true)
    setTimeout(() => {
      setRange(nextRange)
      setFading(false)
    }, 300)
  }

  if (loading) {
    return <DashboardSkeleton />
  }

  if (error) {
    return (
      <div className={styles.dashboardPage}>
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>
            <WorkspaceIcon name="spark" size={22} />
          </span>
          <div className={styles.emptyTitle}>Unable to load dashboard</div>
          <div className={styles.emptyText}>{error}</div>
        </div>
      </div>
    )
  }

  const rangeData = data?.ranges?.[range] || {}
  const buckets = rangeData.activityBuckets || []
  const chartMax = getChartMax(buckets)
  const toolTotals = rangeData.toolTotals || []
  const completedCount = rangeData.completedCount || 0
  const failedCount = rangeData.failedCount || 0
  const topTool = rangeData.topTool || 'None yet'
  const topClients = rangeData.topClients || []
  const passwordsManaged = data?.passwordsManaged || 0
  const clientOverview = data?.clientOverview || {
    totalClients: 0,
    planName: 'Basic Plan',
    clientLimit: 10,
    clientsUsed: 0,
    remainingSlots: 10,
  }

  const rangeLabel = range === '30d' ? 'Last 30 days' : 'Last 3 months'

  return (
    <div className={styles.dashboardPage}>
      {/* Header Band */}
      <div className={styles.headerBand}>
        <div className={styles.headerLeft}>
          <h1 className={styles.greeting}>{getGreeting(firstName)}</h1>
          <p className={styles.dateText}>{getFormattedDate()}</p>
        </div>
        <div className={styles.headerRight}>
          <button
            className={`${styles.filterButton} ${range === '30d' ? styles.filterButtonActive : ''}`}
            onClick={() => switchRange('30d')}
            type="button"
          >
            <WorkspaceIcon name="calendar" size={14} />
            Last 30 days
          </button>
          <button
            className={`${styles.filterButton} ${range === '90d' ? styles.filterButtonActive : ''}`}
            onClick={() => switchRange('90d')}
            type="button"
          >
            <WorkspaceIcon name="calendar" size={14} />
            Last 3 months
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className={`${styles.kpiStrip} ${styles.crossfade} ${fading ? styles.crossfadeFading : ''}`}>
        <KpiCard label="Files Processed" value={completedCount} note={rangeLabel} iconName="file" />
        <KpiCard label="Most-used Tool" value={topTool} note={rangeLabel} iconName="spark" />
        <KpiCard label="Passwords Managed" value={passwordsManaged} note="All clients" iconName="password" />
        <TopClientsCard clients={topClients} />
      </div>

      {/* Main Grid */}
      <div className={`${styles.mainGrid} ${styles.crossfade} ${fading ? styles.crossfadeFading : ''}`}>
        {/* Activity Chart */}
        <div className={styles.chartPanel}>
          <div className={styles.chartTitle}>Activity Overview</div>
          {buckets.length > 0 ? (
            <ActivityChart buckets={buckets} chartMax={chartMax} />
          ) : (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>
                <WorkspaceIcon name="chart" size={22} />
              </span>
              <div className={styles.emptyTitle}>No activity yet</div>
              <div className={styles.emptyText}>Process files to see your activity chart here.</div>
            </div>
          )}
        </div>

        {/* Right Rail */}
        <div className={styles.rightRail}>
          <ClientOverviewPanel data={clientOverview} />
          <ToolDistributionPanel toolTotals={toolTotals} />
        </div>
      </div>
    </div>
  )
}
