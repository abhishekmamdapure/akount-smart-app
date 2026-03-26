import { describe, expect, it } from 'vitest'
import { TOOL_CARDS } from './pdfToolConstants'

describe('pdfToolConstants', () => {
  it('keeps the PDF tool catalog at six cards after combining convert and adding compress', () => {
    expect(TOOL_CARDS).toHaveLength(6)
    expect(TOOL_CARDS.map((tool) => tool.id)).toEqual([
      'split_merge',
      'reorder_delete',
      'page_numbers',
      'watermark',
      'convert_pdf',
      'compress_pdf',
    ])
  })

  it('uses a stacked icon setup for the combined convert card', () => {
    const convertTool = TOOL_CARDS.find((tool) => tool.id === 'convert_pdf')

    expect(convertTool).toMatchObject({
      badge: 'DOCX / XLSX',
      icon: 'toolPdfWord',
      secondaryIcon: 'toolPdfExcel',
      title: 'Convert to Word / Excel',
    })
  })

  it('uses the uploaded split and merge icons together on the combined split-merge card', () => {
    const splitMergeTool = TOOL_CARDS.find((tool) => tool.id === 'split_merge')

    expect(splitMergeTool).toMatchObject({
      icon: 'toolPdfSplit',
      secondaryIcon: 'toolPdfMerge',
      title: 'Split / Merge',
    })
  })
})
