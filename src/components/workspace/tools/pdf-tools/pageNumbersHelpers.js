export const PAGE_NUMBER_POSITION_OPTIONS = Object.freeze([
  { value: 'bottom_center', label: 'Bottom Center' },
  { value: 'bottom_right', label: 'Bottom Right' },
  { value: 'bottom_left', label: 'Bottom Left' },
  { value: 'top_center', label: 'Top Center' },
  { value: 'top_right', label: 'Top Right' },
  { value: 'top_left', label: 'Top Left' },
])

export const PAGE_NUMBER_FORMAT_OPTIONS = Object.freeze([
  { value: 'numeric', label: '1, 2, 3 ...' },
  { value: 'page_n_of_total', label: 'Page 1 of N' },
  { value: 'dash_n_dash', label: '- 1 -' },
  { value: 'roman', label: 'i, ii, iii ...' },
  { value: 'alpha', label: 'a, b, c ...' },
])

export const PAGE_NUMBER_DEFAULTS = Object.freeze({
  position: 'bottom_center',
  format: 'numeric',
  startFrom: '1',
  fontSize: '12',
  fontColor: '#000000',
  fontSizeMin: 6,
  fontSizeMax: 72,
  previewFontSizeMin: 8,
  previewFontSizeMax: 16,
  previewSequenceLength: 10,
  previewVerticalOffset: 18,
  previewHorizontalOffset: 22,
  outputMargin: 24,
})

export const PAGE_NUMBER_STATUS_MESSAGES = Object.freeze({
  idle: '',
  validating: 'Checking PDF settings...',
  invalid: 'Fix the highlighted fields before processing.',
  processing: 'Applying page numbers...',
  missingFile: 'Select a PDF first.',
})

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

function parsePositiveInteger(value, fallback = 1) {
  const numeric = Number.parseInt(value, 10)

  if (!Number.isInteger(numeric) || numeric < 1) {
    return fallback
  }

  return numeric
}

function toRomanNumeral(value) {
  const numerals = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ]
  let remaining = parsePositiveInteger(value, 1)
  let result = ''

  numerals.forEach(([amount, symbol]) => {
    while (remaining >= amount) {
      result += symbol
      remaining -= amount
    }
  })

  return result.toLowerCase()
}

function toAlphabetLabel(value) {
  let remaining = parsePositiveInteger(value, 1)
  let result = ''

  while (remaining > 0) {
    remaining -= 1
    result = String.fromCharCode(97 + (remaining % 26)) + result
    remaining = Math.floor(remaining / 26)
  }

  return result
}

/**
 * Builds the final page-number text for a given numbering format.
 *
 * @param {string} format - Selected format key.
 * @param {number} pageNumber - Current number in the rendered sequence.
 * @param {number} totalPages - Final number to show for total-based formats.
 * @returns {string} Formatted page-number text.
 */
export function buildPageNumberText(format, pageNumber, totalPages) {
  const normalizedPage = parsePositiveInteger(pageNumber, 1)
  const normalizedTotal = Math.max(normalizedPage, parsePositiveInteger(totalPages, normalizedPage))

  if (format === 'page_n_of_total') {
    return `Page ${normalizedPage} of ${normalizedTotal}`
  }

  if (format === 'dash_n_dash') {
    return `- ${normalizedPage} -`
  }

  if (format === 'roman') {
    return toRomanNumeral(normalizedPage)
  }

  if (format === 'alpha') {
    return toAlphabetLabel(normalizedPage)
  }

  return `${normalizedPage}`
}

/**
 * Formats the sample value shown in the live preview card.
 *
 * @param {string} format - Selected numbering format.
 * @param {string} startFrom - Starting number entered in the UI.
 * @returns {string} Preview text.
 */
export function formatPageNumberPreviewText(format, startFrom) {
  const previewStart = parsePositiveInteger(startFrom, parsePositiveInteger(PAGE_NUMBER_DEFAULTS.startFrom, 1))
  const previewTotal = previewStart + PAGE_NUMBER_DEFAULTS.previewSequenceLength - 1

  return buildPageNumberText(format, previewStart, previewTotal)
}

/**
 * Returns the inline style used by the live preview label.
 *
 * @param {string} position - Selected placement option.
 * @param {string} fontColor - Hex color input.
 * @param {string} fontSize - Font size input.
 * @returns {Record<string, string | number>} Preview style object.
 */
