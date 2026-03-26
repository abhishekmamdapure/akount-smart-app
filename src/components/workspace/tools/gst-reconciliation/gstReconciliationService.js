import { supabase } from '../../../../supabase'
import { buildWorkspaceUserHeaders } from '../shared/toolClientState'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
const devProxyBaseUrl = '/gst-reconciliation-proxy'

function normalizeRelativePath(pathname = '') {
  const value = String(pathname || '').trim()

  if (!value) {
    return ''
  }

  return value.startsWith('/') ? value : `/${value}`
}

function buildRemoteApiHref(pathname) {
  const normalizedPath = normalizeRelativePath(pathname)

  if (import.meta.env.DEV) {
    return `${devProxyBaseUrl}${normalizedPath}`
  }

  if (!apiBaseUrl) {
    return ''
  }

  return `${apiBaseUrl.replace(/\/$/, '')}${normalizedPath}`
}

function buildGstProcessEndpoint() {
  return buildRemoteApiHref('/api/gst-reconciliation')
}

function createRequestId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function logGstDebug(level, requestId, message, details = {}) {
  const logger = console[level] || console.log
  logger(`[gst-reconciliation:${requestId}] ${message}`, details)
}

function buildDownloadHref(downloadUrl) {
  if (!downloadUrl) {
    return ''
  }

  if (/^https?:\/\//.test(downloadUrl)) {
    return downloadUrl
  }

  const normalizedPath = normalizeRelativePath(downloadUrl)

  if (apiBaseUrl) {
    return `${apiBaseUrl.replace(/\/$/, '')}${normalizedPath}`
  }

  if (import.meta.env.DEV && typeof window !== 'undefined') {
    return `${window.location.origin}${devProxyBaseUrl}${normalizedPath}`
  }

  return ''
}

async function parseJsonResponse(response) {
  const responseText = await response.text().catch(() => '')

  if (!responseText) {
    return {}
  }

  try {
    return JSON.parse(responseText)
  } catch (error) {
    throw new Error(
      `Unexpected response format from ${response.url || 'the server'}. ${responseText.slice(0, 180)}`.trim(),
    )
  }
}

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const token = session?.access_token

  if (!token) {
    throw new Error('Session expired. Please sign in again.')
  }

  return token
}

function buildGstApiHeaders(currentUser, { includeJsonContentType = false, token = '' } = {}) {
  const headers = buildWorkspaceUserHeaders(currentUser, includeJsonContentType)

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

function normalizeProcessingTime(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const numeric = Number(value)

  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null
}

function normalizeMismatchRows(value) {
  return Array.isArray(value) ? value : []
}

export async function fetchGstHistory({ clientId, currentUser }) {
  const response = await fetch(`/api/gst-reconciliation?clientId=${encodeURIComponent(clientId)}`, {
    headers: buildGstApiHeaders(currentUser),
  })
  const data = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error(data.error || 'Unable to load GST reconciliation history.')
  }

  return Array.isArray(data.items) ? data.items : []
}

export async function createGstHistoryEntry({ currentUser, draft, selectedClient, type }) {
  const response = await fetch('/api/gst-reconciliation', {
    body: JSON.stringify({
      clientId: selectedClient.id,
      gstFile: {
        contentType: draft.gstFile?.type || 'application/octet-stream',
        fileName: draft.gstFile?.name || '',
        fileSize: draft.gstFile?.size ?? 0,
      },
      ignoreDecimal: Boolean(draft.ignoreDecimal),
      purchaseFile: {
        contentType: draft.purchaseFile?.type || 'application/octet-stream',
        fileName: draft.purchaseFile?.name || '',
        fileSize: draft.purchaseFile?.size ?? 0,
      },
      tolerance: draft.tolerance,
      type,
    }),
    headers: buildGstApiHeaders(currentUser, { includeJsonContentType: true }),
    method: 'POST',
  })
  const data = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error(data.error || 'Unable to create GST reconciliation history entry.')
  }

  if (!data?.entry?.id || !data?.purchaseUpload?.url || !data?.gstUpload?.url) {
    throw new Error('GST reconciliation history entry was created without valid storage upload targets.')
  }

  return {
    entry: data.entry,
    gstUpload: data.gstUpload,
    purchaseUpload: data.purchaseUpload,
  }
}

export async function uploadGstSourceFiles({ draft, gstUpload, purchaseUpload }) {
  const uploads = [
    fetch(purchaseUpload.url, {
      body: draft.purchaseFile,
      headers: {
        'Content-Type': draft.purchaseFile?.type || 'application/octet-stream',
      },
      method: purchaseUpload.method || 'PUT',
    }),
    fetch(gstUpload.url, {
      body: draft.gstFile,
      headers: {
        'Content-Type': draft.gstFile?.type || 'application/octet-stream',
      },
      method: gstUpload.method || 'PUT',
    }),
  ]

  const [purchaseResponse, gstResponse] = await Promise.all(uploads)

  if (!purchaseResponse.ok) {
    throw new Error('Unable to upload the purchase register to storage.')
  }

  if (!gstResponse.ok) {
    throw new Error('Unable to upload the GST file to storage.')
  }
}

async function updateGstHistoryEntry({
  currentUser,
  entryId,
  payload,
  requiresAuthorization = false,
}) {
  const token = requiresAuthorization ? await getAccessToken() : ''
  const response = await fetch('/api/gst-reconciliation', {
    body: JSON.stringify({
      entryId,
      ...payload,
    }),
    headers: buildGstApiHeaders(currentUser, {
      includeJsonContentType: true,
      token,
    }),
    method: 'PUT',
  })
  const data = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error(data.error || 'Unable to update GST reconciliation history entry.')
  }

  return data.entry
}

