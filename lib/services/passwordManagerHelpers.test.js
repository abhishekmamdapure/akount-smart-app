import { describe, expect, it } from 'vitest'
import {
  buildPasswordVaultQuery,
  buildRevealTarget,
  normalizePasswordVaultPayload,
  serializeClientBasicInfo,
} from './passwordManagerHelpers'

describe('passwordManagerHelpers', () => {
  it('builds owner-scoped vault lookup queries', () => {
    expect(buildPasswordVaultQuery('user-1', 'client-1', 'vault-1')).toEqual({
      'owner.userId': 'user-1',
      _id: 'vault-1',
      clientId: 'client-1',
    })
  })

  it('normalizes vault payloads and validates malformed custom sections', () => {
    const result = normalizePasswordVaultPayload({
      clientId: 'client-1',
      customSections: [{ id: '', label: '' }],
      eway: { enabled: true, loginId: 'eway-user' },
      fatherName: 'Rajesh Kumar',
      gst: { loginId: 'gst-user' },
      it: { loginId: 'it-user' },
      sectionOrder: ['eway'],
    })

    expect(result.data.sectionOrder).toEqual(['eway'])
    expect(result.errors[0]).toContain('Custom section 1')
  })

  it('maps reveal requests for fixed and custom password fields', () => {
    expect(buildRevealTarget('gst')).toEqual({ customSectionId: '', error: '', field: 'gst' })
    expect(buildRevealTarget('custom', 'custom-1')).toEqual({
      customSectionId: 'custom-1',
      error: '',
      field: 'custom',
    })
  })

  it('serializes client identity from the CRM record', () => {
    expect(
      serializeClientBasicInfo({
        email: 'ops@example.com',
        gst: '22AAAAA0000A1Z5',
        name: 'Example Client',
        pan: 'AAAAA0000A',
        phone: '+91 9876543210',
        tradeName: 'Example Trade',
      }),
    ).toEqual({
      email: 'ops@example.com',
      gst: '22AAAAA0000A1Z5',
      name: 'Example Client',
      pan: 'AAAAA0000A',
      phone: '+91 9876543210',
      tradeName: 'Example Trade',
    })
  })
})
