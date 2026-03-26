/**
 * Builds the PDF usage summary cards shown above the history table.
 *
 * @param {{ history: Array<object>, totalsByTool: Record<string, number> }} params - History items and usage totals.
 * @returns {Array<object>} A normalized list of usage cards.
 */
export function buildPdfUsageSummaryCards({ history = [], totalsByTool = {} } = {}) {
  const splitCount = history.filter((item) => inferSplitMergeVariant(item) === 'split').length
  const mergeCount = history.filter((item) => inferSplitMergeVariant(item) === 'merge').length

  return [
    { count: splitCount, id: 'split', label: 'Split' },
    { count: mergeCount, id: 'merge', label: 'Merge' },
    { count: Number(totalsByTool.reorder_delete || 0), id: 'reorder_delete', label: 'Reorder / Delete' },
    { count: Number(totalsByTool.page_numbers || 0), id: 'page_numbers', label: 'Page Numbers' },
    { count: Number(totalsByTool.watermark || 0), id: 'watermark', label: 'Watermark' },
    { count: Number(totalsByTool.to_excel || 0), id: 'to_excel', label: 'Convert to Excel' },
    { count: Number(totalsByTool.to_word || 0), id: 'to_word', label: 'Convert to Word' },
    { count: Number(totalsByTool.compress_pdf || 0), id: 'compress_pdf', label: 'Compress PDF' },
  ]
}

function inferSplitMergeVariant(item) {
  const summary = String(item?.summary || '').toLowerCase()

  if (summary.includes('merge')) {
    return 'merge'
  }

  if (summary.includes('split')) {
    return 'split'
  }

  return ''
}
