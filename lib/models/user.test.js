import { describe, expect, it } from 'vitest'
import {
  buildDefaultProfileFromOwner,
  normalizeUserProfilePayload,
  serializeUserSettings,
} from './user'

describe('user model helpers', () => {
  it('includes an empty state in the default profile payload', () => {
    expect(
      buildDefaultProfileFromOwner({
        email: 'owner@example.com',
      }),
    ).toMatchObject({
      state: '',
    })
  })

  it('normalizes state alongside the rest of the profile fields', () => {
    expect(
      normalizeUserProfilePayload({
        address: ' 42 Business Park, Mumbai ',
        firstName: '  Neeta ',
        gst: ' 27abcde1234f1z5 ',
        lastName: ' Ambani ',
        pan: ' abcde1234f ',
        phone: '+91 98765 43210',
        photoUrl: ' https://example.com/photo.png ',
        state: ' Maharashtra ',
      }),
    ).toEqual({
      address: '42 Business Park, Mumbai',
      firstName: 'Neeta',
      gst: '27ABCDE1234F1Z5',
      lastName: 'Ambani',
      pan: 'ABCDE1234F',
      phone: '+91 9876543210',
      photoUrl: 'https://example.com/photo.png',
      state: 'Maharashtra',
    })
  })

  it('serializes the stored user state for account settings', () => {
    expect(
      serializeUserSettings({
        owner: {
          email: 'owner@example.com',
          lastSeenAt: '2026-03-27T00:00:00.000Z',
          uniqueId: 'owner1234',
          userId: 'user-1',
        },
        plan: {
          clientLimit: 10,
          name: 'Basic Plan',
        },
        profile: {
          address: '42 Business Park, Mumbai',
          firstName: 'Neeta',
          gst: '',
          lastName: 'Ambani',
          pan: '',
          phone: '+91 9876543210',
          photoUrl: '',
          state: 'Maharashtra',
        },
        updatedAt: '2026-03-27T01:00:00.000Z',
      }).profile.state,
    ).toBe('Maharashtra')
  })
})
