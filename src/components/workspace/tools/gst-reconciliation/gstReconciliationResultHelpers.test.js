import { describe, expect, it } from 'vitest'
import { buildGstMismatchViewModel } from './gstReconciliationResultHelpers'

describe('gstReconciliationResultHelpers', () => {
  it('builds purchase-register and GST mismatch sections from the updated response payload', () => {
    const viewModel = buildGstMismatchViewModel(
      {
        mismtached_rows_gstr_2b_4a: [
          {
            reason: 'GSTIN not found in Purchase Register',
            supplier_name: 'TRANSUNION CIBIL LIMITED',
          },
        ],
        mismtached_rows_purchase_register: [
          {
            reason: 'Invoice value mismatch',
            supplier_name: 'ULTRA TECH CEMENT LIMITED PARLI VAIJNATH',
          },
        ],
      },
      'gst_2b',
    )

    expect(viewModel.gstLabel).toBe('GSTR-2B')
    expect(viewModel.hasMismatchRows).toBe(true)
    expect(viewModel.totalRows).toBe(2)
    expect(viewModel.sections[0].rows[0].supplierName).toBe('ULTRA TECH CEMENT LIMITED PARLI VAIJNATH')
    expect(viewModel.sections[1].rows[0].reason).toBe('GSTIN not found in Purchase Register')
  })

  it('uses the first non-empty section as the default tab', () => {
    const viewModel = buildGstMismatchViewModel(
      {
        mismtached_rows_gstr_2b_4a: [
          {
            reason: 'Invoice value mismatch',
            supplier_name: 'ULTRATECH CEMENT LIMITED',
          },
        ],
      },
      'gst_4a',
    )

    expect(viewModel.defaultTabId).toBe('gst-source')
    expect(viewModel.sections[1].label).toBe('GSTR-4A')
  })

  it('treats a completed response with no mismatch arrays as a clean match state', () => {
    const viewModel = buildGstMismatchViewModel({ file_id: 'result-1' }, 'gst_2b')

    expect(viewModel.hasResult).toBe(true)
    expect(viewModel.hasMismatchRows).toBe(false)
    expect(viewModel.totalRows).toBe(0)
    expect(viewModel.successMessage).toContain('All invoices matched')
  })
})
