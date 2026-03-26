import crypto from 'crypto'

/**
 * Returns whether an encrypted secret payload contains the fields needed for decryption.
 *
 * @param {object | null | undefined} payload - Stored encrypted secret payload.
 * @returns {boolean} True when the payload appears usable.
 */
export function hasEncryptedSecret(payload) {
  return Boolean(
    payload &&
      typeof payload === 'object' &&
      payload.iv &&
      payload.authTag &&
      payload.cipherText,
  )
}

/**
 * Derives the AES-256-GCM key used for password-manager secrets.
 *
 * @param {string} [secretValue=process.env.PASSWORD_MANAGER_ENCRYPTION_KEY] - Raw secret configured by the environment.
 * @returns {Buffer} A 32-byte encryption key.
 */
export function resolvePasswordManagerKey(
  secretValue = process.env.PASSWORD_MANAGER_ENCRYPTION_KEY || '',
) {
  const normalizedSecret = String(secretValue || '')

  if (!normalizedSecret) {
    throw new Error('PASSWORD_MANAGER_ENCRYPTION_KEY is not configured.')
  }

  return crypto.createHash('sha256').update(normalizedSecret, 'utf8').digest()
}

/**
 * Encrypts a plaintext secret for storage at rest.
 *
 * @param {string} plaintext - Plaintext secret to encrypt.
 * @param {string} [secretValue=process.env.PASSWORD_MANAGER_ENCRYPTION_KEY] - Optional override for tests.
 * @returns {object | null} Encrypted payload or null when no plaintext was provided.
 */
export function encryptSecret(
  plaintext,
  secretValue = process.env.PASSWORD_MANAGER_ENCRYPTION_KEY || '',
) {
  const normalizedPlaintext = typeof plaintext === 'string' ? plaintext : String(plaintext || '')

  if (!normalizedPlaintext) {
    return null
  }

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', resolvePasswordManagerKey(secretValue), iv)
  const cipherText = Buffer.concat([
    cipher.update(normalizedPlaintext, 'utf8'),
    cipher.final(),
  ]).toString('base64')

  return {
    authTag: cipher.getAuthTag().toString('base64'),
    cipherText,
    iv: iv.toString('base64'),
  }
}

/**
 * Decrypts an encrypted password-manager secret.
 *
 * @param {object | null | undefined} payload - Stored encrypted payload.
 * @param {string} [secretValue=process.env.PASSWORD_MANAGER_ENCRYPTION_KEY] - Optional override for tests.
 * @returns {string} Decrypted plaintext value, or an empty string when no secret exists.
 */
export function decryptSecret(
  payload,
  secretValue = process.env.PASSWORD_MANAGER_ENCRYPTION_KEY || '',
) {
  if (!hasEncryptedSecret(payload)) {
    return ''
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    resolvePasswordManagerKey(secretValue),
    Buffer.from(payload.iv, 'base64'),
  )

  decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'))

  return Buffer.concat([
    decipher.update(Buffer.from(payload.cipherText, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}
