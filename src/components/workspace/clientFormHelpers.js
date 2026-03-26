const CLIENT_FORM_FIELD_NAMES = Object.freeze([
  'name',
  'tradeName',
  'gst',
  'pan',
  'addressLine',
  'city',
  'state',
  'pincode',
  'phone',
  'email',
])
const CLIENT_PHONE_DIGIT_LIMIT = 10
const CLIENT_PINCODE_DIGIT_LIMIT = 6

function normalizeClientFormValue(fieldName, value) {
  const normalizedValue = String(value ?? '').trim()

  if (fieldName === 'phone') {
    return normalizedValue.replace(/\D/g, '').slice(-CLIENT_PHONE_DIGIT_LIMIT)
  }

  if (fieldName === 'pincode') {
    return normalizedValue.replace(/\D/g, '').slice(0, CLIENT_PINCODE_DIGIT_LIMIT)
  }

  if (fieldName === 'gst' || fieldName === 'pan') {
    return normalizedValue.toUpperCase().replace(/\s+/g, '')
  }

  return normalizedValue
}

/**
 * Builds a sanitized client draft from submitted form values.
 *
 * @param {Iterable<[string, FormDataEntryValue]>|object} source - The submitted form values.
 * @param {object} [fallbackDraft={}] - Existing draft values used as a fallback for missing fields.
 * @returns {object} The normalized client draft used for validation and submission.
 */
export function buildClientFormDraft(source, fallbackDraft = {}) {
  const entryObject =
    source && typeof source !== 'string' && typeof source[Symbol.iterator] === 'function'
      ? Object.fromEntries(source)
      : Object(source || {})

  return CLIENT_FORM_FIELD_NAMES.reduce((draft, fieldName) => {
    const rawValue = Object.prototype.hasOwnProperty.call(entryObject, fieldName)
      ? entryObject[fieldName]
      : fallbackDraft[fieldName]

    return {
      ...draft,
      [fieldName]: normalizeClientFormValue(fieldName, rawValue),
    }
  }, {})
}

/**
 * Validates the client draft before it is sent to the API.
 *
 * @param {object} draft - The normalized client draft.
 * @returns {string|null} A user-facing validation message when invalid, else `null`.
 */
export function validateClientFormDraft(draft = {}) {
  if (!draft.name) {
    return 'Client name is required.'
  }

  if (!draft.addressLine) {
    return 'Registered address is required.'
  }

  if (!draft.city) {
    return 'City is required.'
  }

  if (!draft.state) {
    return 'State is required.'
  }

  if (!draft.pincode) {
    return 'Pincode is required.'
  }

  if (!draft.phone) {
    return 'Mobile number is required.'
  }

  if (!draft.email) {
    return 'Email address is required.'
  }

  return null
}

/**
 * Maps API validation messages to the updated client-form copy.
 *
 * @param {string} message - The raw API validation message.
 * @returns {string} The user-facing validation message.
 */
export function mapClientFormErrorMessage(message = '') {
  if (message === 'Address is required.') {
    return 'Registered address is required.'
  }

  return String(message || '')
}
