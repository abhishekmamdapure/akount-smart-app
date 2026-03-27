/**
 * Builds the source-file link model shown in tool history tables.
 *
 * @param {object} [entry={}] - The serialized history entry.
 * @param {string} [fallbackFileName=''] - The fallback label when the entry is missing a file name.
 * @returns {{ fileName: string, href: string }} The source-file label and download href.
 */
export function buildSourceHistoryFileLink(entry = {}, fallbackFileName = '') {
  return {
    fileName: String(entry.fileName || fallbackFileName || '').trim(),
    href: String(entry.sourceDownloadHref || '').trim(),
  }
}
