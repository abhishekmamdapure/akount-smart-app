import { describe, expect, it } from 'vitest'
import {
  CLIENT_AVATAR_COLOR_PALETTE,
  CLIENT_CARD_PAGE_SIZE,
  CLIENT_CARD_SUMMARY_FALLBACK,
  buildClientSearchIndex,
  filterClientsByQuery,
  formatClientCardSummary,
  formatClientCountBadge,
  formatClientDate,
  getClientAvatarTone,
  getClientInitials,
  paginateClients,
} from './clientManagementHelpers'

describe('clientManagementHelpers', () => {
  it('builds a search index that includes all client identity and location fields', () => {
    const client = {
      name: 'Example Industries',
      tradeName: 'Retail Ops',
      gst: '27ABCDE1234F1Z5',
      pan: 'ABCDE1234F',
      email: 'ops@example.com',
      phone: '+91 9876543210',
      address: '42 Business Park, Mumbai, Maharashtra, 400001',
      addressLine: '42 Business Park',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
    }

    const searchIndex = buildClientSearchIndex(client)

    expect(searchIndex).toContain('example industries')
    expect(searchIndex).toContain('retail ops')
    expect(searchIndex).toContain('27abcde1234f1z5')
    expect(searchIndex).toContain('abcde1234f')
    expect(searchIndex).toContain('ops@example.com')
    expect(searchIndex).toContain('+91 9876543210')
    expect(searchIndex).toContain('42 business park')
    expect(searchIndex).toContain('mumbai')
    expect(searchIndex).toContain('maharashtra')
    expect(searchIndex).toContain('400001')
    expect(filterClientsByQuery([client], 'retail ops')).toEqual([client])
  })

  it('derives deterministic initials and avatar tones for client cards', () => {
    const avatarTone = getClientAvatarTone('Skyline Analytics Ltd')

    expect(getClientInitials('Skyline Analytics Ltd')).toBe('SA')
    expect(getClientInitials('Acme')).toBe('A')
    expect(avatarTone).toBe(getClientAvatarTone('Skyline Analytics Ltd'))
    expect(CLIENT_AVATAR_COLOR_PALETTE).toContain(avatarTone)
    expect(formatClientCountBadge(7)).toBe('#07')
    expect(formatClientDate('2026-03-24T00:00:00.000Z')).toBe('24 Mar 2026')
  })

  it('formats the compact client card summary using trade name, city, and pincode', () => {
    expect(
      formatClientCardSummary({
        tradeName: 'Retail Ops',
        city: 'Mumbai',
        pincode: '400001',
      }),
    ).toBe('Retail Ops, Mumbai, 400001')

    expect(formatClientCardSummary({ city: 'Pune' })).toBe('Pune')
    expect(formatClientCardSummary({})).toBe(CLIENT_CARD_SUMMARY_FALLBACK)
  })

  it('paginates client cards using the sixteen-card mockup layout', () => {
    const clients = Array.from({ length: CLIENT_CARD_PAGE_SIZE + 4 }, (_, index) => ({
      id: `client-${index + 1}`,
      name: `Client ${index + 1}`,
    }))

    const firstPage = paginateClients(clients, 1)
    const overflowPage = paginateClients(clients, 99)

    expect(firstPage.totalPages).toBe(2)
    expect(firstPage.pageItems).toHaveLength(CLIENT_CARD_PAGE_SIZE)
    expect(firstPage.startItemNumber).toBe(1)
    expect(firstPage.endItemNumber).toBe(CLIENT_CARD_PAGE_SIZE)
    expect(overflowPage.currentPage).toBe(2)
    expect(overflowPage.pageItems).toHaveLength(4)
    expect(overflowPage.startItemNumber).toBe(17)
    expect(overflowPage.endItemNumber).toBe(20)
  })
})
