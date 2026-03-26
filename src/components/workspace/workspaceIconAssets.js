export const WORKSPACE_ICON_ASSET_MAP = Object.freeze({
  toolClients: '/icons/clients_management.png',
  toolDashboard: '/icons/dashboard.png',
  toolGst: '/icons/gst.png',
  toolGst2b: '/icons/gst_2b.png',
  toolGst4a: '/icons/gst_4a.png',
  toolPasswordManager: '/icons/passowords_management.png',
  toolPdfCompress: '/icons/pdf_compress.png',
  toolPdfExcel: '/icons/pdf_excel.png',
  toolPdfMerge: '/icons/pdf_merge.png',
  toolPdfPageNumbers: '/icons/pdrf_page_numbers.png',
  toolPdfReorderDelete: '/icons/pdf_delete.png',
  toolPdfSplit: '/icons/pdf_split.png',
  toolPdfTools: '/icons/pdf-gear-icon.svg',
  toolPdfWatermark: '/icons/pdf_watermark.png',
  toolPdfWord: '/icons/pdf_word.png',
  toolTallyXmlConverter: '/icons/tally_xml_converter.png',
})

/**
 * Resolves the asset-backed icon path for a tool icon name.
 *
 * @param {string} name - The tool-specific workspace icon key.
 * @returns {string} A public asset path when the tool icon is image-backed, else an empty string.
 */
export function resolveWorkspaceIconAsset(name) {
  return WORKSPACE_ICON_ASSET_MAP[String(name || '')] || ''
}
