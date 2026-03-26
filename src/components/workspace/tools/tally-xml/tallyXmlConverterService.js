import { supabase } from '../../../../supabase'
import { buildWorkspaceUserHeaders } from '../shared/toolClientState'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
const devProxyBaseUrl = '/tally-xml-proxy'

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

function buildTallyConvertEndpoint() {
  return buildRemoteApiHref('/api/tally-xml')
}

function buildTallyTemplateEndpoint() {
  return buildRemoteApiHref('/api/tally-xml/template')
}

function createRequestId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function logTallyDebug(level, requestId, message, details = {}) {
  const logger = console[level] || console.log
  logger(`[tally-xml:${requestId}] ${message}`, details)
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

function buildTallyApiHeaders(currentUser, { includeJsonContentType = false, token = '' } = {}) {
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

export async function fetchTallyHistory({ clientId, currentUser }) {
  const response = await fetch(`/api/tally-xml?clientId=${encodeURIComponent(clientId)}`, {
    headers: buildTallyApiHeaders(currentUser),
  })
  const data = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error(data.error || 'Unable to load Tally XML history.')
  }

  return Array.isArray(data.items) ? data.items : []
}

export async function createTallyHistoryEntry({ currentUser, file, preferences, selectedClient }) {
  const response = await fetch('/api/tally-xml', {
    body: JSON.stringify({
      clientId: selectedClient.id,
      contentType: file.type || 'application/octet-stream',
      fileName: file.name,
      fileSize: file.size,
      preferences,
    }),
    headers: buildTallyApiHeaders(currentUser, { includeJsonContentType: true }),
    method: 'POST',
  })
  const data = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error(data.error || 'Unable to create Tally XML history entry.')
  }

  if (!data?.entry?.id || !data?.sourceUpload?.url) {
    throw new Error('Tally XML history entry was created without a valid storage upload target.')
  }

  return {
    entry: data.entry,
    sourceUpload: data.sourceUpload,
  }
}

export async function uploadTallySourceFile({ file, sourceUpload }) {
  const response = await fetch(sourceUpload.url, {
    body: file,
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
    method: sourceUpload.method || 'PUT',
  })

  if (!response.ok) {
    throw new Error('Unable to upload the source spreadsheet to storage.')
  }
}

async function updateTallyHistoryEntry({
  currentUser,
  entryId,
  payload,
  requiresAuthorization = false,
}) {
  const token = requiresAuthorization ? await getAccessToken() : ''
  const response = await fetch('/api/tally-xml', {
    body: JSON.stringify({
      entryId,
      ...payload,
    }),
    headers: buildTallyApiHeaders(currentUser, {
      includeJsonContentType: true,
      token,
    }),
    method: 'PUT',
  })
  const data = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error(data.error || 'Unable to update Tally XML history entry.')
  }

  return data.entry
}

export async function markTallyHistoryCompleted({ currentUser, entryId, result }) {
  return updateTallyHistoryEntry({
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

export async function markTallyHistoryFailed({ currentUser, entryId, errorMessage }) {
  return updateTallyHistoryEntry({
    currentUser,
    entryId,
    payload: {
      errorMessage,
      status: 'failed',
    },
  })
}

export async function downloadTallyTemplate() {
  const requestId = createRequestId()
  const endpoint = buildTallyTemplateEndpoint()
  const hasTallyApi = Boolean(import.meta.env.DEV || apiBaseUrl)

  logTallyDebug('info', requestId, 'Starting Tally template request.', {
    apiBaseUrl: apiBaseUrl || '(missing)',
    endpoint,
    isDev: import.meta.env.DEV,
  })

  if (!hasTallyApi) {
    throw new Error('Tally XML API is not configured. Set `VITE_API_BASE_URL` and try again.')
  }

  const response = await fetch(endpoint, {
    headers: {
      accept: 'application/json',
    },
  })
  const data = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error(data.error || `Template request failed (${response.status}).`)
  }

  const downloadHref = buildDownloadHref(data?.download_url)

  if (!downloadHref) {
    throw new Error('Template response did not include a valid download URL.')
  }

  const expiresInSeconds = normalizeProcessingTime(data?.expires_in_seconds)

  return {
    downloadHref,
    expiresInSeconds,
    message: expiresInSeconds
      ? `Template download started. Link expires in ${Math.round(expiresInSeconds)} seconds.`
      : 'Template download started.',
  }
}

export async function processTallySourceFile({ file, preferences, selectedClient }) {
  const requestId = createRequestId()
  const endpoint = buildTallyConvertEndpoint()
  const hasTallyApi = Boolean(import.meta.env.DEV || apiBaseUrl)
  const startTimestampMs =
    typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now()

  logTallyDebug('info', requestId, 'Starting tally-xml conversion request.', {
    apiBaseUrl: apiBaseUrl || '(missing)',
    clientId: selectedClient?.id || '',
    clientName: selectedClient?.name || '',
    endpoint,
    fileName: file?.name || '',
    fileSize: file?.size ?? 0,
    fileType: file?.type || '',
    isDev: import.meta.env.DEV,
    preferences,
  })

  if (!hasTallyApi) {
    logTallyDebug('warn', requestId, 'Tally XML API base URL is not configured.')
    throw new Error('Tally XML API is not configured. Set `VITE_API_BASE_URL` and try again.')
  }

  try {
    const token = await getAccessToken()
    const form = new FormData()

    form.append('file', file, file.name)
    form.append('client_id', selectedClient.id)
    form.append('client_name', selectedClient.name)
    form.append('include_masters', String(Boolean(preferences?.includeMasters)))
    form.append('auto_create', String(Boolean(preferences?.autoCreate)))
    form.append('validate_gstin', String(Boolean(preferences?.validateGstin)))

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

    logTallyDebug('info', requestId, 'Tally conversion response received.', {
      bodyPreview: responseText ? responseText.slice(0, 500) : '',
      contentType,
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
    })

    if (!response.ok) {
      throw new Error(
        `Conversion failed (${response.status}). ${responseText ? responseText.slice(0, 180) : 'Check the Tally XML API connection.'}`,
      )
    }

    let data = {}

    if (responseText) {
      try {
        data = JSON.parse(responseText)
      } catch (error) {
        logTallyDebug('error', requestId, 'Tally conversion response was not valid JSON.', {
          bodyPreview: responseText.slice(0, 500),
          contentType,
          parseError: error?.message || '',
        })

        throw new Error(
          `Tally API returned a non-JSON success response. ${responseText ? responseText.slice(0, 180) : ''}`.trim(),
        )
      }
    }

    const result = {
      clientName: selectedClient.name,
      downloadHref: buildDownloadHref(data?.download_url),
      downloadUrl: data?.download_url || '',
      fileId: data?.file_id || '',
      fileName: file.name,
      message: 'Tally XML generated successfully. Review the output and download the XML file if available.',
      preferences,
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

    return result
  } catch (error) {
    logTallyDebug('error', requestId, 'Tally conversion request failed.', {
      message: error?.message || 'Unknown error',
      stack: error?.stack || '',
    })

    if (error instanceof TypeError && /fetch/i.test(error.message || '')) {
      throw new Error(
        import.meta.env.DEV
          ? 'Network/CORS error reaching the Tally API. The app now expects the Vite dev proxy, so restart `npm run dev` and try again.'
          : 'Network/CORS error reaching the Tally API. Check backend CORS settings or route the request through a same-origin proxy.',
      )
    }

    throw error
  }
}
