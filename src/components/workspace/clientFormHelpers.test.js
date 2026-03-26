import { describe, expect, it } from 'vitest'
import {
  buildClientFormDraft,
  mapClientFormErrorMessage,
  validateClientFormDraft,
} from './clientFormHelpers'

describe('clientFormHelpers', () => {
  it('builds a normalized client draft from submitted form entries', () => {
    const draft = buildClientFormDraft([
      ['name', '  Example Industries  '],
      ['tradeName', ' Retail Ops '],
      ['gst', ' 27abcde1234f1z5 '],
      ['pan', ' abcde1234f '],
      ['addressLine', ' 42 Business Park '],
      ['city', ' Mumbai '],
      ['state', ' Maharashtra '],
      ['pincode', '400 001'],
      ['phone', '+91 98765 43210'],
      ['email', ' ops@example.com '],
    ])

    expect(draft).toEqual({
      name: 'Example Industries',
      tradeName: 'Retail Ops',
      gst: '27ABCDE1234F1Z5',
      pan: 'ABCDE1234F',
      addressLine: '42 Business Park',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      phone: '9876543210',
      email: 'ops@example.com',
    })
  })

  it('reports the grouped address error when the street line is missing', () => {
    const errorMessage = validateClientFormDraft({
      name: 'Example Client',
      addressLine: '',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      phone: '9876543210',
      email: 'ops@example.com',
    })

    expect(errorMessage).toBe('Registered address is required.')
    expect(mapClientFormErrorMessage('Address is required.')).toBe('Registered address is required.')
  })

  it('falls back to existing draft values when a field is missing from submitted entries', () => {
    const draft = buildClientFormDraft(
      [
        ['name', 'Example Client'],
        ['email', 'updated@example.com'],
      ],
      {
        tradeName: 'Fallback Trade',
        gst: '',
        pan: '',
        addressLine: 'Fallback Address',
        city: 'Pune',
        state: 'Maharashtra',
        pincode: '411045',
        phone: '9876543210',
        email: 'fallback@example.com',
      },
    )

    expect(draft.addressLine).toBe('Fallback Address')
    expect(draft.email).toBe('updated@example.com')
    expect(draft.city).toBe('Pune')
  })
})
