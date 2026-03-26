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

const credentialsEndpoint = buildRemoteApiHref('/api/password-manager/credentials')

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

function normalizeComparable(value) {
  return normalizeText(value).toLowerCase()
}

function getCustomSectionSlot(sectionId) {
  const match = /^custom-slot-(\d+)$/.exec(normalizeText(sectionId))
  const slot = Number(match?.[1] || '')

  return Number.isInteger(slot) && slot >= 1 && slot <= MAX_CUSTOM_SECTIONS ? slot : 0
}

function buildCustomSectionId(slot) {
  return `custom-slot-${slot}`
}

function mapUiOptionalSectionToApi(value) {
  if (value === 'einvoice') {
    return 'einv'
  }

  return value
}

function mapApiOptionalSectionToUi(value) {
  if (value === 'einv') {
    return 'einvoice'
  }

  return value
}

function parseApiError(payload, fallbackMessage) {
  if (!payload) {
    return fallbackMessage
  }

  if (typeof payload === 'string' && payload.trim()) {
    return payload
  }

  if (typeof payload === 'object') {
    if (typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error
    }

    if (typeof payload.detail === 'string' && payload.detail.trim()) {
      return payload.detail
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

function ensureConfiguredEndpoint() {
  if (!credentialsEndpoint) {
    throw new Error(
      'Password Manager API is not configured. Set `VITE_API_BASE_URL` and try again.',
    )
  }
}

function buildClientLookupQuery(selectedClient) {
  return (
    normalizeText(selectedClient?.gst) ||
    normalizeText(selectedClient?.pan) ||
    normalizeText(selectedClient?.email) ||
    normalizeText(selectedClient?.name)
  )
}

function scoreCredentialMatch(row, selectedClient) {
  let score = 0

  if (
    normalizeComparable(selectedClient?.gst) &&
    normalizeComparable(row?.gst_number) === normalizeComparable(selectedClient?.gst)
  ) {
    score += 8
  }

  if (
    normalizeComparable(selectedClient?.pan) &&
    normalizeComparable(row?.pan_number) === normalizeComparable(selectedClient?.pan)
  ) {
    score += 4
  }

  if (
    normalizeComparable(selectedClient?.email) &&
    normalizeComparable(row?.email_id) === normalizeComparable(selectedClient?.email)
  ) {
    score += 2
  }

  if (
    normalizeComparable(selectedClient?.name) &&
    normalizeComparable(row?.client_name) === normalizeComparable(selectedClient?.name)
  ) {
    score += 1
  }

  return score
}

function findMatchingCredential(items, selectedClient) {
  let bestMatch = null
  let bestScore = 0

  items.forEach((item) => {
    const score = scoreCredentialMatch(item, selectedClient)

    if (score > bestScore) {
      bestMatch = item
      bestScore = score
    }
  })

  return bestScore > 0 ? bestMatch : null
}

function parseActiveOptionalSections(row) {
  const rawValue = normalizeText(row?.active_optional_sections)

  if (rawValue) {
    try {
      const parsedValue = JSON.parse(rawValue)

      if (Array.isArray(parsedValue)) {
        return parsedValue.map((item) => normalizeText(item)).filter(Boolean)
      }
    } catch (error) {
      // Fall through to inferred optional sections.
    }
  }

  const inferredSections = []

  if (normalizeText(row?.eway_login_id) || normalizeText(row?.eway_password)) {
    inferredSections.push('eway')
  }

  if (normalizeText(row?.einv_login_id) || normalizeText(row?.einv_password)) {
    inferredSections.push('einv')
  }

  if (
    normalizeText(row?.epf_code) ||
    normalizeText(row?.epf_login_id) ||
    normalizeText(row?.epf_password)
  ) {
    inferredSections.push('epf')
  }

  for (let slot = 1; slot <= MAX_CUSTOM_SECTIONS; slot += 1) {
    const hasCustomValue = Boolean(
      normalizeText(row?.[`custom_${slot}_label`]) ||
      normalizeText(row?.[`custom_${slot}_username`]) ||
      normalizeText(row?.[`custom_${slot}_notes`]) ||
      normalizeText(row?.[`custom_${slot}_password`]) ||
      (slot === 1 && normalizeText(row?.custom_label)) ||
      (slot === 1 && normalizeText(row?.custom_username)) ||
      (slot === 1 && normalizeText(row?.custom_notes)) ||
      (slot === 1 && normalizeText(row?.custom_password)),
    )

    if (hasCustomValue) {
      inferredSections.push(`custom_${slot}`)
    }
  }

  return inferredSections
}

function mapCredentialRowToVault(row, selectedClient) {
  const activeOptionalSections = parseActiveOptionalSections(row)
  const customSections = []

  for (let slot = 1; slot <= MAX_CUSTOM_SECTIONS; slot += 1) {
    const label = normalizeText(row?.[`custom_${slot}_label`] || (slot === 1 ? row?.custom_label : ''))
    const username = normalizeText(
      row?.[`custom_${slot}_username`] || (slot === 1 ? row?.custom_username : ''),
    )
    const notes = normalizeText(row?.[`custom_${slot}_notes`] || (slot === 1 ? row?.custom_notes : ''))
    const hasSection = Boolean(
      activeOptionalSections.includes(`custom_${slot}`) ||
      label ||
      username ||
      notes ||
      normalizeText(row?.[`custom_${slot}_password`]) ||
      (slot === 1 && normalizeText(row?.custom_password)),
    )

    if (!hasSection) {
      continue
    }

    customSections.push({
      id: buildCustomSectionId(slot),
      label: label || `Custom ${slot}`,
      username,
      website: notes,
    })
  }

  return {
    clientId: String(selectedClient?.id || ''),
    createdAt: row?.created_at || '',
    customSections,
    einvoice: {
      enabled: activeOptionalSections.includes('einv') || Boolean(normalizeText(row?.einv_login_id)),
      loginId: normalizeText(row?.einv_login_id),
    },
    epf: {
      code: normalizeText(row?.epf_code),
      enabled:
        activeOptionalSections.includes('epf') ||
        Boolean(normalizeText(row?.epf_code) || normalizeText(row?.epf_login_id)),
      loginId: normalizeText(row?.epf_login_id),
    },
    eway: {
      enabled: activeOptionalSections.includes('eway') || Boolean(normalizeText(row?.eway_login_id)),
      loginId: normalizeText(row?.eway_login_id),
    },
    gst: {
      loginId: normalizeText(row?.gst_login_id),
      website: GST_PORTAL_WEBSITE,
    },
    id: String(row?.id || ''),
    it: {
      loginId: normalizeText(row?.it_login_id),
      website: INCOME_TAX_WEBSITE,
    },
    sectionOrder: activeOptionalSections
      .map((value) => {
        if (value.startsWith('custom_')) {
          const slot = Number(value.split('_')[1] || '')

          return Number.isInteger(slot) && slot >= 1 && slot <= MAX_CUSTOM_SECTIONS
            ? `custom:${buildCustomSectionId(slot)}`
            : ''
        }

        return mapApiOptionalSectionToUi(value)
      })
      .filter(Boolean),
    updatedAt: row?.updated_at || '',
  }
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

function buildActiveOptionalSectionsForApi(payload, customSlotMap) {
  const normalizedSectionOrder = buildSectionOrder(
    payload?.sectionOrder || [],
    payload?.customSections || [],
    payload || {},
  )

  return normalizedSectionOrder
    .map((value) => {
      if (value.startsWith('custom:')) {
        const customSectionId = value.slice('custom:'.length)
        const slot = customSlotMap.get(customSectionId) || 0

        return slot ? `custom_${slot}` : ''
      }

      return mapUiOptionalSectionToApi(value)
    })
    .filter(Boolean)
}

function buildPasswordFieldPayload(key, password) {
  if (password === undefined) {
    return {}
  }

  return { [key]: password }
}

function assignOptionalTextField(target, key, value) {
  const normalizedValue = normalizeText(value)

  if (normalizedValue) {
    target[key] = normalizedValue
  }
}

function buildCredentialPayload(payload, selectedClient, { isUpdate = false } = {}) {
  const customAssignments = assignCustomSectionSlots(payload?.customSections || [])
  const customSlotMap = new Map(
    customAssignments.map(({ section, slot }) => [section?.id, slot]).filter(([, slot]) => slot),
  )
  const apiPayload = {
    active_optional_sections: JSON.stringify(buildActiveOptionalSectionsForApi(payload, customSlotMap)),
    client_name: normalizeText(selectedClient?.name),
    email_id: normalizeText(selectedClient?.email).toLowerCase(),
    gst_number: normalizeText(selectedClient?.gst).toUpperCase(),
    pan_number: normalizeText(selectedClient?.pan).toUpperCase(),
    phone_number: normalizeText(selectedClient?.phone),
  }

  assignOptionalTextField(apiPayload, 'it_login_id', payload?.it?.loginId)
  assignOptionalTextField(apiPayload, 'gst_login_id', payload?.gst?.loginId)

  if (payload?.eway?.enabled) {
    assignOptionalTextField(apiPayload, 'eway_login_id', payload?.eway?.loginId)
  }

  if (payload?.einvoice?.enabled) {
    assignOptionalTextField(apiPayload, 'einv_login_id', payload?.einvoice?.loginId)
  }

  if (payload?.epf?.enabled) {
    assignOptionalTextField(apiPayload, 'epf_code', payload?.epf?.code)
    assignOptionalTextField(apiPayload, 'epf_login_id', payload?.epf?.loginId)
  }

  assignOptionalTextField(apiPayload, 'father_name', payload?.fatherName)

  customAssignments.forEach(({ section, slot }) => {
    if (!slot) {
      return
    }

    assignOptionalTextField(apiPayload, `custom_${slot}_label`, section?.label)
    assignOptionalTextField(apiPayload, `custom_${slot}_notes`, section?.website || section?.notes)
    assignOptionalTextField(apiPayload, `custom_${slot}_username`, section?.username)

    Object.assign(
      apiPayload,
      buildPasswordFieldPayload(`custom_${slot}_password`, section?.password, { isUpdate }),
    )

    if (slot === 1) {
      assignOptionalTextField(apiPayload, 'custom_label', section?.label)
      assignOptionalTextField(apiPayload, 'custom_notes', section?.website || section?.notes)
      assignOptionalTextField(apiPayload, 'custom_username', section?.username)

      if (section?.password !== undefined) {
        apiPayload.custom_password = section.password
      }
    }
  })

  if (isUpdate) {
    for (let slot = 1; slot <= MAX_CUSTOM_SECTIONS; slot += 1) {
      const slotInUse = customAssignments.some((assignment) => assignment.slot === slot)

      if (!slotInUse) {
        apiPayload[`custom_${slot}_label`] = ''
        apiPayload[`custom_${slot}_notes`] = ''
        apiPayload[`custom_${slot}_username`] = ''
        apiPayload[`custom_${slot}_password`] = ''

        if (slot === 1) {
          apiPayload.custom_label = ''
          apiPayload.custom_notes = ''
          apiPayload.custom_username = ''
          apiPayload.custom_password = ''
        }
      }
    }
  }

  Object.assign(apiPayload, buildPasswordFieldPayload('it_password', payload?.it?.password))
  Object.assign(apiPayload, buildPasswordFieldPayload('gst_password', payload?.gst?.password))

  if (payload?.eway?.enabled) {
    Object.assign(apiPayload, buildPasswordFieldPayload('eway_password', payload?.eway?.password))
  } else if (isUpdate) {
    apiPayload.eway_password = ''
  }

  if (payload?.einvoice?.enabled) {
    Object.assign(apiPayload, buildPasswordFieldPayload('einv_password', payload?.einvoice?.password))
  } else if (isUpdate) {
    apiPayload.einv_password = ''
  }

  if (payload?.epf?.enabled) {
    Object.assign(apiPayload, buildPasswordFieldPayload('epf_password', payload?.epf?.password))
  } else if (isUpdate) {
    apiPayload.epf_password = ''
  }

  return apiPayload
}

async function fetchMatchingCredentialRow(selectedClient, currentUser) {
  ensureConfiguredEndpoint()

  if (!selectedClient) {
    throw new Error('Select a client before loading the password vault.')
  }

  const token = await getAccessToken()
  const params = new URLSearchParams({
    page: '1',
    page_size: '25',
  })
  const query = buildClientLookupQuery(selectedClient)

  if (query) {
    params.set('q', query)
  }

  const response = await fetch(`${credentialsEndpoint}?${params.toString()}`, {
    headers: buildPasswordManagerHeaders(currentUser, { token }),
  })

  if (response.status === 404) {
    return null
  }

  const data = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error(parseApiError(data, 'Unable to load the password vault.'))
  }

  const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []

  return findMatchingCredential(items, selectedClient)
}

function buildRevealFieldCandidates(field, customSectionId) {
  if (field === 'custom') {
    const slot = getCustomSectionSlot(customSectionId)

    if (!slot) {
      return ['custom_password']
    }

    return [`custom_${slot}_password`, 'custom_password']
  }

  if (field === 'it') {
    return ['it_password']
  }

  if (field === 'gst') {
    return ['gst_password']
  }

  if (field === 'eway') {
    return ['eway_password']
  }

  if (field === 'einvoice') {
    return ['einv_password']
  }

  if (field === 'epf') {
    return ['epf_password']
  }

  return [field]
}

/**
 * Fetches the password vault for the selected client from the deployed credential API.
 *
 * @param {string} clientId - Selected client id.
 * @param {object} currentUser - Signed-in user metadata.
 * @param {object | null} selectedClient - Selected client record from CRM.
 * @returns {Promise<object | null>} Serialized password vault or null when none exists.
 */
export async function fetchPasswordVault(clientId, currentUser, selectedClient = null) {
  const targetClient = selectedClient && String(selectedClient.id) === String(clientId) ? selectedClient : null
  const matchedRow = await fetchMatchingCredentialRow(targetClient, currentUser)
  const nextVault = matchedRow ? mapCredentialRowToVault(matchedRow, targetClient) : null

  writeCachedPasswordVault(clientId, nextVault)

  return nextVault
}

/**
 * Creates a password vault for the selected client in the deployed credential API.
 *
 * @param {string} clientId - Selected client id.
 * @param {object} payload - Vault payload to persist.
 * @param {object} currentUser - Signed-in user metadata.
 * @param {object | null} selectedClient - Selected client record from CRM.
 * @returns {Promise<object | null>} Serialized password vault response.
 */
export async function createPasswordVault(clientId, payload, currentUser, selectedClient = null) {
  ensureConfiguredEndpoint()

  const targetClient = selectedClient && String(selectedClient.id) === String(clientId) ? selectedClient : null

  if (!targetClient) {
    throw new Error('Select a client before creating the password vault.')
  }

  const token = await getAccessToken()
  const response = await fetch(credentialsEndpoint, {
    body: JSON.stringify(buildCredentialPayload(payload, targetClient)),
    headers: buildPasswordManagerHeaders(currentUser, {
      includeJsonContentType: true,
      token,
    }),
    method: 'POST',
  })
  const data = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error(parseApiError(data, 'Unable to create the password vault.'))
  }

  const nextVault = await fetchPasswordVault(clientId, currentUser, targetClient)

  writeCachedPasswordVault(clientId, nextVault)

  return nextVault
}

/**
 * Updates an existing password vault in the deployed credential API.
 *
 * @param {string} vaultId - Target vault id.
 * @param {object} payload - Vault payload to persist.
 * @param {object} currentUser - Signed-in user metadata.
 * @param {object | null} selectedClient - Selected client record from CRM.
 * @returns {Promise<object | null>} Serialized password vault response.
 */
export async function updatePasswordVault(vaultId, payload, currentUser, selectedClient = null) {
  ensureConfiguredEndpoint()

  if (!selectedClient) {
    throw new Error('Select a client before updating the password vault.')
  }

  const token = await getAccessToken()
  const response = await fetch(`${credentialsEndpoint}/${encodeURIComponent(vaultId)}`, {
    body: JSON.stringify(buildCredentialPayload(payload, selectedClient, { isUpdate: true })),
    headers: buildPasswordManagerHeaders(currentUser, {
      includeJsonContentType: true,
      token,
    }),
    method: 'PUT',
  })
  const data = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error(parseApiError(data, 'Unable to update the password vault.'))
  }

  const nextVault = await fetchPasswordVault(selectedClient.id, currentUser, selectedClient)

  writeCachedPasswordVault(selectedClient.id, nextVault)

  return nextVault
}

/**
 * Deletes an existing password vault from the deployed credential API.
 *
 * @param {string} vaultId - Target vault id.
 * @param {string} clientId - Selected client id.
 * @param {object} currentUser - Signed-in user metadata.
 * @returns {Promise<void>} Resolves when the vault has been deleted.
 */
export async function deletePasswordVault(vaultId, clientId, currentUser) {
  ensureConfiguredEndpoint()

  const token = await getAccessToken()
  const response = await fetch(`${credentialsEndpoint}/${encodeURIComponent(vaultId)}`, {
    headers: buildPasswordManagerHeaders(currentUser, { token }),
    method: 'DELETE',
  })
  const data = await parseJsonResponse(response)

  if (!response.ok) {
    throw new Error(parseApiError(data, 'Unable to delete the password vault.'))
  }

  writeCachedPasswordVault(clientId, null)
}

/**
 * Reveals one stored password from the deployed credential API.
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
  ensureConfiguredEndpoint()

  const token = await getAccessToken()
  const fieldCandidates = buildRevealFieldCandidates(field, customSectionId)
  let lastError = ''

  for (const candidateField of fieldCandidates) {
    const response = await fetch(
      `${credentialsEndpoint}/${encodeURIComponent(vaultId)}/reveal?field=${encodeURIComponent(candidateField)}`,
      {
        headers: buildPasswordManagerHeaders(currentUser, { token }),
        method: 'POST',
      },
    )
    const data = await parseJsonResponse(response)

    if (response.ok) {
      const plaintextPassword = String(data?.plaintext_password || data?.plaintextPassword || '')

      if (!plaintextPassword) {
        throw new Error('Password reveal response was empty.')
      }

      return plaintextPassword
    }

    lastError = parseApiError(data, 'Unable to reveal the requested password.')
  }

  throw new Error(lastError || 'Unable to reveal the requested password.')
}
