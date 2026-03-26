import { describe, expect, it } from 'vitest'
import {
  decryptSecret,
  encryptSecret,
  hasEncryptedSecret,
  resolvePasswordManagerKey,
} from './passwordManagerCrypto'

describe('passwordManagerCrypto', () => {
  it('derives a stable 32-byte encryption key from the configured secret', () => {
    expect(resolvePasswordManagerKey('local-test-secret')).toHaveLength(32)
    expect(resolvePasswordManagerKey('local-test-secret')).toEqual(resolvePasswordManagerKey('local-test-secret'))
  })

  it('encrypts and decrypts a password-manager secret with AES-256-GCM', () => {
    const encrypted = encryptSecret('super-secret-password', 'local-test-secret')

    expect(hasEncryptedSecret(encrypted)).toBe(true)
    expect(decryptSecret(encrypted, 'local-test-secret')).toBe('super-secret-password')
  })
})
