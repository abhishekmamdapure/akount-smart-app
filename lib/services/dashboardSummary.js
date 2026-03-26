import { ClientWorkspace } from '../models/client.js'
import { UserSettings } from '../models/user.js'
import { PdfToolsUsageEvent } from '../models/pdfToolsUsage.js'
import { InvoiceProcessingJob } from '../models/invoiceProcessing.js'
import { GstReconciliationJob } from '../models/gstReconciliation.js'
import { TallyXmlConversionJob } from '../models/tallyXmlConversion.js'
import { PasswordVault } from '../models/passwordManager.js'

/**
 * Tool label mapping for display purposes.
 * Password Manager is excluded from file-volume totals (v1).
 */
const TOOL_LABELS = {
  pdf_split_merge: 'Split & Merge',
  pdf_reorder_delete: 'Reorder & Delete',
  pdf_page_numbers: 'Page Numbers',
  pdf_watermark: 'Watermark',
  pdf_to_word: 'PDF to Word',
  pdf_to_excel: 'PDF to Excel',
  pdf_compress: 'Compress PDF',
  invoice_processing: 'Invoice Processing',
  gst_reconciliation: 'GST Reconciliation',
  tally_xml: 'Tally XML Converter',
}

/**
 * Builds a Date cutoff for the given number of days ago from now,
 * using the browser-supplied IANA timezone for bucket alignment.
 *
 * @param {number} days - Number of days to look back.
 * @returns {Date} The cutoff date.
 */
function buildCutoffDate(days) {
  const now = new Date()
  now.setDate(now.getDate() - days)
  now.setHours(0, 0, 0, 0)
  return now
}

/**
 * Generates evenly-spaced date buckets for charting.
 *
 * @param {number} days - Range in days (30 or 90).
 * @param {string} timeZone - IANA timezone string.
 * @returns {{ label: string, start: Date, end: Date }[]} Array of buckets.
 */
function generateBuckets(days, timeZone) {
  const buckets = []
  const now = new Date()
  const bucketCount = days === 90 ? 6 : 6
  const bucketSizeDays = Math.ceil(days / bucketCount)

  for (let i = bucketCount - 1; i >= 0; i--) {
    const endOffset = i * bucketSizeDays
    const startOffset = endOffset + bucketSizeDays

    const start = new Date(now)
    start.setDate(start.getDate() - startOffset)
    start.setHours(0, 0, 0, 0)

    const end = new Date(now)
    end.setDate(end.getDate() - endOffset)
    end.setHours(23, 59, 59, 999)

    if (i === 0) {
      end.setTime(now.getTime())
    }

    const label = start.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: timeZone || 'UTC',
    })

    buckets.push({ label, start, end })
  }

  return buckets
}

/**
 * Maps a PDF tool key from the usage event to the dashboard tool key.
 *
 * @param {string} pdfToolKey - e.g. 'split_merge', 'compress_pdf'
 * @returns {string} Dashboard-level tool key.
 */
function mapPdfToolKey(pdfToolKey) {
  const mapping = {
    split_merge: 'pdf_split_merge',
    reorder_delete: 'pdf_reorder_delete',
    page_numbers: 'pdf_page_numbers',
    watermark: 'pdf_watermark',
    to_word: 'pdf_to_word',
    to_excel: 'pdf_to_excel',
    compress_pdf: 'pdf_compress',
  }
  return mapping[pdfToolKey] || `pdf_${pdfToolKey}`
}

/**
 * Aggregates all tool usage for a given user within a date range.
 *
 * @param {string} userId - Owner user ID.
 * @param {Date} cutoff - Start date for the range.
 * @returns {Promise<{ tool: string, status: string, createdAt: Date }[]>}
 */
async function fetchAllUsageEvents(userId, cutoff) {
  const events = []

  const [pdfEvents, invoiceJobs, gstJobs, tallyJobs] = await Promise.all([
    PdfToolsUsageEvent.find({
      'owner.userId': userId,
      createdAt: { $gte: cutoff },
    })
      .select('tool status createdAt')
      .lean(),

    InvoiceProcessingJob.find({
      'owner.userId': userId,
      createdAt: { $gte: cutoff },
      status: { $in: ['completed', 'failed'] },
    })
      .select('status createdAt clientName')
      .lean(),

    GstReconciliationJob.find({
      'owner.userId': userId,
      createdAt: { $gte: cutoff },
      status: { $in: ['completed', 'failed'] },
    })
      .select('status createdAt clientName')
      .lean(),

    TallyXmlConversionJob.find({
      'owner.userId': userId,
      createdAt: { $gte: cutoff },
      status: { $in: ['completed', 'failed'] },
    })
      .select('status createdAt clientName')
      .lean(),
  ])

  pdfEvents.forEach((event) => {
    events.push({
      tool: mapPdfToolKey(event.tool),
      status: event.status,
      createdAt: event.createdAt,
    })
  })

  invoiceJobs.forEach((job) => {
    events.push({
      tool: 'invoice_processing',
      status: job.status,
      createdAt: job.createdAt,
      clientName: job.clientName,
    })
  })

  gstJobs.forEach((job) => {
    events.push({
      tool: 'gst_reconciliation',
      status: job.status,
      createdAt: job.createdAt,
      clientName: job.clientName,
    })
  })

  tallyJobs.forEach((job) => {
    events.push({
      tool: 'tally_xml',
      status: job.status,
      createdAt: job.createdAt,
      clientName: job.clientName,
    })
  })

  return events
}

