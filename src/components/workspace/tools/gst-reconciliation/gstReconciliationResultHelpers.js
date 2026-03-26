const DEFAULT_GST_LABEL = 'GSTR-2B'
const GST_LABELS = Object.freeze({
  gst_2b: 'GSTR-2B',
  gst_4a: 'GSTR-4A',
})
const PURCHASE_REGISTER_KEYS = Object.freeze([
  'mismtached_rows_purchase_register',
  'mismatched_rows_purchase_register',
  'mismtachedRowsPurchaseRegister',
  'mismatchedRowsPurchaseRegister',
])
const GST_2B_KEYS = Object.freeze([
  'mismtached_rows_gstr_2b_4a',
  'mismatched_rows_gstr_2b_4a',
  'mismtached_rows_gstr_2b',
  'mismatched_rows_gstr_2b',
  'mismtachedRowsGstr2b4a',
  'mismatchedRowsGstr2b4a',
])
const GST_4A_KEYS = Object.freeze([
  'mismtached_rows_gstr_2b_4a',
  'mismatched_rows_gstr_2b_4a',
  'mismtached_rows_gstr_4a',
  'mismatched_rows_gstr_4a',
  'mismtachedRowsGstr2b4a',
  'mismatchedRowsGstr2b4a',
])
const PURCHASE_REGISTER_SECTION_ID = 'purchase-register'
const GST_SECTION_ID = 'gst-source'
const UNKNOWN_SUPPLIER_LABEL = 'Unknown supplier'
const UNKNOWN_REASON_LABEL = 'Reason not provided.'

function getGstLabel(type) {
  return GST_LABELS[type] || DEFAULT_GST_LABEL
}

function pickFirstArray(source, keys) {
  for (const key of keys) {
    if (Array.isArray(source?.[key])) {
      return source[key]
    }
  }

  return []
}

function normalizeMismatchRows(rows, sectionId) {
  return rows.map((row, index) => {
    const supplierName = String(row?.supplier_name || row?.supplierName || '').trim() || UNKNOWN_SUPPLIER_LABEL
    const reason = String(row?.reason || '').trim() || UNKNOWN_REASON_LABEL

    return {
      id: `${sectionId}-${index}-${supplierName}-${reason}`,
      reason,
      supplierName,
    }
  })
}

/**
 * Builds a normalized mismatch view-model for the GST reconciliation result.
 *
 * Args:
 *   result: The latest GST reconciliation API payload stored in the active draft state.
 *   type: The active GST reconciliation type (`gst_2b` or `gst_4a`).
 *
 * Returns:
 *   An object with normalized section data, totals, and labels for mismatch rendering.
 */
export function buildGstMismatchViewModel(result, type) {
  const gstLabel = getGstLabel(type)
  const purchaseRows = normalizeMismatchRows(
    pickFirstArray(result, PURCHASE_REGISTER_KEYS),
    PURCHASE_REGISTER_SECTION_ID,
  )
  const gstRows = normalizeMismatchRows(
    pickFirstArray(result, type === 'gst_4a' ? GST_4A_KEYS : GST_2B_KEYS),
    GST_SECTION_ID,
  )
  const sections = [
    {
      emptyState: 'No mismatched rows were reported for the Purchase Register.',
      id: PURCHASE_REGISTER_SECTION_ID,
      label: 'Purchase Register',
      rows: purchaseRows,
    },
    {
      emptyState: `No mismatched rows were reported for ${gstLabel}.`,
      id: GST_SECTION_ID,
      label: gstLabel,
      rows: gstRows,
    },
  ]
  const totalRows = sections.reduce((sum, section) => sum + section.rows.length, 0)
  const firstSectionWithRows = sections.find((section) => section.rows.length > 0)

  return {
    defaultTabId: firstSectionWithRows?.id || PURCHASE_REGISTER_SECTION_ID,
    gstLabel,
    hasMismatchRows: totalRows > 0,
    hasResult: Boolean(result),
    sections,
    successMessage: `All invoices matched across the Purchase Register and ${gstLabel}.`,
    totalRows,
  }
}
