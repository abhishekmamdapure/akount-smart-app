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

import {
  createPasswordVault,
  deletePasswordVault,
  fetchPasswordVault,
  revealPasswordField,
  updatePasswordVault,
} from './passwordManagerService'

function createJsonResponse(payload, { ok = true, status = 200, url = 'https://api.example.com' } = {}) {
  return {
    ok,
    status,
    text: async () => JSON.stringify(payload),
    url,
  }
}

describe('passwordManagerService', () => {
  const originalFetch = global.fetch
  const currentUser = { email: 'owner@example.com', id: 'user-1' }
  const selectedClient = {
    email: 'ops@example.com',
    gst: '22AAAAA0000A1Z5',
    id: 'client-1',
    name: 'Example Client',
    pan: 'AAAAA0000A',
    phone: '+91 9999999999',
  }

  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('fetches vault data from the password-manager vault endpoint only', async () => {
    global.fetch.mockResolvedValueOnce(createJsonResponse({
      vault: {
        clientId: 'client-1',
        customSections: [
          {
            hasPassword: true,
            id: 'custom-1',
            label: 'Portal One',
            website: 'https://portal.example.com',
            username: 'portal-user',
          },
        ],
        gst: { hasPassword: true, loginId: 'gst-user' },
        id: 'vault-1',
        it: { hasPassword: true, loginId: 'it-user' },
        sectionOrder: ['custom:custom-1'],
      },
    }))

    const result = await fetchPasswordVault('client-1', currentUser, selectedClient)

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(String(global.fetch.mock.calls[0][0])).toContain('/api/password-manager?clientId=client-1')
    expect(String(global.fetch.mock.calls[0][0])).not.toContain('/credentials')
    expect(result.customSections[0]).toMatchObject({
      hasPassword: true,
      id: 'custom-1',
      label: 'Portal One',
      username: 'portal-user',
      website: 'https://portal.example.com',
    })
  })

  it('treats credential_not_found as an empty vault state', async () => {
    global.fetch.mockResolvedValueOnce(
      createJsonResponse(
        { detail: { code: 'credential_not_found', message: 'Credential not found' } },
        { ok: false, status: 404 },
      ),
    )

    const result = await fetchPasswordVault('client-1', currentUser, selectedClient)

    expect(result).toBeNull()
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(String(global.fetch.mock.calls[0][0])).toContain('/api/password-manager?clientId=client-1')
  })

  it('creates new vaults through the password-manager vault endpoint only', async () => {
    global.fetch.mockResolvedValueOnce(createJsonResponse({
      vault: {
        clientId: 'client-1',
        customSections: [
          {
            hasPassword: false,
            id: 'custom-1',
            label: 'Portal One',
            website: 'https://portal.example.com',
            username: 'portal-user',
          },
        ],
        gst: { hasPassword: false, loginId: 'gst-user' },
        id: 'vault-1',
        it: { hasPassword: false, loginId: 'it-user' },
        sectionOrder: ['custom:custom-1'],
      },
    }))

    const payload = {
      clientId: 'client-1',
      customSections: [
        {
          id: 'custom-1',
          label: 'Portal One',
          username: 'portal-user',
          website: 'https://portal.example.com',
        },
      ],
      gst: { loginId: 'gst-user', website: 'https://services.gst.gov.in/services/login' },
      it: { loginId: 'it-user', website: 'https://www.incometax.gov.in' },
      sectionOrder: ['custom:custom-1'],
    }

    const result = await createPasswordVault('client-1', payload, currentUser, selectedClient)

    expect(String(global.fetch.mock.calls[0][0])).toContain('/api/password-manager')
    expect(String(global.fetch.mock.calls[0][0])).not.toContain('/credentials')
    expect(global.fetch.mock.calls[0][1].method).toBe('POST')
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({
      active_optional_sections: ['custom_1'],
      client_id: 'client-1',
      client_name: 'Example Client',
      custom_1_label: 'Portal One',
      custom_1_notes: 'https://portal.example.com',
      custom_1_username: 'portal-user',
      custom_label: 'Portal One',
      custom_notes: 'https://portal.example.com',
      custom_username: 'portal-user',
      email_id: 'ops@example.com',
      father_name: '',
      gst_login_id: 'gst-user',
      gst_number: '22AAAAA0000A1Z5',
      it_login_id: 'it-user',
      pan_number: 'AAAAA0000A',
      phone_number: '+91 9999999999',
    })
    expect(result.id).toBe('vault-1')
  })

  it('updates vaults through the password-manager vault endpoint and preserves multiple custom sections', async () => {
    global.fetch.mockResolvedValueOnce(createJsonResponse({
      vault: {
        clientId: 'client-1',
        customSections: [
          {
            hasPassword: true,
            id: 'custom-1',
            label: 'Portal One',
            website: 'https://portal.example.com',
            username: 'portal-user',
          },
          {
            hasPassword: true,
            id: 'custom-2',
            label: 'Portal Two',
            website: 'https://portal-two.example.com',
            username: 'portal-two-user',
          },
        ],
        gst: { hasPassword: true, loginId: 'gst-user' },
        id: 'vault-1',
        it: { hasPassword: true, loginId: 'it-user' },
        sectionOrder: ['custom:custom-1', 'custom:custom-2'],
      },
    }))

    const result = await updatePasswordVault(
      'vault-1',
      {
        clientId: 'client-1',
        customSections: [
          {
            id: 'custom-1',
            label: 'Portal One',
            username: 'portal-user',
            website: 'https://portal.example.com',
          },
          {
            id: 'custom-2',
            label: 'Portal Two',
            password: 'new-secret',
            username: 'portal-two-user',
            website: 'https://portal-two.example.com',
          },
        ],
        gst: { loginId: 'gst-user', website: 'https://services.gst.gov.in/services/login' },
        it: { loginId: 'it-user', website: 'https://www.incometax.gov.in' },
        sectionOrder: ['custom:custom-1', 'custom:custom-2'],
      },
      currentUser,
      selectedClient,
    )

    expect(String(global.fetch.mock.calls[0][0])).toContain('/api/password-manager')
    expect(String(global.fetch.mock.calls[0][0])).not.toContain('/credentials')
    expect(global.fetch.mock.calls[0][1].method).toBe('PUT')
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toMatchObject({
      active_optional_sections: ['custom_1', 'custom_2'],
      client_id: 'client-1',
      client_name: 'Example Client',
      custom_1_label: 'Portal One',
      custom_1_notes: 'https://portal.example.com',
      custom_1_username: 'portal-user',
      custom_2_label: 'Portal Two',
      custom_2_notes: 'https://portal-two.example.com',
      custom_2_password: 'new-secret',
      custom_2_username: 'portal-two-user',
      custom_label: 'Portal One',
      custom_notes: 'https://portal.example.com',
      custom_username: 'portal-user',
      email_id: 'ops@example.com',
      father_name: '',
      gst_login_id: 'gst-user',
      gst_number: '22AAAAA0000A1Z5',
      it_login_id: 'it-user',
      pan_number: 'AAAAA0000A',
      phone_number: '+91 9999999999',
      vault_id: 'vault-1',
    })
    expect(result.customSections).toHaveLength(2)
  })

  it('reveals and deletes vaults through the dedicated endpoint routes only', async () => {
    global.fetch
      .mockResolvedValueOnce(createJsonResponse({ plaintextPassword: 'top-secret' }))
      .mockResolvedValueOnce(createJsonResponse({ success: true }))

    const plaintextPassword = await revealPasswordField(
      'vault-1',
      'custom',
      'custom-2',
      'client-1',
      currentUser,
    )
    await deletePasswordVault('vault-1', 'client-1', currentUser)

    expect(plaintextPassword).toBe('top-secret')
    expect(String(global.fetch.mock.calls[0][0])).toContain('/api/password-manager/reveal?')
    expect(String(global.fetch.mock.calls[0][0])).not.toContain('/credentials')
    expect(global.fetch.mock.calls[0][1].method).toBe('POST')
    expect(global.fetch.mock.calls[0][1].body).toBeUndefined()
    expect(String(global.fetch.mock.calls[0][0])).toContain('clientId=client-1')
    expect(String(global.fetch.mock.calls[0][0])).toContain('vaultId=vault-1')
    expect(String(global.fetch.mock.calls[0][0])).toContain('field=custom_2_password')
    expect(String(global.fetch.mock.calls[1][0])).toContain('/api/password-manager?clientId=client-1&vaultId=vault-1')
    expect(String(global.fetch.mock.calls[1][0])).not.toContain('/credentials')
    expect(global.fetch.mock.calls[1][1].method).toBe('DELETE')
  })

  it('surfaces nested endpoint detail messages when requests fail', async () => {
    global.fetch.mockResolvedValueOnce(
      createJsonResponse(
        { detail: { code: 'validation_error', message: 'Client id is required' } },
        { ok: false, status: 422 },
      ),
    )

    await expect(
      createPasswordVault('client-1', { clientId: '' }, currentUser, selectedClient),
    ).rejects.toThrow('Client id is required')
  })
})
