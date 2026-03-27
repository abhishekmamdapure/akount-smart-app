import { supabase } from '../../../../supabase'
import { buildWorkspaceUserHeaders } from '../shared/toolClientState'
import {
  GST_PORTAL_WEBSITE,
  INCOME_TAX_WEBSITE,
  MAX_CUSTOM_SECTIONS,
} from './passwordManagerConstants'
import { buildSectionOrder } from './passwordManagerHelpers'

const apiBaseUrl = String(
  import.meta.env.VITE_API_BASE_URL || '',
).trim().replace(/\/$/, '')
const devProxyBaseUrl = '/password-manager-proxy'
const passwordVaultCache = new Map()

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

  return `${apiBaseUrl}${normalizedPath}`
}

const passwordVaultEndpoint = buildRemoteApiHref('/api/password-manager')
const passwordRevealEndpoint = buildRemoteApiHref('/api/password-manager/reveal')

function getVaultCacheKey(clientId) {
  return String(clientId || '').trim()
}

function writeCachedPasswordVault(clientId, vault) {
  const cacheKey = getVaultCacheKey(clientId)

  if (!cacheKey) {
    return
  }

  passwordVaultCache.set(cacheKey, {
    timestamp: Date.now(),
    vault: vault ?? null,
  })
}

/**
 * Reads the cached password vault for a selected client when available.
 *
 * @param {string} clientId - Selected client id.
 * @returns {{hasValue: boolean, vault: object | null}} Cached vault state.
 */
