/**
 * Returns a smart greeting based on the current browser hour.
 *
 * @param {string} [firstName] - User's first name. Falls back to empty string.
 * @param {Date} [now] - Override for testing. Defaults to new Date().
 * @returns {string} Greeting string, e.g. "Good Morning, Abhishek"
 */
export function getGreeting(firstName, now) {
  const date = now || new Date()
  const hour = date.getHours()
  let period = 'Evening'

  if (hour >= 5 && hour < 12) {
    period = 'Morning'
  } else if (hour >= 12 && hour < 17) {
    period = 'Afternoon'
  }

  const name = String(firstName || '').trim()

  return name ? `Good ${period}, ${name}` : `Good ${period}`
}

/**
 * Formats the current date for display.
 *
 * @param {Date} [now] - Override for testing.
 * @returns {string} Formatted date, e.g. "Wednesday, March 26, 2026"
 */
export function getFormattedDate(now) {
  const date = now || new Date()

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Shapes tool totals into top-6-plus-others for the distribution list.
 * If there are 6 or fewer tools, returns them as-is.
 * Otherwise, returns the top 6 and an aggregated "Others" row.
 *
 * @param {{ tool: string, label: string, count: number }[]} toolTotals - Pre-sorted descending by count.
 * @returns {{ tool: string, label: string, count: number }[]}
 */
export function shapeToolDistribution(toolTotals) {
  if (!toolTotals || toolTotals.length === 0) {
    return []
  }

  if (toolTotals.length <= 6) {
    return toolTotals
  }

  const top6 = toolTotals.slice(0, 6)
  const othersCount = toolTotals.slice(6).reduce((sum, t) => sum + t.count, 0)

  if (othersCount > 0) {
    top6.push({ tool: 'others', label: 'Others', count: othersCount })
  }

  return top6
}

/**
 * Computes the maximum value in an activity-buckets array for chart scaling.
 *
 * @param {{ label: string, count: number }[]} buckets
 * @returns {number}
 */
export function getChartMax(buckets) {
  if (!buckets || buckets.length === 0) {
    return 1
  }

  return Math.max(1, ...buckets.map((b) => b.count))
}

/**
 * Formats a percentage for display.
 *
 * @param {number} value - Percentage value, e.g. 2.5
 * @returns {string} Formatted string, e.g. "2.5%"
 */
export function formatErrorRate(value) {
  if (!value || value === 0) {
    return '0%'
  }

  return `${value}%`
}

/**
 * Returns the IANA timezone of the user's browser.
 *
 * @returns {string} e.g. "Asia/Kolkata"
 */
export function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/**
 * Assigns a color from a palette to each tool in a distribution list.
 *
 * @param {{ tool: string, label: string, count: number }[]} distribution
 * @returns {{ tool: string, label: string, count: number, color: string }[]}
 */
export function assignToolColors(distribution) {
  const palette = [
    '#315efb',
    '#6a83ff',
    '#119a63',
    '#c8861d',
    '#d64a4a',
    '#8b5cf6',
    '#94a3b8',
  ]

  return distribution.map((item, index) => ({
    ...item,
    color: palette[index % palette.length],
  }))
}
