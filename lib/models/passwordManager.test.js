import { describe, expect, it } from 'vitest'
import { PasswordVault } from './passwordManager'

describe('PasswordVault model', () => {
  it('enforces one vault per owner and client via a unique index', () => {
    expect(PasswordVault.schema.indexes()).toEqual(
      expect.arrayContaining([
        expect.arrayContaining([
          {
            'owner.userId': 1,
            clientId: 1,
          },
          expect.objectContaining({ unique: true }),
        ]),
      ]),
    )
  })
})