export function getCachedPasswordVault(clientId) {
  const cacheKey = getVaultCacheKey(clientId)

  if (!cacheKey || !passwordVaultCache.has(cacheKey)) {
    return {
      hasValue: false,
      vault: null,
    }
  }

  return {
    hasValue: true,
    vault: passwordVaultCache.get(cacheKey)?.vault ?? null,
  }
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

function getApiErrorCode(payload) {
  if (!payload || typeof payload !== 'object') {
    return ''
  }

  if (typeof payload.code === 'string' && payload.code.trim()) {
    return payload.code
  }

  if (payload.detail && typeof payload.detail === 'object' && typeof payload.detail.code === 'string') {
    return payload.detail.code.trim()
  }

  return ''
}

function parseApiError(payload, fallbackMessage) {
  if (!payload) {
    return fallbackMessage
  }

  if (typeof payload === 'string' && payload.trim()) {
    return payload
  }

  if (typeof payload === 'object') {
    if (typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message
    }

    if (typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error
    }

    if (typeof payload.detail === 'string' && payload.detail.trim()) {
      return payload.detail
    }

    if (payload.detail && typeof payload.detail === 'object') {
      if (typeof payload.detail.message === 'string' && payload.detail.message.trim()) {
        return payload.detail.message
      }

      if (typeof payload.detail.error === 'string' && payload.detail.error.trim()) {
        return payload.detail.error
      }
    }

    if (Array.isArray(payload.detail) && typeof payload.detail[0]?.msg === 'string') {
      const fieldPath = Array.isArray(payload.detail[0]?.loc)
        ? payload.detail[0].loc.filter((value) => typeof value === 'string' || typeof value === 'number').join('.')
        : ''

      return fieldPath ? `${fieldPath}: ${payload.detail[0].msg}` : payload.detail[0].msg
    }
  }

  return fallbackMessage
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

function buildPasswordManagerHeaders(currentUser, { includeJsonContentType = false, token = '' } = {}) {
  const headers = {
    accept: 'application/json',
    ...buildWorkspaceUserHeaders(currentUser, includeJsonContentType),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

function ensureConfiguredEndpoint(endpoint, label) {
  if (!endpoint) {
    throw new Error(
      `Password Manager ${label} endpoint is not configured. Set \`VITE_API_BASE_URL\` and try again.`,
    )
  }
}

function normalizeVaultSection(section = {}, { fallbackWebsite = '' } = {}) {
  return {
    ...section,
    enabled: Boolean(section?.enabled),
    hasPassword: Boolean(section?.hasPassword),
    loginId: normalizeText(section?.loginId),
    website: normalizeText(section?.website) || fallbackWebsite,
  }
}

function normalizeComparable(value) {
  return normalizeText(value).toLowerCase()
}

function getCustomSectionSlot(sectionId) {
  const normalizedId = normalizeText(sectionId)
  const patterns = [
    /^slot-(\d+)$/i,
    /^custom:slot-(\d+)$/i,
    /^custom-slot-(\d+)$/i,
    /^custom-(\d+)$/i,
  ]

  for (const pattern of patterns) {
    const match = pattern.exec(normalizedId)
    const slot = Number(match?.[1] || '')

    if (Number.isInteger(slot) && slot >= 1 && slot <= MAX_CUSTOM_SECTIONS) {
      return slot
    }
  }

  return 0
}

function assignCustomSectionSlots(customSections = []) {
  const usedSlots = new Set()
  const pendingAssignments = customSections.map((section) => {
    const slot = getCustomSectionSlot(section?.id)

    if (slot && !usedSlots.has(slot)) {
      usedSlots.add(slot)
      return { section, slot }
    }

    return { section, slot: 0 }
  })

  let nextSlot = 1

  return pendingAssignments.map((assignment) => {
    if (assignment.slot) {
      return assignment
    }

    while (usedSlots.has(nextSlot) && nextSlot <= MAX_CUSTOM_SECTIONS) {
      nextSlot += 1
    }

    if (nextSlot > MAX_CUSTOM_SECTIONS) {
      return assignment
    }

    usedSlots.add(nextSlot)

    return {
      ...assignment,
      slot: nextSlot,
    }
  })
}

function mapUiOptionalSectionToApi(value) {
  if (value === 'einvoice') {
    return 'einv'
  }

  return value
}

function buildActiveOptionalSectionsForApi(payload, customAssignments) {
  const customSlotMap = new Map(
    customAssignments.map(({ section, slot }) => [section?.id, slot]).filter(([, slot]) => slot),
  )
  const normalizedSectionOrder = buildSectionOrder(
    payload?.sectionOrder || [],
    payload?.customSections || [],
    payload || {},
  )

  return normalizedSectionOrder
    .map((value) => {
      const normalizedValue = normalizeText(value)

      if (!normalizedValue) {
        return ''
      }

      if (normalizedValue.startsWith('custom:')) {
        const customSectionId = normalizedValue.slice('custom:'.length)
        const slot = customSlotMap.get(customSectionId) || getCustomSectionSlot(customSectionId)

        return slot ? `custom_${slot}` : ''
      }

      return mapUiOptionalSectionToApi(normalizedValue)
    })
    .filter(Boolean)
}

function buildPasswordManagerPayload(payload, selectedClient, { vaultId = '' } = {}) {
  const customAssignments = assignCustomSectionSlots(payload?.customSections || [])
  const requestPayload = {
    active_optional_sections: buildActiveOptionalSectionsForApi(payload, customAssignments),
    client_id: normalizeText(payload?.clientId || selectedClient?.id),
    client_name: normalizeText(selectedClient?.name),
    email_id: normalizeText(selectedClient?.email).toLowerCase(),
    father_name: normalizeText(payload?.fatherName),
    gst_login_id: normalizeText(payload?.gst?.loginId),
    gst_number: normalizeText(selectedClient?.gst).toUpperCase(),
    pan_number: normalizeText(selectedClient?.pan).toUpperCase(),
    phone_number: normalizeText(selectedClient?.phone),
    it_login_id: normalizeText(payload?.it?.loginId),
  }

  if (vaultId) {
    requestPayload.vault_id = normalizeText(vaultId)
  }

  if (payload?.it?.password) {
    requestPayload.it_password = payload.it.password
  }

  if (payload?.gst?.password) {
    requestPayload.gst_password = payload.gst.password
  }

  if (payload?.eway?.enabled) {
    requestPayload.eway_login_id = normalizeText(payload?.eway?.loginId)

    if (payload?.eway?.password) {
      requestPayload.eway_password = payload.eway.password
    }
  }

  const einvoiceSection = payload?.einvoice || payload?.einv

  if (einvoiceSection?.enabled) {
    requestPayload.einv_login_id = normalizeText(einvoiceSection?.loginId)

    if (einvoiceSection?.password) {
      requestPayload.einv_password = einvoiceSection.password
    }
  }

  if (payload?.epf?.enabled) {
    requestPayload.epf_code = normalizeText(payload?.epf?.code)
    requestPayload.epf_login_id = normalizeText(payload?.epf?.loginId)

    if (payload?.epf?.password) {
      requestPayload.epf_password = payload.epf.password
    }
  }

  customAssignments.forEach(({ section, slot }) => {
    if (!slot) {
      return
    }

    const label = normalizeText(section?.label)
    const username = normalizeText(section?.username)
    const notes = normalizeText(section?.website || section?.notes)

    requestPayload[`custom_${slot}_label`] = label
    requestPayload[`custom_${slot}_username`] = username
    requestPayload[`custom_${slot}_notes`] = notes

    if (section?.password) {
      requestPayload[`custom_${slot}_password`] = section.password
    }

    if (slot === 1) {
      requestPayload.custom_label = label
      requestPayload.custom_username = username
      requestPayload.custom_notes = notes

      if (section?.password) {
        requestPayload.custom_password = section.password
      }
    }
  })

  return requestPayload
}

function buildRevealField(field, customSectionId) {
  if (field === 'it') {
    return 'it_password'
  }

  if (field === 'gst') {
    return 'gst_password'
  }

  if (field === 'eway') {
    return 'eway_password'
  }

  if (field === 'einvoice' || field === 'einv') {
    return 'einv_password'
  }

  if (field === 'epf') {
    return 'epf_password'
  }

  if (field === 'custom') {
    const slot = getCustomSectionSlot(customSectionId)

    return slot > 1 ? `custom_${slot}_password` : 'custom_password'
  }

  return normalizeText(field)
}

function extractVaultFromResponse(payload) {
  if (payload?.vault === null || payload?.data?.vault === null) {
    return null
  }

  if (payload?.vault && typeof payload.vault === 'object') {
    return payload.vault
  }

  if (payload?.data?.vault && typeof payload.data.vault === 'object') {
    return payload.data.vault
  }

  if (payload?.item && typeof payload.item === 'object') {
    return payload.item
  }

  if (payload && typeof payload === 'object' && (payload.id || payload.clientId || payload.customSections)) {
    return payload
  }

  return null
}

function normalizeVaultForUi(payload, selectedClient = null) {
  const vault = extractVaultFromResponse(payload)

  if (!vault) {
    return null
  }

  const normalizedClient = vault?.client && typeof vault.client === 'object' ? vault.client : {}

  const customSections = Array.isArray(vault.customSections)
    ? vault.customSections
      .map((section, index) => {
        const slot = Number(section?.slot || getCustomSectionSlot(section?.id) || index + 1)
        const id = normalizeText(section?.id) || `slot-${slot}`
        const website = normalizeText(section?.website || section?.notes)

        return {
          hasPassword: Boolean(section?.hasPassword),
          id,
          label: normalizeText(section?.label) || `Custom ${index + 1}`,
          notes: website,
          username: normalizeText(section?.username),
          website,
        }
      })
      .filter((section) => section.id)
    : []

  return {
    ...vault,
    clientId: String(vault?.clientId || selectedClient?.id || ''),
    createdAt: vault?.createdAt || '',
    customSections,
    einvoice: normalizeVaultSection(vault?.einvoice || vault?.einv),
    epf: {
      ...normalizeVaultSection(vault?.epf),
      code: normalizeText(vault?.epf?.code),
    },
    eway: normalizeVaultSection(vault?.eway),
    fatherName: normalizeText(vault?.fatherName || normalizedClient?.fatherName),
    gst: normalizeVaultSection(vault?.gst, { fallbackWebsite: GST_PORTAL_WEBSITE }),
    id: String(vault?.id || ''),
    it: normalizeVaultSection(vault?.it, { fallbackWebsite: INCOME_TAX_WEBSITE }),
    sectionOrder: buildSectionOrder(vault?.sectionOrder || [], customSections, {
      customSections,
      einvoice: Boolean(vault?.einvoice?.enabled),
      epf: Boolean(vault?.epf?.enabled),
      eway: Boolean(vault?.eway?.enabled),
    }),
    updatedAt: vault?.updatedAt || '',
  }
}

async function fetchVaultRequest(
  pathname,
  currentUser,
  {
    allowCredentialNotFound = false,
    body,
    method = 'GET',
  } = {},
) {
  const token = await getAccessToken()
  const response = await fetch(pathname, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: buildPasswordManagerHeaders(currentUser, {
      includeJsonContentType: body !== undefined,
      token,
    }),
    method,
  })
  const data = await parseJsonResponse(response)

  if (!response.ok) {
    if (
      allowCredentialNotFound &&
      response.status === 404 &&
      getApiErrorCode(data) === 'credential_not_found'
    ) {
      return null
    }

    throw new Error(parseApiError(data, 'Unable to complete the password-manager request.'))
  }

  return data
}

/**
 * Fetches the password vault for the selected client from the configured password-manager endpoint.
 *
 * @param {string} clientId - Selected client id.
 * @param {object} currentUser - Signed-in user metadata.
 * @param {object | null} selectedClient - Selected client record from CRM.
 * @returns {Promise<object | null>} Serialized password vault or null when none exists.
 */
export async function fetchPasswordVault(clientId, currentUser, selectedClient = null) {
  ensureConfiguredEndpoint(passwordVaultEndpoint, 'vault')

  const data = await fetchVaultRequest(
    `${passwordVaultEndpoint}?clientId=${encodeURIComponent(clientId)}`,
    currentUser,
    { allowCredentialNotFound: true },
  )
  const nextVault = normalizeVaultForUi(data, selectedClient)

  writeCachedPasswordVault(clientId, nextVault)

  return nextVault
}

/**
 * Creates a password vault for the selected client in the configured password-manager endpoint.
 *
 * @param {string} clientId - Selected client id.
 * @param {object} payload - Vault payload to persist.
 * @param {object} currentUser - Signed-in user metadata.
 * @param {object | null} selectedClient - Selected client record from CRM.
 * @returns {Promise<object | null>} Serialized password vault response.
 */
export async function createPasswordVault(clientId, payload, currentUser, selectedClient = null) {
  ensureConfiguredEndpoint(passwordVaultEndpoint, 'vault')

  if (!selectedClient) {
    throw new Error('Select a client before creating the password vault.')
  }

  const data = await fetchVaultRequest(passwordVaultEndpoint, currentUser, {
    body: buildPasswordManagerPayload(payload, selectedClient),
    method: 'POST',
  })
  const nextVault = normalizeVaultForUi(data, selectedClient)

  writeCachedPasswordVault(clientId, nextVault)

  return nextVault
}

/**
 * Updates an existing password vault in the configured password-manager endpoint.
 *
 * @param {string} vaultId - Target vault id.
 * @param {object} payload - Vault payload to persist.
 * @param {object} currentUser - Signed-in user metadata.
 * @param {object | null} selectedClient - Selected client record from CRM.
 * @returns {Promise<object | null>} Serialized password vault response.
 */
export async function updatePasswordVault(vaultId, payload, currentUser, selectedClient = null) {
  ensureConfiguredEndpoint(passwordVaultEndpoint, 'vault')

  if (!selectedClient) {
    throw new Error('Select a client before updating the password vault.')
  }

  const data = await fetchVaultRequest(passwordVaultEndpoint, currentUser, {
    body: buildPasswordManagerPayload(payload, selectedClient, { vaultId }),
    method: 'PUT',
  })
  const nextVault = normalizeVaultForUi(data, selectedClient)

  writeCachedPasswordVault(selectedClient?.id || payload?.clientId || '', nextVault)

  return nextVault
}

/**
 * Deletes an existing password vault from the configured password-manager endpoint.
 *
 * @param {string} vaultId - Target vault id.
 * @param {string} clientId - Selected client id.
 * @param {object} currentUser - Signed-in user metadata.
 * @returns {Promise<void>} Resolves when the vault has been deleted.
 */
export async function deletePasswordVault(vaultId, clientId, currentUser) {
  ensureConfiguredEndpoint(passwordVaultEndpoint, 'vault')

  const params = new URLSearchParams({
    clientId: normalizeText(clientId),
    vaultId: normalizeText(vaultId),
  })

  await fetchVaultRequest(`${passwordVaultEndpoint}?${params.toString()}`, currentUser, {
    method: 'DELETE',
  })

  writeCachedPasswordVault(clientId, null)
}

/**
 * Reveals one stored password from the configured password-manager endpoint.
 *
 * @param {string} vaultId - Target vault id.
 * @param {string} field - Requested section key.
 * @param {string} customSectionId - Custom section id when the field is custom.
 * @param {string} clientId - Selected client id.
 * @param {object} currentUser - Signed-in user metadata.
 * @returns {Promise<string>} Plaintext password value.
 */
export async function revealPasswordField(
  vaultId,
  field,
  customSectionId,
  clientId,
  currentUser,
) {
  ensureConfiguredEndpoint(passwordRevealEndpoint, 'reveal')

  const params = new URLSearchParams({
    clientId: normalizeText(clientId),
    field: buildRevealField(field, customSectionId),
    vaultId: normalizeText(vaultId),
  })

  const data = await fetchVaultRequest(`${passwordRevealEndpoint}?${params.toString()}`, currentUser, {
    method: 'POST',
  })
  const plaintextPassword = String(
    data?.plaintextPassword ||
    data?.plaintext_password ||
    data?.password ||
    data?.data?.plaintextPassword ||
    data?.data?.plaintext_password ||
    '',
  )

  if (!plaintextPassword) {
    throw new Error('Password reveal response was empty.')
  }

  return plaintextPassword
}
