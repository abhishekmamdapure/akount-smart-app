import { PDF_TOOLS_USAGE_KEYS, PdfToolsUsageEvent } from '../models/pdfToolsUsage.js'

function normalizeDurationMs(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const numericValue = Number(value)

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return null
  }

  return Math.round(numericValue)
}

function buildTotalsByTool(items = []) {
  const totals = PDF_TOOLS_USAGE_KEYS.reduce((acc, tool) => {
    acc[tool] = 0
    return acc
  }, {})

  items.forEach((item) => {
    if (totals[item.tool] === undefined) {
      return
    }

    totals[item.tool] += 1
  })

  return totals
}

function serializeUsageEntry(entry) {
  return {
    id: String(entry._id),
    tool: entry.tool,
    status: entry.status,
    summary: entry.summary || '',
    durationMs: normalizeDurationMs(entry.durationMs),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }
}

export async function listPdfToolsUsage(owner, { limit = 120 } = {}) {
  const cappedLimit = Math.max(1, Math.min(300, Number(limit) || 120))
  const entries = await PdfToolsUsageEvent.find({ 'owner.userId': owner.userId })
    .sort({ createdAt: -1 })
    .limit(cappedLimit)
    .lean()

  const items = entries.map((entry) => serializeUsageEntry(entry))

  return {
    items,
    totalsByTool: buildTotalsByTool(items),
  }
}

export async function createPdfToolsUsage(owner, payload = {}) {
  const tool = String(payload.tool || '').trim()
  const status = String(payload.status || '').trim()
  const summary = String(payload.summary || '').trim()
  const durationMs = normalizeDurationMs(payload.durationMs)

  if (!PDF_TOOLS_USAGE_KEYS.includes(tool)) {
    return {
      validationError:
        'A valid tool is required. Use one of: split_merge, reorder_delete, page_numbers, watermark, to_word, to_excel.',
    }
  }

  if (status !== 'completed' && status !== 'failed') {
    return {
      validationError: 'A valid status is required. Use either completed or failed.',
    }
  }

  if (!summary) {
    return {
      validationError: 'Summary is required.',
    }
  }

  const event = new PdfToolsUsageEvent({
    owner: {
      userId: owner.userId,
      email: owner.email,
      lastSeenAt: new Date(),
    },
    tool,
    status,
    summary: summary.slice(0, 320),
    durationMs,
  })

  await event.save()

  return {
    entry: serializeUsageEntry(event),
    validationError: null,
  }
}
