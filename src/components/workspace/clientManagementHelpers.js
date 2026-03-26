export const CLIENT_CARD_PAGE_SIZE = 16
export const CLIENT_CARD_SUMMARY_FALLBACK = 'Trade name and location not available'

export const CLIENT_AVATAR_COLOR_PALETTE = Object.freeze([
  Object.freeze({ background: '#4f46e5', foreground: '#ffffff' }),
  Object.freeze({ background: '#7c3aed', foreground: '#ffffff' }),
  Object.freeze({ background: '#ec4899', foreground: '#ffffff' }),
  Object.freeze({ background: '#f59e0b', foreground: '#ffffff' }),
  Object.freeze({ background: '#10b981', foreground: '#ffffff' }),
  Object.freeze({ background: '#06b6d4', foreground: '#ffffff' }),
  Object.freeze({ background: '#dc2626', foreground: '#ffffff' }),
  Object.freeze({ background: '#2563eb', foreground: '#ffffff' }),
])

const CLIENT_SEARCH_FIELDS = Object.freeze([
  'name',
  'tradeName',
  'gst',
  'pan',
  'email',
  'phone',
  'address',
  'addressLine',
  'city',
  'state',
  'pincode',
])

const CLIENT_BADGE_PREFIX = '#'
const CLIENT_BADGE_MIN_DIGITS = 2
const CLIENT_DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function clampValue(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum)
}

function hashString(value) {
  return Array.from(String(value || '')).reduce((hash, character) => {
    return hash + character.charCodeAt(0)
  }, 0)
}

/**
 * Builds a lowercase search index string for a client record.
 *
 * @param {object} client - The serialized client record.
 * @returns {string} The combined searchable text used by the client filters.
 */
export function buildClientSearchIndex(client = {}) {
  return CLIENT_SEARCH_FIELDS.map((fieldName) => String(client[fieldName] || '').trim())
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

/**
 * Filters serialized client records using the shared search index rules.
 *
 * @param {Array<object>} clients - The available client records.
 * @param {string} query - The raw search query entered by the user.
 * @returns {Array<object>} The filtered client records matching the query.
 */
export function filterClientsByQuery(clients = [], query = '') {
  const normalizedQuery = String(query || '').trim().toLowerCase()

  if (!normalizedQuery) {
    return Array.isArray(clients) ? clients : []
  }

  return (Array.isArray(clients) ? clients : []).filter((client) =>
    buildClientSearchIndex(client).includes(normalizedQuery),
  )
}

/**
 * Derives display initials for a client avatar.
 *
 * @param {string} name - The client display name.
 * @returns {string} One or two initials for the card avatar.
 */
export function getClientInitials(name = '') {
  const initials = String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  return initials || 'CL'
}

/**
 * Resolves a deterministic avatar color tone for a client.
 *
 * @param {string} key - A stable identifier such as the client id or name.
 * @returns {{ background: string, foreground: string }} The avatar color tokens.
 */
export function getClientAvatarTone(key = '') {
  const paletteIndex = hashString(key) % CLIENT_AVATAR_COLOR_PALETTE.length

  return CLIENT_AVATAR_COLOR_PALETTE[paletteIndex] || CLIENT_AVATAR_COLOR_PALETTE[0]
}

/**
 * Formats a persisted client timestamp for display.
 *
 * @param {string|Date} dateValue - The persisted client timestamp.
 * @returns {string} A formatted date label, or `-` when unavailable.
 */
export function formatClientDate(dateValue) {
  if (!dateValue) {
    return '-'
  }

  const normalizedDate = new Date(dateValue)

  if (Number.isNaN(normalizedDate.getTime())) {
    return '-'
  }

  return CLIENT_DATE_FORMATTER.format(normalizedDate)
}

/**
 * Formats the compact identity summary shown beneath each client name.
 *
 * @param {object} client - The serialized client record.
 * @returns {string} A comma-separated summary of trade name, city, and pincode.
 */
export function formatClientCardSummary(client = {}) {
  const summaryParts = [client.tradeName, client.city, client.pincode]
    .map((value) => String(value || '').trim())
    .filter(Boolean)

  return summaryParts.join(', ') || CLIENT_CARD_SUMMARY_FALLBACK
}

/**
 * Formats the count badge shown in the client toolbar.
 *
 * @param {number} count - The number of client records in the workspace.
 * @returns {string} The zero-padded badge label.
 */
export function formatClientCountBadge(count) {
  const normalizedCount = Math.max(0, Number(count) || 0)

  return `${CLIENT_BADGE_PREFIX}${String(normalizedCount).padStart(CLIENT_BADGE_MIN_DIGITS, '0')}`
}

/**
 * Calculates the active client-card pagination window.
 *
 * @param {Array<object>} clients - The filtered client records.
 * @param {number} currentPage - The requested page number.
 * @param {number} [pageSize=CLIENT_CARD_PAGE_SIZE] - The number of cards per page.
 * @returns {object} The safe pagination state and the visible page items.
 */
export function paginateClients(clients = [], currentPage = 1, pageSize = CLIENT_CARD_PAGE_SIZE) {
  const normalizedClients = Array.isArray(clients) ? clients : []
  const safePageSize = Math.max(1, Number(pageSize) || CLIENT_CARD_PAGE_SIZE)
  const totalItems = normalizedClients.length
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize))
  const safeCurrentPage = clampValue(Number(currentPage) || 1, 1, totalPages)
  const startIndex = totalItems === 0 ? 0 : (safeCurrentPage - 1) * safePageSize
  const endIndex = totalItems === 0 ? 0 : Math.min(startIndex + safePageSize, totalItems)

  return {
    currentPage: safeCurrentPage,
    endItemNumber: endIndex,
    pageItems: normalizedClients.slice(startIndex, endIndex),
    startIndex,
    startItemNumber: totalItems === 0 ? 0 : startIndex + 1,
    totalItems,
    totalPages,
  }
}
