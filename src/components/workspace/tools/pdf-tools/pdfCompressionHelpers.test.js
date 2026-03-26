import { describe, expect, it } from 'vitest'
import { calculatePdfCompressionStats, getPdfCompressionPreset } from './pdfCompressionHelpers'

describe('pdfCompressionHelpers', () => {
  it('falls back to the balanced preset when the provided key is unknown', () => {
    expect(getPdfCompressionPreset('missing').key).toBe('balanced')
    expect(getPdfCompressionPreset('smaller_file').label).toBe('Smaller File')
  })

  it('reports byte savings and reduction percent when compression reduces file size', () => {
    expect(calculatePdfCompressionStats(1000, 640)).toEqual({
      bytesSaved: 360,
      reductionPercent: 36,
      wasReduced: true,
    })
  })

  it('returns a safe no-reduction result for invalid or larger output sizes', () => {
    expect(calculatePdfCompressionStats(1000, 1200)).toEqual({
      bytesSaved: 0,
      reductionPercent: 0,
      wasReduced: false,
    })
  })
})