export function getPageNumberPreviewStyle(position, fontColor, fontSize) {
  const previewColor = HEX_COLOR_RE.test(String(fontColor || '').trim())
    ? String(fontColor).trim()
    : PAGE_NUMBER_DEFAULTS.fontColor
  const previewFontSize = Math.min(
    Math.max(parsePositiveInteger(fontSize, Number(PAGE_NUMBER_DEFAULTS.fontSize)), PAGE_NUMBER_DEFAULTS.previewFontSizeMin),
    PAGE_NUMBER_DEFAULTS.previewFontSizeMax,
  )
  const baseStyle = {
    position: 'absolute',
    color: previewColor,
    fontSize: `${previewFontSize}px`,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    transition: 'all 160ms ease',
  }

  if (position === 'bottom_right') {
    return {
      ...baseStyle,
      bottom: PAGE_NUMBER_DEFAULTS.previewVerticalOffset,
      right: PAGE_NUMBER_DEFAULTS.previewHorizontalOffset,
    }
  }

  if (position === 'bottom_left') {
    return {
      ...baseStyle,
      bottom: PAGE_NUMBER_DEFAULTS.previewVerticalOffset,
      left: PAGE_NUMBER_DEFAULTS.previewHorizontalOffset,
    }
  }

  if (position === 'top_center') {
    return {
      ...baseStyle,
      top: PAGE_NUMBER_DEFAULTS.previewVerticalOffset,
      left: '50%',
      transform: 'translateX(-50%)',
    }
  }

  if (position === 'top_right') {
    return {
      ...baseStyle,
      top: PAGE_NUMBER_DEFAULTS.previewVerticalOffset,
      right: PAGE_NUMBER_DEFAULTS.previewHorizontalOffset,
    }
  }

  if (position === 'top_left') {
    return {
      ...baseStyle,
      top: PAGE_NUMBER_DEFAULTS.previewVerticalOffset,
      left: PAGE_NUMBER_DEFAULTS.previewHorizontalOffset,
    }
  }

  return {
    ...baseStyle,
    bottom: PAGE_NUMBER_DEFAULTS.previewVerticalOffset,
    left: '50%',
    transform: 'translateX(-50%)',
  }
}

/**
 * Validates the "start from" input.
 *
 * @param {string} value - User-provided start value.
 * @returns {string} Validation message, or an empty string when valid.
 */
export function validatePageNumberStartFrom(value) {
  const numeric = Number.parseInt(value, 10)

  if (!Number.isInteger(numeric) || numeric < 1) {
    return 'Must be a positive integer.'
  }

  return ''
}

/**
 * Validates the font size input against supported PDF limits.
 *
 * @param {string} value - User-provided font size.
 * @returns {string} Validation message, or an empty string when valid.
 */
export function validatePageNumberFontSize(value) {
  const numeric = Number.parseInt(value, 10)

  if (
    !Number.isInteger(numeric) ||
    numeric < PAGE_NUMBER_DEFAULTS.fontSizeMin ||
    numeric > PAGE_NUMBER_DEFAULTS.fontSizeMax
  ) {
    return `Must be between ${PAGE_NUMBER_DEFAULTS.fontSizeMin} and ${PAGE_NUMBER_DEFAULTS.fontSizeMax}.`
  }

  return ''
}

/**
 * Validates a hex font color input.
 *
 * @param {string} value - User-provided color value.
 * @returns {string} Validation message, or an empty string when valid.
 */
export function validatePageNumberColor(value) {
  if (!HEX_COLOR_RE.test(String(value || '').trim())) {
    return 'Use a full hex color like #000000.'
  }

  return ''
}

/**
 * Validates the optional page range against the detected page count.
 *
 * @param {string} start - User-provided range start.
 * @param {string} end - User-provided range end.
 * @param {number | null} pageCount - Total page count for the selected PDF.
 * @returns {string} Validation message, or an empty string when valid.
 */
export function validatePageNumberRange(start, end, pageCount) {
  if (!String(start || '').trim() && !String(end || '').trim()) {
    return ''
  }

  const startValue = Number.parseInt(start, 10)
  const endValue = Number.parseInt(end, 10)
  const maxPage = Number.isInteger(pageCount) && pageCount > 0 ? pageCount : null

  if (String(start || '').trim()) {
    if (!Number.isInteger(startValue) || startValue < 1 || (maxPage !== null && startValue > maxPage)) {
      return `Start must be between 1 and ${maxPage ?? '?'}.`
    }
  }

  if (String(end || '').trim()) {
    if (!Number.isInteger(endValue) || endValue < 1 || (maxPage !== null && endValue > maxPage)) {
      return `End must be between 1 and ${maxPage ?? '?'}.`
    }
  }

  if (String(start || '').trim() && String(end || '').trim() && startValue > endValue) {
    return 'Start must not exceed end.'
  }

  return ''
}

/**
 * Resolves the effective page range used during PDF processing.
 *
 * @param {string} start - Optional range start from the UI.
 * @param {string} end - Optional range end from the UI.
 * @param {number} pageCount - Total page count for the selected PDF.
 * @returns {{start: number, end: number}} Inclusive page bounds.
 */
export function resolvePageNumberRange(start, end, pageCount) {
  const normalizedTotal = parsePositiveInteger(pageCount, 1)

  return {
    start: String(start || '').trim() ? parsePositiveInteger(start, 1) : 1,
    end: String(end || '').trim() ? parsePositiveInteger(end, normalizedTotal) : normalizedTotal,
  }
}
