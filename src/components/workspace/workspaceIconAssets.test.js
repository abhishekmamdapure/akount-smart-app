import { describe, expect, it } from 'vitest'
import { resolveWorkspaceIconAsset } from './workspaceIconAssets'

describe('workspaceIconAssets', () => {
  it('maps top-level workspace tools to their uploaded icon assets', () => {
    expect(resolveWorkspaceIconAsset('toolDashboard')).toBe('/icons/dashboard.png')
    expect(resolveWorkspaceIconAsset('toolClients')).toBe('/icons/clients_management.png')
    expect(resolveWorkspaceIconAsset('toolGst')).toBe('/icons/gst.png')
    expect(resolveWorkspaceIconAsset('toolTallyXmlConverter')).toBe('/icons/tally_xml_converter.png')
  })

  it('keeps the detailed GST, password, and PDF filenames exactly as stored on disk', () => {
    expect(resolveWorkspaceIconAsset('toolGst2b')).toBe('/icons/gst_2b.png')
    expect(resolveWorkspaceIconAsset('toolGst4a')).toBe('/icons/gst_4a.png')
    expect(resolveWorkspaceIconAsset('toolPasswordManager')).toBe('/icons/passowords_management.png')
    expect(resolveWorkspaceIconAsset('toolPdfTools')).toBe('/icons/pdf-gear-icon.svg')
    expect(resolveWorkspaceIconAsset('toolPdfPageNumbers')).toBe('/icons/pdrf_page_numbers.png')
    expect(resolveWorkspaceIconAsset('toolPdfSplit')).toBe('/icons/pdf_split.png')
    expect(resolveWorkspaceIconAsset('toolPdfMerge')).toBe('/icons/pdf_merge.png')
  })

  it('falls back cleanly when a name is not asset-backed', () => {
    expect(resolveWorkspaceIconAsset('invoice')).toBe('')
    expect(resolveWorkspaceIconAsset('')).toBe('')
  })
})