export async function markGstHistoryCompleted({ currentUser, entryId, result }) {
  return updateGstHistoryEntry({
    currentUser,
    entryId,
    payload: {
      downloadHref: result.downloadHref || '',
      downloadUrl: result.downloadUrl || '',
      fileId: result.fileId || '',
      processingTimeSec: result.processingTimeSec ?? null,
      status: 'completed',
    },
    requiresAuthorization: true,
  })
}

export async function markGstHistoryFailed({ currentUser, entryId, errorMessage }) {
  return updateGstHistoryEntry({
    currentUser,
    entryId,
    payload: {
      errorMessage,
      status: 'failed',
    },
  })
}

export async function processGstFiles({ draft, selectedClient, type }) {
  const requestId = createRequestId()
  const endpoint = buildGstProcessEndpoint()
  const hasProcessingApi = Boolean(import.meta.env.DEV || apiBaseUrl)
  const startTimestampMs =
    typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now()

  logGstDebug('info', requestId, 'Starting GST reconciliation request.', {
    apiBaseUrl: apiBaseUrl || '(missing)',
    clientId: selectedClient?.id || '',
    clientName: selectedClient?.name || '',
    endpoint,
    gstFileName: draft?.gstFile?.name || '',
    ignoreDecimal: Boolean(draft?.ignoreDecimal),
    isDev: import.meta.env.DEV,
    purchaseFileName: draft?.purchaseFile?.name || '',
    tolerance: draft?.tolerance,
    type,
  })

  if (!hasProcessingApi) {
    logGstDebug('warn', requestId, 'GST reconciliation API base URL is not configured.')
    throw new Error('GST reconciliation API is not configured. Set `VITE_API_BASE_URL` and try again.')
  }

  try {
    const token = await getAccessToken()
    const form = new FormData()

    form.append('pr_file', draft.purchaseFile, draft.purchaseFile.name)
    form.append('g2b_file', draft.gstFile, draft.gstFile.name)
    form.append('client_name', selectedClient.name)
    form.append('tolerance', String(draft.tolerance ?? 10))
    form.append('ignore_decimal', String(Boolean(draft.ignoreDecimal)))
    form.append('gst_file_type', type)

    const response = await fetch(endpoint, {
      body: form,
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      method: 'POST',
    })

    const contentType = response.headers.get('content-type') || ''
    const responseText = await response.text().catch(() => '')

    logGstDebug('info', requestId, 'GST reconciliation response received.', {
      bodyPreview: responseText ? responseText.slice(0, 500) : '',
      contentType,
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
    })

    if (!response.ok) {
      throw new Error(
        `Upload failed (${response.status}). ${responseText ? responseText.slice(0, 180) : 'Check the GST reconciliation API connection.'}`,
      )
    }

    let data = {}

    if (responseText) {
      try {
        data = JSON.parse(responseText)
      } catch (error) {
        logGstDebug('error', requestId, 'GST reconciliation response was not valid JSON.', {
          bodyPreview: responseText.slice(0, 500),
          contentType,
          parseError: error?.message || '',
        })

        throw new Error(
          `GST reconciliation API returned a non-JSON success response. ${responseText ? responseText.slice(0, 180) : ''}`.trim(),
        )
      }
    }

    const purchaseRegisterMismatches = normalizeMismatchRows(
      data?.mismtached_rows_purchase_register ?? data?.mismatched_rows_purchase_register,
    )
    const gstMismatches = normalizeMismatchRows(
      data?.mismtached_rows_gstr_2b_4a ?? data?.mismatched_rows_gstr_2b_4a,
    )

    const result = {
      clientName: selectedClient.name,
      downloadHref: buildDownloadHref(data?.download_url),
      downloadUrl: data?.download_url || '',
      fileId: data?.file_id || '',
      gstFileName: draft.gstFile.name,
      mismatchedRowsGstr2b4a: gstMismatches,
      mismatchedRowsPurchaseRegister: purchaseRegisterMismatches,
      message: 'GST reconciliation completed successfully. Review the generated output and download the result if available.',
      mismtached_rows_gstr_2b_4a: gstMismatches,
      mismtached_rows_purchase_register: purchaseRegisterMismatches,
      processingTimeSec: null,
      purchaseFileName: draft.purchaseFile.name,
      type,
    }

    const apiProcessingTimeSec = normalizeProcessingTime(
      data?.processing_time_sec ?? data?.processing_time_seconds ?? data?.processingTimeSec,
    )
    const elapsedMs =
      (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now()) -
      startTimestampMs
    const elapsedProcessingTimeSec = normalizeProcessingTime(elapsedMs / 1000)

    result.processingTimeSec = apiProcessingTimeSec ?? elapsedProcessingTimeSec

    logGstDebug('info', requestId, 'GST reconciliation completed successfully.', {
      downloadHref: result.downloadHref,
      downloadUrl: result.downloadUrl,
      fileId: result.fileId,
      processingTimeSec: result.processingTimeSec,
      type,
    })

    return result
  } catch (error) {
    logGstDebug('error', requestId, 'GST reconciliation request failed.', {
      message: error?.message || 'Unknown error',
      stack: error?.stack || '',
    })

    if (error instanceof TypeError && /fetch/i.test(error.message || '')) {
      throw new Error(
        import.meta.env.DEV
          ? 'Network/CORS error reaching the GST reconciliation API. Restart `npm run dev` and try again.'
          : 'Network/CORS error reaching the GST reconciliation API. Check backend CORS settings or route the request through a same-origin proxy.',
      )
    }

    throw error
  }
}
