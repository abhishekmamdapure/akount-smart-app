import { supabase } from '../../../../supabase'
import { buildWorkspaceUserHeaders } from '../shared/toolClientState'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
const devProxyBaseUrl = '/invoice-processing-proxy'

function buildInvoiceProcessEndpoint(mode) {
  const encodedMode = encodeURIComponent(mode)

  if (import.meta.env.DEV) {
    return `${devProxyBaseUrl}/api/invoice-processing?mode=${encodedMode}`
  }

  if (!apiBaseUrl) {
    return ''
  }

  return `${apiBaseUrl}/api/invoice-processing?mode=${encodedMode}`
}

function createRequestId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function logInvoiceDebug(level, requestId, message, details = {}) {
  const logger = console[level] || console.log
  logger(`[invoice-processing:${requestId}] ${message}`, details)
}

function normalizeRelativePath(pathname = '') {
  const value = String(pathname || '').trim()

  if (!value) {
    return ''
  }

  return value.startsWith('/') ? value : `/${value}`
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

function buildInvoiceApiHeaders(currentUser, { includeJsonContentType = false, token = '' } = {}) {
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

export async function fetchInvoiceHistory({ clientId, currentUser }) {
  const response = await fetch(`/api/invoice-processing?clientId=${encodeURIComponent(clientId)}`, {
    headers: buildInvoiceApiHeaders(currentUser),
  })
  const data = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error(data.error || 'Unable to load invoice history.')
  }

  return Array.isArray(data.items) ? data.items : []
}

export async function createInvoiceHistoryEntry({ currentUser, file, mode, selectedClient }) {
  const response = await fetch('/api/invoice-processing', {
    body: JSON.stringify({
      clientId: selectedClient.id,
      contentType: file.type || 'application/pdf',
      fileName: file.name,
      fileSize: file.size,
      mode,
    }),
    headers: buildInvoiceApiHeaders(currentUser, { includeJsonContentType: true }),
    method: 'POST',
  })
  const data = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error(data.error || 'Unable to create invoice history entry.')
  }

  if (!data?.entry?.id || !data?.sourceUpload?.url) {
    throw new Error('Invoice history entry was created without a valid storage upload target.')
  }

  return {
    entry: data.entry,
    sourceUpload: data.sourceUpload,
  }
}

export async function uploadInvoiceSourceFile({ file, sourceUpload }) {
  const response = await fetch(sourceUpload.url, {
    body: file,
    headers: {
      'Content-Type': file.type || 'application/pdf',
    },
    method: sourceUpload.method || 'PUT',
  })

  if (!response.ok) {
    throw new Error('Unable to upload the invoice PDF to storage.')
  }
}

async function updateInvoiceHistoryEntry({
  currentUser,
  entryId,
  payload,
  requiresAuthorization = false,
}) {
  const token = requiresAuthorization ? await getAccessToken() : ''
  const response = await fetch('/api/invoice-processing', {
    body: JSON.stringify({
      entryId,
      ...payload,
    }),
    headers: buildInvoiceApiHeaders(currentUser, {
      includeJsonContentType: true,
      token,
    }),
    method: 'PUT',
  })
  const data = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error(data.error || 'Unable to update invoice history entry.')
  }

  return data.entry
}

export async function markInvoiceHistoryCompleted({ currentUser, entryId, result }) {
  return updateInvoiceHistoryEntry({
    currentUser,
    entryId,
    payload: {
      downloadHref: result.downloadHref || '',
      downloadUrl: result.downloadUrl || '',
      fileId: result.fileId || '',
      pages: result.pages ?? null,
      processingTimeSec: result.processingTimeSec ?? null,
      status: 'completed',
    },
    requiresAuthorization: true,
  })
}

export async function markInvoiceHistoryFailed({ currentUser, entryId, errorMessage }) {
  return updateInvoiceHistoryEntry({
    currentUser,
    entryId,
    payload: {
      errorMessage,
      status: 'failed',
    },
  })
}

