export const MAX_CUSTOM_SECTIONS = 5
export const OPTIONAL_SECTION_KEYS = ['eway', 'einvoice', 'epf']

function normalizeText(value) {
  return String(value ?? '').trim()
}

function normalizePassword(value) {
  if (value === undefined) {
    return undefined
  }

  return typeof value === 'string' ? value : String(value ?? '')
}

function normalizeFixedSection(section = {}) {
  return {
    loginId: normalizeText(section.loginId),
    password: normalizePassword(section.password),
  }
}

function normalizeOptionalSection(section = {}) {
  return {
    enabled: Boolean(section.enabled),
    loginId: normalizeText(section.loginId),
    password: normalizePassword(section.password),
  }
}

function normalizeEpfSection(section = {}) {
  return {
    code: normalizeText(section.code),
    enabled: Boolean(section.enabled),
    loginId: normalizeText(section.loginId),
    password: normalizePassword(section.password),
  }
}

/**
 * Serializes the client identity that should accompany a password vault response.
 *
 * @param {object | null} client - Owned client record.
 * @returns {object} Normalized client summary.
 */
export function serializeClientBasicInfo(client) {
  return {
    email: client?.email || '',
    gst: client?.gst || '',
    name: client?.name || '',
    pan: client?.pan || '',
    phone: client?.phone || '',
    tradeName: client?.tradeName || '',
  }
}

/**
 * Normalizes the active optional-section order for a vault.
 *
 * @param {string[]} sectionOrder - Incoming section-order payload.
 * @param {Array<object>} customSections - Sanitized custom sections.
 * @param {object} enabledSections - Enabled state for optional fixed sections.
 * @returns {string[]} Ordered optional-section keys.
 */
export function normalizeVaultSectionOrder(sectionOrder = [], customSections = [], enabledSections = {}) {
  const allowedKeys = new Set()
  const normalizedOrder = []
  const seenKeys = new Set()

  OPTIONAL_SECTION_KEYS.forEach((key) => {
    if (enabledSections[key]) {
      allowedKeys.add(key)
    }
  })

  customSections.forEach((section) => {
    allowedKeys.add(`custom:${section.id}`)
  })

  sectionOrder.forEach((value) => {
    const normalizedValue = normalizeText(value)

    if (!normalizedValue || seenKeys.has(normalizedValue) || !allowedKeys.has(normalizedValue)) {
      return
    }

    seenKeys.add(normalizedValue)
    normalizedOrder.push(normalizedValue)
  })

  OPTIONAL_SECTION_KEYS.forEach((key) => {
    if (enabledSections[key] && !seenKeys.has(key)) {
      seenKeys.add(key)
      normalizedOrder.push(key)
    }
  })

  customSections.forEach((section) => {
    const customKey = `custom:${section.id}`

    if (!seenKeys.has(customKey)) {
      seenKeys.add(customKey)
      normalizedOrder.push(customKey)
    }
  })

  return normalizedOrder
}

/**
 * Sanitizes custom-section payloads and collects validation errors.
 *
 * @param {Array<object>} customSections - Incoming custom-section array.
 * @returns {{ customSections: Array<object>, errors: string[] }} Sanitized sections and validation errors.
 */
export function sanitizeCustomSections(customSections = []) {
  const normalizedSections = []
  const errors = []
  const seenIds = new Set()

  if (!Array.isArray(customSections)) {
    return {
      customSections: [],
      errors: ['Custom sections must be sent as an array.'],
    }
  }

  customSections.slice(0, MAX_CUSTOM_SECTIONS).forEach((section, index) => {
    const id = normalizeText(section?.id)
    const label = normalizeText(section?.label)

    if (!id) {
      errors.push(`Custom section ${index + 1} is missing an id.`)
      return
    }

    if (seenIds.has(id)) {
      errors.push(`Custom section id "${id}" was sent more than once.`)
      return
    }

    if (!label) {
      errors.push(`Custom section ${index + 1} requires a label.`)
      return
    }

    seenIds.add(id)
    normalizedSections.push({
      id,
      label,
      notes: normalizeText(section?.notes),
      password: normalizePassword(section?.password),
      username: normalizeText(section?.username),
    })
  })

  if (Array.isArray(customSections) && customSections.length > MAX_CUSTOM_SECTIONS) {
    errors.push(`A maximum of ${MAX_CUSTOM_SECTIONS} custom sections is supported.`)
  }

  return {
    customSections: normalizedSections,
    errors,
  }
}

/**
 * Normalizes and validates password-vault create/update payloads.
 *
 * @param {object} payload - Incoming request payload.
 * @param {object} [options={}] - Normalization options.
 * @param {boolean} [options.requireClientId=true] - Whether client id is mandatory.
 * @returns {{ data: object, errors: string[] }} Sanitized data and validation errors.
 */
export function normalizePasswordVaultPayload(payload = {}, { requireClientId = true } = {}) {
  const { customSections, errors } = sanitizeCustomSections(payload.customSections || [])
  const eway = normalizeOptionalSection(payload.eway)
  const einvoice = normalizeOptionalSection(payload.einvoice)
  const epf = normalizeEpfSection(payload.epf)

  if (requireClientId && !normalizeText(payload.clientId)) {
    errors.push('Client id is required.')
  }

  return {
    data: {
      clientId: normalizeText(payload.clientId),
      customSections,
      einvoice,
      epf,
      eway,
      fatherName: normalizeText(payload.fatherName),
      gst: normalizeFixedSection(payload.gst),
      it: normalizeFixedSection(payload.it),
      sectionOrder: normalizeVaultSectionOrder(payload.sectionOrder, customSections, {
        einvoice: einvoice.enabled,
        epf: epf.enabled,
        eway: eway.enabled,
      }),
    },
    errors,
  }
}

/**
 * Builds the ownership query used for per-user vault lookups.
 *
 * @param {string} ownerUserId - Signed-in user id.
 * @param {string} clientId - Selected client id.
 * @param {string} [vaultId=''] - Optional vault id.
 * @returns {object} Mongoose query object.
 */
export function buildPasswordVaultQuery(ownerUserId, clientId, vaultId = '') {
  const query = {
    'owner.userId': normalizeText(ownerUserId),
    clientId: normalizeText(clientId),
  }

  if (normalizeText(vaultId)) {
    query._id = normalizeText(vaultId)
  }

  return query
}

/**
 * Resolves which stored secret should be revealed for a request.
 *
 * @param {string} field - Requested fixed or custom section key.
 * @param {string} [customSectionId=''] - Custom section id when the field is custom.
 * @returns {{ field: string, customSectionId: string, error: string }} Reveal lookup result.
 */
export function buildRevealTarget(field, customSectionId = '') {
  const normalizedField = normalizeText(field).toLowerCase()
  const normalizedCustomId = normalizeText(customSectionId)

  if (['it', 'gst', 'eway', 'einvoice', 'epf'].includes(normalizedField)) {
    return {
      customSectionId: '',
      error: '',
      field: normalizedField,
    }
  }

  if (normalizedField === 'custom') {
    if (!normalizedCustomId) {
      return {
        customSectionId: '',
        error: 'Custom section id is required when revealing a custom password.',
        field: '',
      }
    }

    return {
      customSectionId: normalizedCustomId,
      error: '',
      field: normalizedField,
    }
  }

  return {
    customSectionId: '',
    error: 'Unsupported password field.',
    field: '',
  }
}
