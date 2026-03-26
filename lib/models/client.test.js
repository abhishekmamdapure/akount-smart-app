import { describe, expect, it } from 'vitest'
import { normalizeClientPayload, serializeClient, validateClientPayload } from './client'

describe('client model helpers', () => {
  it('normalizes specific address fields into a single stored address and keeps GST optional', () => {
    const payload = normalizeClientPayload({
      name: '  Example Industries  ',
      tradeName: ' Retail Ops ',
      gst: '',
      pan: 'abcde1234f',
      addressLine: ' 42 Business Park ',
      city: ' Mumbai ',
      state: ' Maharashtra ',
      pincode: '400 001',
      phone: '+91 98765-43210',
      email: 'OPS@EXAMPLE.COM ',
    })

    expect(payload).toEqual({
      name: 'Example Industries',
      tradeName: 'Retail Ops',
      gst: undefined,
      pan: 'ABCDE1234F',
      address: '42 Business Park, Mumbai, Maharashtra, 400001',
      addressLine: '42 Business Park',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      phone: '+91 9876543210',
      email: 'ops@example.com',
    })
  })

  it('validates missing location fields and malformed pincode values', () => {
    expect(
      validateClientPayload({
        name: 'Example Client',
        addressLine: '42 Business Park',
        city: '',
        state: 'Maharashtra',
        pincode: '400001',
        phone: '+91 9876543210',
        email: 'ops@example.com',
      }),
    ).toBe('City is required.')

    expect(
      validateClientPayload({
        name: 'Example Client',
        addressLine: '42 Business Park',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '4000',
        phone: '+91 9876543210',
        email: 'ops@example.com',
      }),
    ).toBe('Pincode must be 6 digits.')
  })

  it('serializes legacy clients with address fallbacks for older records', () => {
    const client = serializeClient({
      _id: 'legacy-client-1',
      name: 'Legacy Client',
      tradeName: '',
      gst: '',
      pan: 'ABCDE1234F',
      address: 'Old Street 1, Pune, Maharashtra, 411045',
      phone: '+91 9876543210',
      email: 'legacy@example.com',
      createdAt: '2026-03-26T00:00:00.000Z',
      updatedAt: '2026-03-26T00:00:00.000Z',
    })

    expect(client).toMatchObject({
      id: 'legacy-client-1',
      address: 'Old Street 1, Pune, Maharashtra, 411045',
      addressLine: 'Old Street 1, Pune, Maharashtra, 411045',
      city: '',
      state: '',
      pincode: '',
    })
  })
})
