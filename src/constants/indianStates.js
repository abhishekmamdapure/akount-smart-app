export const INDIAN_STATE_OPTIONS = Object.freeze([
  'Andhra Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
])

/**
 * Returns the canonical Indian-state label for a raw input value.
 *
 * @param {string} [value=''] - The raw state input.
 * @returns {string} The canonical state label when available, else the trimmed input value.
 */
export function normalizeIndianStateValue(value = '') {
  const normalizedState = String(value || '').trim()

  if (!normalizedState) {
    return ''
  }

  return (
    INDIAN_STATE_OPTIONS.find((stateName) => stateName.toLowerCase() === normalizedState.toLowerCase()) ||
    normalizedState
  )
}

/**
 * Builds the shared Indian-state dropdown options while preserving legacy values.
 *
 * @param {string} [selectedState=''] - The currently selected state value.
 * @returns {Array<string>} The dropdown options shown to the user.
 */
export function buildIndianStateOptions(selectedState = '') {
  const normalizedState = normalizeIndianStateValue(selectedState)

  if (!normalizedState || INDIAN_STATE_OPTIONS.includes(normalizedState)) {
    return INDIAN_STATE_OPTIONS
  }

  return [normalizedState, ...INDIAN_STATE_OPTIONS]
}
