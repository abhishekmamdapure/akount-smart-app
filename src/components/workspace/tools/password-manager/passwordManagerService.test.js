import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: 'test-access-token',
          },
        },
      })),
    },
  },
}))

vi.mock('../shared/toolClientState', () => ({
  buildWorkspaceUserHeaders: vi.fn(() => ({ 'x-test-owner': 'user-1' })),
}))

import { createPasswordVault, updatePasswordVault } from './passwordManagerService'

function createJsonResponse(payload, { ok = true, url = 'https://api.example.com' } = {}) {
  return {
    ok,
    text: async () => JSON.stringify(payload),
    url,
  }
}

describe('passwordManagerService', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('omits blank password fields when creating a vault in the deployed API', async () => {
    global.fetch
      .mockResolvedValueOnce(createJsonResponse({ id: 'credential-1' }))
      .mockResolvedValueOnce(createJsonResponse({ items: [] }))

    await createPasswordVault(
      'client-1',
      {
        customSections: [
          {
            id: 'custom-slot-1',
            label: 'Portal One',
            username: 'portal-user',
            website: 'https://portal.example.com',
          },
        ],
        gst: { loginId: 'gst-user', website: 'https://services.gst.gov.in/services/login' },
        it: { loginId: 'it-user', website: 'https://www.incometax.gov.in' },
      },
      { id: 'user-1', email: 'owner@example.com' },
      {
        email: 'ops@example.com',
        gst: '22AAAAA0000A1Z5',
        id: 'client-1',
        name: 'Example Client',
        pan: 'AAAAA0000A',
        phone: '+91 9999999999',
      },
    )

    const firstCall = global.fetch.mock.calls[0]
    const body = JSON.parse(firstCall[1].body)

    expect(body).not.toHaveProperty('custom_1_password')
    expect(body).not.toHaveProperty('custom_password')
    expect(body).not.toHaveProperty('father_name')
    expect(body).not.toHaveProperty('gst_password')
    expect(body).not.toHaveProperty('gst_login_id')
    expect(body).not.toHaveProperty('it_password')
    expect(body).not.toHaveProperty('it_login_id')
  })

  it('passes entered passwords through unchanged on update', async () => {
    global.fetch
      .mockResolvedValueOnce(createJsonResponse({ id: 'credential-1' }))
      .mockResolvedValueOnce(createJsonResponse({ items: [] }))

    await updatePasswordVault(
      'credential-1',
      {
        customSections: [
          {
            id: 'custom-slot-1',
            label: 'Portal One',
            password: ' p ',
            username: 'portal-user',
            website: 'https://portal.example.com',
          },
        ],
        gst: { loginId: 'gst-user', password: '0', website: 'https://services.gst.gov.in/services/login' },
        it: { loginId: 'it-user', password: 'a', website: 'https://www.incometax.gov.in' },
      },
      { id: 'user-1', email: 'owner@example.com' },
      {
        email: 'ops@example.com',
        gst: '22AAAAA0000A1Z5',
        id: 'client-1',
        name: 'Example Client',
        pan: 'AAAAA0000A',
        phone: '+91 9999999999',
      },
    )

    const firstCall = global.fetch.mock.calls[0]
    const body = JSON.parse(firstCall[1].body)

    expect(body.custom_1_password).toBe(' p ')
    expect(body.custom_password).toBe(' p ')
    expect(body.gst_password).toBe('0')
    expect(body.it_password).toBe('a')
  })
})
