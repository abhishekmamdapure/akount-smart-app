import {
  FIXED_TABS,
  GST_PORTAL_WEBSITE,
  INCOME_TAX_WEBSITE,
  MAX_CUSTOM_SECTIONS,
  OPTIONAL_SECTION_KEYS,
  OPTIONAL_SECTION_META,
} from './passwordManagerConstants'

function createCustomSectionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

function normalizeSectionState(formState = {}) {
  return {
    einvoice: Boolean(formState.einvoice?.enabled),
    epf: Boolean(formState.epf?.enabled),
    eway: Boolean(formState.eway?.enabled),
  }
}

/**
 * Builds the ordered list of active optional sections.
 *
 * @param {string[]} sectionOrder - Current ordered section list.
 * @param {Array<object>} customSections - Custom section array.
 * @param {object} [sectionState={}] - Enabled state for fixed optional sections.
 * @returns {string[]} Normalized optional-section order.
 */
export function buildSectionOrder(sectionOrder = [], customSections = [], sectionState = {}) {
  const normalizedState = {
    ...normalizeSectionState(sectionState),
    ...sectionState,
  }
  const allowedKeys = new Set()
  const seenKeys = new Set()
  const normalizedOrder = []

  OPTIONAL_SECTION_KEYS.forEach((key) => {
    if (normalizedState[key]) {
      allowedKeys.add(key)
    }
  })

  customSections.forEach((section) => {
    if (section?.id) {
      allowedKeys.add(`custom:${section.id}`)
    }
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
    if (normalizedState[key] && !seenKeys.has(key)) {
      seenKeys.add(key)
      normalizedOrder.push(key)
    }
  })

  customSections.forEach((section) => {
    const customKey = `custom:${section.id}`

    if (section?.id && !seenKeys.has(customKey)) {
      seenKeys.add(customKey)
      normalizedOrder.push(customKey)
    }
  })

  return normalizedOrder
}

/**
 * Creates the editor form state from an existing vault response.
 *
 * @param {object | null} vault - Existing vault payload.
 * @returns {object} Editable form state.
 */
export function createVaultFormState(vault = null) {
  const customSections = Array.isArray(vault?.customSections)
    ? vault.customSections.map((section) => ({
        id: section.id,
        label: section.label || '',
        password: '',
        username: section.username || '',
        website: section.website || section.notes || '',
      }))
    : []

  const draft = {
    customSections,
    gst: {
      loginId: vault?.gst?.loginId || '',
      password: '',
      website: vault?.gst?.website || GST_PORTAL_WEBSITE,
    },
    it: {
      loginId: vault?.it?.loginId || '',
      password: '',
      website: vault?.it?.website || INCOME_TAX_WEBSITE,
    },
    sectionOrder: [],
  }

  draft.sectionOrder = buildSectionOrder(vault?.sectionOrder || [], customSections, draft)

  return draft
}

/**
 * Returns the tabs that should be shown in the detail or editor view.
 *
 * @param {object} vault - Vault-like object with optional-section state.
 * @returns {Array<object>} Tab descriptors.
 */
export function buildVaultTabs(vault) {
  const tabs = [...FIXED_TABS]
  const customSections = Array.isArray(vault?.customSections) ? vault.customSections : []
  const sectionOrder = buildSectionOrder(vault?.sectionOrder || [], customSections, vault)

  sectionOrder.forEach((value) => {
    if (OPTIONAL_SECTION_META[value]) {
      tabs.push(OPTIONAL_SECTION_META[value])
      return
    }

    const [, customSectionId] = value.split(':')
    const customSection = customSections.find((section) => section.id === customSectionId)

    if (customSection) {
      tabs.push({
        key: value,
        label: customSection.label || 'Custom Section',
      })
    }
  })

  return tabs
}

/**
 * Adds a predefined optional section to the editor state.
 *
 * @param {object} formState - Current editor form state.
 * @param {string} sectionKey - Optional section to enable.
 * @returns {object} Next editor state.
 */
export function addOptionalSection(formState, sectionKey) {
  if (!OPTIONAL_SECTION_KEYS.includes(sectionKey)) {
    return formState
  }

  const nextState = {
    ...formState,
    [sectionKey]: {
      ...formState[sectionKey],
      enabled: true,
    },
  }

  nextState.sectionOrder = buildSectionOrder(formState.sectionOrder, formState.customSections, nextState)

  return nextState
}

