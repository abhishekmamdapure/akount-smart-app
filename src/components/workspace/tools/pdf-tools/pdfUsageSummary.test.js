import { describe, expect, it } from 'vitest'
import { buildPdfUsageSummaryCards } from './pdfUsageSummary'

describe('pdfUsageSummary', () => {
  it('builds individual split and merge cards from history summaries', () => {
    const cards = buildPdfUsageSummaryCards({
      history: [
        { summary: 'split into 3 files', tool: 'split_merge' },
        { summary: 'merged 4 files', tool: 'split_merge' },
        { summary: 'Select a PDF to split.', tool: 'split_merge' },
      ],
      totalsByTool: {
        split_merge: 3,
      },
    })

    expect(cards[0]).toEqual({
      count: 2,
      id: 'split',
      label: 'Split',
    })
    expect(cards[1]).toEqual({
      count: 1,
      id: 'merge',
      label: 'Merge',
    })
  })

  it('shows separate convert cards for excel and word', () => {
    const cards = buildPdfUsageSummaryCards({
      totalsByTool: {
        compress_pdf: 3,
        page_numbers: 2,
        reorder_delete: 1,
        to_excel: 4,
        to_word: 1,
        watermark: 0,
      },
    })

    expect(cards).toEqual([
      { count: 0, id: 'split', label: 'Split' },
      { count: 0, id: 'merge', label: 'Merge' },
      { count: 1, id: 'reorder_delete', label: 'Reorder / Delete' },
      { count: 2, id: 'page_numbers', label: 'Page Numbers' },
      { count: 0, id: 'watermark', label: 'Watermark' },
      { count: 4, id: 'to_excel', label: 'Convert to Excel' },
      { count: 1, id: 'to_word', label: 'Convert to Word' },
      { count: 3, id: 'compress_pdf', label: 'Compress PDF' },
    ])
  })
})
