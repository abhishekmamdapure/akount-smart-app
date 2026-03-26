import { describe, expect, it } from 'vitest'
import {
  addCustomSection,
  buildSectionOrder,
  buildVaultPayload,
  removeOptionalSection,
  updateCustomSection,
} from './passwordManagerHelpers'

describe('passwordManagerHelpers', () => {
  it('normalizes section order against the current custom tabs', () => {
    expect(
      buildSectionOrder(
        ['custom:two', 'custom:missing', 'custom:one'],
        [{ id: 'one', label: 'Portal One' }, { id: 'two', label: 'Portal Two' }],
      ),
    ).toEqual(['custom:two', 'custom:one'])
  })

  it('removes custom sections and clears them from the ordered tabs', () => {
    const nextDraft = removeOptionalSection(
      {
        customSections: [
          { id: 'one', label: 'Portal One', password: '', username: '', website: '' },
          { id: 'two', label: 'Portal Two', password: '', username: '', website: '' },
        ],
        gst: { loginId: '', password: '', website: 'https://services.gst.gov.in/services/login' },
        it: { loginId: '', password: '', website: 'https://www.incometax.gov.in' },
        sectionOrder: ['custom:one', 'custom:two'],
      },
      'custom:one',
    )

    expect(nextDraft.customSections).toEqual([
      { id: 'two', label: 'Portal Two', password: '', username: '', website: '' },
    ])
    expect(nextDraft.sectionOrder).toEqual(['custom:two'])
  })

  it('updates custom section labels without affecting the rest of the draft', () => {
    const withCustomSection = addCustomSection(
      {
        customSections: [],
        gst: { loginId: '', password: '', website: 'https://services.gst.gov.in/services/login' },
        it: { loginId: '', password: '', website: 'https://www.incometax.gov.in' },
        sectionOrder: [],
      },
      'Portal One',
    )
    const customSectionId = withCustomSection.customSections[0].id
    const renamedDraft = updateCustomSection(withCustomSection, customSectionId, { label: 'Portal Two' })

    expect(renamedDraft.customSections[0].label).toBe('Portal Two')
    expect(renamedDraft.sectionOrder).toEqual(withCustomSection.sectionOrder)
  })

  it('omits blank edit passwords while keeping website values in the payload', () => {
    expect(
      buildVaultPayload(
        {
          customSections: [
            {
              id: 'one',
              label: 'Portal One',
              password: '',
              username: 'portal@example.com',
              website: 'https://portal.example.com',
            },
          ],
          gst: {
            loginId: 'gst-user',
            password: '',
            website: 'https://services.gst.gov.in/services/login',
          },
          it: {
            loginId: 'it-user',
            password: 'new-secret',
            website: 'https://www.incometax.gov.in',
          },
          sectionOrder: ['custom:one'],
        },
        { clientId: 'client-1', vaultId: 'vault-1' },
      ),
    ).toEqual({
      clientId: 'client-1',
      customSections: [
        {
          id: 'one',
          label: 'Portal One',
          username: 'portal@example.com',
          website: 'https://portal.example.com',
        },
      ],
      gst: {
        loginId: 'gst-user',
        website: 'https://services.gst.gov.in/services/login',
      },
      it: {
        loginId: 'it-user',
        password: 'new-secret',
        website: 'https://www.incometax.gov.in',
      },
      sectionOrder: ['custom:one'],
      vaultId: 'vault-1',
    })
  })
})