/**
 * Builds the range-specific summary (activity buckets, tool totals, error rate, etc.).
 *
 * @param {{ tool: string, status: string, createdAt: Date }[]} events
 * @param {{ label: string, start: Date, end: Date }[]} buckets
 * @returns {{ activityBuckets: object[], toolTotals: object[], completedCount: number, failedCount: number, errorRate: number, topTool: string }}
 */
function buildRangeSummary(events, buckets) {
  const activityBuckets = buckets.map((bucket) => {
    const count = events.filter(
      (e) => e.status === 'completed' && e.createdAt >= bucket.start && e.createdAt <= bucket.end,
    ).length

    return {
      label: bucket.label,
      count,
    }
  })

  const toolCounts = {}

  events.forEach((event) => {
    if (event.status === 'completed') {
      toolCounts[event.tool] = (toolCounts[event.tool] || 0) + 1
    }
  })

  const toolTotals = Object.entries(toolCounts)
    .map(([tool, count]) => ({
      tool,
      label: TOOL_LABELS[tool] || tool,
      count,
    }))
    .sort((a, b) => b.count - a.count)

  const completedCount = events.filter((e) => e.status === 'completed').length
  const failedCount = events.filter((e) => e.status === 'failed').length
  const total = completedCount + failedCount
  const errorRate = total > 0 ? Math.round((failedCount / total) * 10000) / 100 : 0

  const topTool = toolTotals.length > 0 ? toolTotals[0].label : 'None yet'

  const activeToolsSet = new Set()
  events.forEach((e) => {
    if (e.status === 'completed') {
      activeToolsSet.add(e.tool)
    }
  })

  const clientCounts = {}
  events.forEach((event) => {
    if (event.status === 'completed' && event.clientName) {
      clientCounts[event.clientName] = (clientCounts[event.clientName] || 0) + 1
    }
  })

  let topClients = Object.entries(clientCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)

  if (topClients.length < 3) {
    topClients = topClients.slice(0, 1)
  }

  return {
    activityBuckets,
    toolTotals,
    completedCount,
    failedCount,
    errorRate,
    topTool,
    activeToolCount: activeToolsSet.size,
    topClients,
  }
}

/**
 * Fetches the complete dashboard summary for a user.
 *
 * @param {{ userId: string, email: string }} owner - Authenticated owner.
 * @param {string} [timeZone='UTC'] - IANA timezone from the browser.
 * @returns {Promise<object>} Dashboard summary response body.
 */
export async function getDashboardSummary(owner, timeZone = 'UTC') {
  const cutoff30 = buildCutoffDate(30)
  const cutoff90 = buildCutoffDate(90)

  const [allEvents90, userSettings, clientCountResult, passwordVaultCount] = await Promise.all([
    fetchAllUsageEvents(owner.userId, cutoff90),
    UserSettings.findOne({ 'owner.userId': owner.userId }).lean(),
    ClientWorkspace.aggregate([
      { $match: { 'owner.userId': owner.userId } },
      {
        $project: {
          _id: 0,
          clientsUsed: { $size: { $ifNull: ['$clients', []] } },
        },
      },
    ]),
    PasswordVault.countDocuments({ 'owner.userId': owner.userId }),
  ])

  const clientsUsed = clientCountResult?.[0]?.clientsUsed || 0
  const planName = userSettings?.plan?.name || 'Basic Plan'
  const clientLimit = userSettings?.plan?.clientLimit || 10

  const events30 = allEvents90.filter((e) => e.createdAt >= cutoff30)

  const buckets30 = generateBuckets(30, timeZone)
  const buckets90 = generateBuckets(90, timeZone)

  const summary30 = buildRangeSummary(events30, buckets30)
  const summary90 = buildRangeSummary(allEvents90, buckets90)

  const totalClients = clientsUsed

  return {
    clientOverview: {
      totalClients,
      planName,
      clientLimit,
      clientsUsed,
      remainingSlots: Math.max(0, clientLimit - clientsUsed),
    },
    passwordsManaged: passwordVaultCount || 0,
    ranges: {
      '30d': summary30,
      '90d': summary90,
    },
    lastUpdatedAt: new Date().toISOString(),
  }
}
