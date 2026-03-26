import { buildWorkspaceUserHeaders } from '../shared/toolClientState'

const toolKeys = ['split_merge', 'reorder_delete', 'page_numbers', 'watermark', 'to_word', 'to_excel', 'compress_pdf']

export const EMPTY_PDF_TOOL_TOTALS = Object.freeze(
  toolKeys.reduce((acc, tool) => {
    acc[tool] = 0
    return acc
  }, {}),
)

function cloneDefaultTotals() {
  return {
    split_merge: 0,
    reorder_delete: 0,
    page_numbers: 0,
    watermark: 0,
    to_word: 0,
    to_excel: 0,
    compress_pdf: 0,
  }
}

async function parseJsonResponse(response) {
  const text = await response.text().catch(() => '')

  if (!text) {
    return {}
  }

  try {
    return JSON.parse(text)
  } catch {
    throw new Error('Unexpected response format from PDF usage API.')
  }
}

export async function fetchPdfToolsUsage({ currentUser }) {
  const response = await fetch('/api/pdf-tools-usage', {
    headers: buildWorkspaceUserHeaders(currentUser),
  })
  const data = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error(data.error || 'Unable to load PDF tool usage history.')
  }

  const totalsByTool = cloneDefaultTotals()

  Object.entries(data?.totalsByTool || {}).forEach(([key, value]) => {
    if (!Object.hasOwn(totalsByTool, key)) {
      return
    }

    const nextValue = Number(value)
    totalsByTool[key] = Number.isFinite(nextValue) ? Math.max(0, Math.round(nextValue)) : 0
  })

  return {
    items: Array.isArray(data?.items) ? data.items : [],
    totalsByTool,
  }
}

export async function logPdfToolsUsage({ currentUser, tool, status, summary, durationMs }) {
  const response = await fetch('/api/pdf-tools-usage', {
    method: 'POST',
    headers: buildWorkspaceUserHeaders(currentUser, true),
    body: JSON.stringify({
      tool,
      status,
      summary,
      durationMs,
    }),
  })
  const data = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error(data.error || 'Unable to write PDF tool usage event.')
  }

  return data?.entry || null
}