export async function processInvoiceFile({ file, mode, selectedClient }) {
  const requestId = createRequestId()
  const endpoint = buildInvoiceProcessEndpoint(mode)
  const hasProcessingApi = Boolean(import.meta.env.DEV || apiBaseUrl)
  const startTimestampMs =
    typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now()

  logInvoiceDebug('info', requestId, 'Starting invoice-processing request.', {
    apiBaseUrl: apiBaseUrl || '(missing)',
    clientId: selectedClient?.id || '',
    clientName: selectedClient?.name || '',
    endpoint,
    fileName: file?.name || '',
    fileSize: file?.size ?? 0,
    fileType: file?.type || '',
    isDev: import.meta.env.DEV,
    mode,
  })

  if (!hasProcessingApi) {
    logInvoiceDebug('warn', requestId, 'Invoice-processing API base URL is not configured.')
    throw new Error('Invoice-processing API is not configured. Set `VITE_API_BASE_URL` and try again.')
  }

  try {
    const token = await getAccessToken()

    logInvoiceDebug('info', requestId, 'Supabase session fetched.', {
      hasToken: Boolean(token),
    })

    const form = new FormData()
    form.append('pdf_file', file, file.name)
    form.append('client_id', selectedClient.id)
    form.append('client_name', selectedClient.name)

    logInvoiceDebug('info', requestId, 'Dispatching invoice-processing fetch request.', {
      endpoint,
      formFields: ['pdf_file', 'client_id', 'client_name'],
    })

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: form,
    })

    const contentType = response.headers.get('content-type') || ''
    const responseText = await response.text().catch(() => '')

    logInvoiceDebug('info', requestId, 'Invoice-processing response received.', {
      bodyPreview: responseText ? responseText.slice(0, 500) : '',
      contentType,
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
    })

    if (!response.ok) {
      throw new Error(
        `Upload failed (${response.status}). ${responseText ? responseText.slice(0, 180) : 'Check the invoice-processing API connection.'}`,
      )
    }

    let data = {}

    if (responseText) {
      try {
        data = JSON.parse(responseText)
      } catch (error) {
        logInvoiceDebug('error', requestId, 'Invoice-processing response was not valid JSON.', {
          bodyPreview: responseText.slice(0, 500),
          contentType,
          parseError: error?.message || '',
        })

        throw new Error(
          `Invoice API returned a non-JSON success response. ${responseText ? responseText.slice(0, 180) : ''}`.trim(),
        )
      }
    }

    const result = {
      mode: 'connected',
      clientName: selectedClient.name,
      downloadHref: buildDownloadHref(data?.download_url),
      downloadUrl: data?.download_url || '',
      fileId: data?.file_id || '',
      fileName: file.name,
      message: 'Invoice processed successfully. Review the generated output and download the Excel file if available.',
      pages: data?.pages ?? null,
      processingTimeSec: null,
    }

    const apiProcessingTimeSec = normalizeProcessingTime(
      data?.processing_time_sec ?? data?.processing_time_seconds ?? data?.processingTimeSec,
    )
    const elapsedMs =
      (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now()) -
      startTimestampMs
    const elapsedProcessingTimeSec = normalizeProcessingTime(elapsedMs / 1000)

    result.processingTimeSec = apiProcessingTimeSec ?? elapsedProcessingTimeSec

    logInvoiceDebug('info', requestId, 'Invoice-processing completed successfully.', {
      downloadHref: result.downloadHref,
      downloadUrl: result.downloadUrl,
      fileId: result.fileId,
      pages: result.pages,
      processingTimeSec: result.processingTimeSec,
    })

    return result
  } catch (error) {
    logInvoiceDebug('error', requestId, 'Invoice-processing request failed.', {
      message: error?.message || 'Unknown error',
      stack: error?.stack || '',
    })

    if (error instanceof TypeError && /fetch/i.test(error.message || '')) {
      throw new Error(
        import.meta.env.DEV
          ? 'Network/CORS error reaching the invoice API. The app now expects the Vite dev proxy, so restart `npm run dev` and try again.'
          : 'Network/CORS error reaching the invoice API. Check backend CORS settings or route the request through a same-origin proxy.',
      )
    }

    throw error
  }
}