/**
 * Adds a new custom section when capacity is available.
 *
 * @param {object} formState - Current editor form state.
 * @param {string} label - User-facing custom section label.
 * @returns {object} Next editor state.
 */
export function addCustomSection(formState, label) {
  const normalizedLabel = normalizeText(label)

  if (!normalizedLabel || formState.customSections.length >= MAX_CUSTOM_SECTIONS) {
    return formState
  }

  const nextState = {
    ...formState,
    customSections: [
      ...formState.customSections,
      {
        id: createCustomSectionId(),
        label: normalizedLabel,
        password: '',
        username: '',
        website: '',
      },
    ],
  }

  nextState.sectionOrder = buildSectionOrder(nextState.sectionOrder, nextState.customSections, nextState)

  return nextState
}

/**
 * Removes an optional fixed or custom section from the editor state.
 *
 * @param {object} formState - Current editor form state.
 * @param {string} sectionKey - Optional or custom section key.
 * @returns {object} Next editor state.
 */
export function removeOptionalSection(formState, sectionKey) {
  if (OPTIONAL_SECTION_KEYS.includes(sectionKey)) {
    const nextState = {
      ...formState,
      [sectionKey]: sectionKey === 'epf'
        ? { code: '', enabled: false, loginId: '', password: '' }
        : { enabled: false, loginId: '', password: '' },
    }

    nextState.sectionOrder = buildSectionOrder(nextState.sectionOrder, nextState.customSections, nextState)
    return nextState
  }

  if (!sectionKey.startsWith('custom:')) {
    return formState
  }

  const [, customSectionId] = sectionKey.split(':')
  const nextState = {
    ...formState,
    customSections: formState.customSections.filter((section) => section.id !== customSectionId),
  }

  nextState.sectionOrder = buildSectionOrder(nextState.sectionOrder, nextState.customSections, nextState)

  return nextState
}

/**
 * Updates a custom section in the editor state.
 *
 * @param {object} formState - Current editor form state.
 * @param {string} customSectionId - Target custom section id.
 * @param {object} updates - Partial field updates.
 * @returns {object} Next editor state.
 */
export function updateCustomSection(formState, customSectionId, updates) {
  return {
    ...formState,
    customSections: formState.customSections.map((section) =>
      section.id === customSectionId ? { ...section, ...updates } : section,
    ),
  }
}

/**
 * Validates the editor draft before sending it to the API.
 *
 * @param {object} formState - Current editor form state.
 * @returns {string} Validation error, or an empty string when the draft is valid.
 */
export function validateVaultForm(formState) {
  const emptyCustomSection = formState.customSections.find((section) => !normalizeText(section.label))

  if (emptyCustomSection) {
    return 'Each custom section needs a label before you can save the vault.'
  }

  if (formState.customSections.length > MAX_CUSTOM_SECTIONS) {
    return `Only ${MAX_CUSTOM_SECTIONS} custom sections are supported.`
  }

  return ''
}

function buildSectionPayload(section, { includeEnabled = false, includeCode = false } = {}) {
  const payload = {
    loginId: normalizeText(section.loginId),
    website: normalizeText(section.website),
  }

  if (includeEnabled) {
    payload.enabled = Boolean(section.enabled)
  }

  if (includeCode) {
    payload.code = normalizeText(section.code)
  }

  if (section.password) {
    payload.password = section.password
  }

  return payload
}

/**
 * Builds the API payload from the current editor draft.
 *
 * @param {object} formState - Current editor form state.
 * @param {object} [options={}] - Payload options.
 * @param {string} [options.clientId=''] - Selected client id for create requests.
 * @param {string} [options.vaultId=''] - Vault id for update requests.
 * @returns {object} Normalized API payload.
 */
export function buildVaultPayload(formState, { clientId = '', vaultId = '' } = {}) {
  const normalizedSectionOrder = buildSectionOrder(
    formState.sectionOrder,
    formState.customSections,
    formState,
  )

  return {
    ...(clientId ? { clientId } : {}),
    ...(vaultId ? { vaultId } : {}),
    customSections: formState.customSections.map((section) => ({
      ...(section.password ? { password: section.password } : {}),
      id: section.id,
      label: normalizeText(section.label),
      username: normalizeText(section.username),
      website: normalizeText(section.website || section.notes),
    })),
    gst: buildSectionPayload(formState.gst),
    it: buildSectionPayload(formState.it),
    sectionOrder: normalizedSectionOrder,
  }
}
