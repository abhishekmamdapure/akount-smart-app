export const PDF_COMPRESSION_PRESETS = Object.freeze({
  balanced: {
    description: 'Keeps text readable while trimming image-heavy PDFs to a smaller size.',
    imageQuality: 0.76,
    key: 'balanced',
    label: 'Balanced',
    renderScale: 1.35,
  },
  maximum: {
    description: 'Applies the strongest reduction for the smallest possible file size.',
    imageQuality: 0.48,
    key: 'maximum',
    label: 'Maximum Compression',
    renderScale: 0.92,
  },
  smaller_file: {
    description: 'Reduces file size more aggressively with a modest quality trade-off.',
    imageQuality: 0.62,
    key: 'smaller_file',
    label: 'Smaller File',
    renderScale: 1.12,
  },
})

/**
 * Resolves the PDF compression preset configuration.
 *
 * @param {string} key - The selected preset key from the compress PDF UI.
 * @returns {{description: string, imageQuality: number, key: string, label: string, renderScale: number}} The preset config.
 */
export function getPdfCompressionPreset(key) {
  return PDF_COMPRESSION_PRESETS[String(key || '').trim()] || PDF_COMPRESSION_PRESETS.balanced
}

/**
 * Calculates file-size savings for a compressed PDF result.
 *
 * @param {number} originalSize - The original PDF size in bytes.
 * @param {number} outputSize - The compressed PDF size in bytes.
 * @returns {{bytesSaved: number, reductionPercent: number, wasReduced: boolean}} Compression stats.
 */
export function calculatePdfCompressionStats(originalSize, outputSize) {
  const safeOriginalSize = Number(originalSize)
  const safeOutputSize = Number(outputSize)

  if (!Number.isFinite(safeOriginalSize) || safeOriginalSize <= 0 || !Number.isFinite(safeOutputSize) || safeOutputSize <= 0) {
    return {
      bytesSaved: 0,
      reductionPercent: 0,
      wasReduced: false,
    }
  }

  const bytesSaved = Math.max(0, safeOriginalSize - safeOutputSize)
  const reductionPercent = bytesSaved > 0 ? Math.round((bytesSaved / safeOriginalSize) * 100) : 0

  return {
    bytesSaved,
    reductionPercent,
    wasReduced: bytesSaved > 0,
  }
}
