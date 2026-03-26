import { describe, expect, it } from 'vitest'
import {
  buildPageNumberText,
  formatPageNumberPreviewText,
  resolvePageNumberRange,
  validatePageNumberColor,
  validatePageNumberRange,
} from './pageNumbersHelpers'

describe('pageNumbersHelpers', () => {
  it('formats supported page-number label variants', () => {
    expect(buildPageNumberText('numeric', 3, 8)).toBe('3')
    expect(buildPageNumberText('page_n_of_total', 3, 8)).toBe('Page 3 of 8')
    expect(buildPageNumberText('dash_n_dash', 3, 8)).toBe('- 3 -')
    expect(buildPageNumberText('roman', 9, 12)).toBe('ix')
    expect(buildPageNumberText('alpha', 28, 40)).toBe('ab')
  })

  it('builds preview text from the selected starting number', () => {
    expect(formatPageNumberPreviewText('page_n_of_total', '5')).toBe('Page 5 of 14')
  })

  it('resolves optional page ranges against the document size', () => {
    expect(resolvePageNumberRange('', '', 12)).toEqual({ start: 1, end: 12 })
    expect(resolvePageNumberRange('3', '9', 12)).toEqual({ start: 3, end: 9 })
  })

  it('validates page-range and color inputs', () => {
    expect(validatePageNumberRange('9', '3', 12)).toBe('Start must not exceed end.')
    expect(validatePageNumberRange('2', '6', 12)).toBe('')
    expect(validatePageNumberColor('#1f2937')).toBe('')
    expect(validatePageNumberColor('1f2937')).toBe('Use a full hex color like #000000.')
  })
})
