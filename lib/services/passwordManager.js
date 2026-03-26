import { ClientWorkspace } from '../models/client.js'
import { PASSWORD_MANAGER_COLLECTION, PasswordVault } from '../models/passwordManager.js'
import { decryptSecret, encryptSecret, hasEncryptedSecret } from './passwordManagerCrypto.js'
import {
  buildPasswordVaultQuery,
  buildRevealTarget,
  normalizePasswordVaultPayload,
  serializeClientBasicInfo,
} from './passwordManagerHelpers.js'

function toPlainObject(value) {
  if (!value) {
    return {}
  }

  return value.toObject ? value.toObject() : value
}

function buildServiceError(code, error, status) {
  return { code, error, status }
}

async function findOwnedClient(ownerUserId, clientId) {
  const workspace = await ClientWorkspace.findOne(
    {
      'owner.userId': ownerUserId,
      'clients._id': clientId,
    },
    {
      clients: {
        $elemMatch: { _id: clientId },
      },
    },
  ).lean()

  return workspace?.clients?.[0] || null
}

function serializeCredentialSection(section, { includeCode = false, includeEnabled = false } = {}) {
  const normalizedSection = toPlainObject(section)
  const serialized = {
    hasPassword: hasEncryptedSecret(normalizedSection.password),
    loginId: normalizedSection.loginId || '',
  }

  if (includeCode) {
    serialized.code = normalizedSection.code || ''
  }

  if (includeEnabled) {
    serialized.enabled = Boolean(normalizedSection.enabled)
  }

  return serialized
}

async function serializePasswordVault(document, client) {
  const vault = toPlainObject(document)

  return {
    basicInfo: serializeClientBasicInfo(client),
    clientId: vault.clientId,
    createdAt: vault.createdAt,
    customSections: Array.isArray(vault.customSections)
      ? vault.customSections.map((section) => ({
          hasPassword: hasEncryptedSecret(section.password),
          id: section.id,
          label: section.label || '',
          notes: section.notes || '',
          username: section.username || '',
        }))
      : [],
    einvoice: serializeCredentialSection(vault.einvoice, { includeEnabled: true }),
    epf: serializeCredentialSection(vault.epf, { includeCode: true, includeEnabled: true }),
    eway: serializeCredentialSection(vault.eway, { includeEnabled: true }),
    fatherName: vault.fatherName || '',
    gst: serializeCredentialSection(vault.gst),
    id: String(vault._id),
    it: serializeCredentialSection(vault.it),
    sectionOrder: Array.isArray(vault.sectionOrder) ? vault.sectionOrder : [],
    updatedAt: vault.updatedAt,
  }
}

function applyFixedSection(targetSection, incomingSection) {
  targetSection.loginId = incomingSection.loginId

  if (incomingSection.password !== undefined && incomingSection.password) {
    targetSection.password = encryptSecret(incomingSection.password)
  }
}

function applyOptionalSection(targetSection, incomingSection) {
  if (!incomingSection.enabled) {
    targetSection.enabled = false
    targetSection.loginId = ''
    targetSection.password = null
    return
  }

  targetSection.enabled = true
  targetSection.loginId = incomingSection.loginId

  if (incomingSection.password !== undefined && incomingSection.password) {
    targetSection.password = encryptSecret(incomingSection.password)
  }
}

function applyEpfSection(targetSection, incomingSection) {
  if (!incomingSection.enabled) {
    targetSection.code = ''
    targetSection.enabled = false
    targetSection.loginId = ''
    targetSection.password = null
    return
  }

  targetSection.code = incomingSection.code
  targetSection.enabled = true
  targetSection.loginId = incomingSection.loginId

  if (incomingSection.password !== undefined && incomingSection.password) {
    targetSection.password = encryptSecret(incomingSection.password)
  }
}

function mergeCustomSections(existingSections, incomingSections) {
  const existingById = new Map(
    (Array.isArray(existingSections) ? existingSections : []).map((section) => [section.id, section]),
  )

  return incomingSections.map((section) => {
    const existingSection = existingById.get(section.id)
    const nextSection = {
      id: section.id,
      label: section.label,
      notes: section.notes,
      password: existingSection?.password || null,
      username: section.username,
    }

    if (section.password !== undefined && section.password) {
      nextSection.password = encryptSecret(section.password)
    }

    return nextSection
  })
}

function readSecretForReveal(vault, target) {
  if (target.field === 'custom') {
    const customSection = Array.isArray(vault.customSections)
      ? vault.customSections.find((section) => section.id === target.customSectionId)
      : null

    return customSection?.password || null
  }

  return vault[target.field]?.password || null
}

/**
 * Loads the selected client's password vault for the signed-in owner.
 *
 * @param {object} owner - Signed-in owner metadata.
 * @param {string} clientId - Selected client id.
 * @returns {Promise<object>} Serialized vault response or a structured service error.
 */
export async function getPasswordVault(owner, clientId) {
  const normalizedClientId = String(clientId || '').trim()

  if (!normalizedClientId) {
    return buildServiceError('PASSWORD_MANAGER_CLIENT_REQUIRED', 'Client id is required.', 400)
  }

  const ownedClient = await findOwnedClient(owner.userId, normalizedClientId)

  if (!ownedClient) {
    return buildServiceError('PASSWORD_MANAGER_CLIENT_NOT_FOUND', 'Client not found for this user.', 404)
  }

  const vault = await PasswordVault.findOne(buildPasswordVaultQuery(owner.userId, normalizedClientId)).lean()

  return {
    collection: PASSWORD_MANAGER_COLLECTION,
    vault: vault ? await serializePasswordVault(vault, ownedClient) : null,
  }
}

/**
 * Creates a new password vault for the selected client.
 *
 * @param {object} owner - Signed-in owner metadata.
 * @param {object} payload - Incoming create payload.
 * @returns {Promise<object>} Serialized vault response or a structured service error.
 */
export async function createPasswordVault(owner, payload = {}) {
  const { data, errors } = normalizePasswordVaultPayload(payload, { requireClientId: true })

  if (errors.length > 0) {
    return buildServiceError('PASSWORD_MANAGER_VALIDATION_ERROR', errors[0], 400)
  }

  const ownedClient = await findOwnedClient(owner.userId, data.clientId)

  if (!ownedClient) {
    return buildServiceError('PASSWORD_MANAGER_CLIENT_NOT_FOUND', 'Client not found for this user.', 404)
  }

  const existingVault = await PasswordVault.findOne(buildPasswordVaultQuery(owner.userId, data.clientId)).lean()

  if (existingVault) {
    return buildServiceError(
      'PASSWORD_MANAGER_VAULT_EXISTS',
      'A password vault already exists for this client.',
      409,
    )
  }

  const vault = new PasswordVault({
    clientId: data.clientId,
    fatherName: data.fatherName,
    owner: {
      email: owner.email,
      lastSeenAt: new Date(),
      userId: owner.userId,
    },
    sectionOrder: data.sectionOrder,
  })

  applyFixedSection(vault.it, data.it)
  applyFixedSection(vault.gst, data.gst)
  applyOptionalSection(vault.eway, data.eway)
  applyOptionalSection(vault.einvoice, data.einvoice)
  applyEpfSection(vault.epf, data.epf)
  vault.customSections = mergeCustomSections([], data.customSections)

  try {
    await vault.save()
  } catch (error) {
    if (error?.code === 11000) {
      return buildServiceError(
        'PASSWORD_MANAGER_VAULT_EXISTS',
        'A password vault already exists for this client.',
        409,
      )
    }

    throw error
  }

  return {
    collection: PASSWORD_MANAGER_COLLECTION,
    vault: await serializePasswordVault(vault, ownedClient),
  }
}

/**
 * Updates an existing password vault for the signed-in owner.
 *
 * @param {object} owner - Signed-in owner metadata.
 * @param {object} payload - Incoming update payload.
 * @returns {Promise<object>} Serialized vault response or a structured service error.
 */
export async function updatePasswordVault(owner, payload = {}) {
  const vaultId = String(payload.vaultId || '').trim()

  if (!vaultId) {
    return buildServiceError('PASSWORD_MANAGER_VAULT_ID_REQUIRED', 'Vault id is required.', 400)
  }

  const { data, errors } = normalizePasswordVaultPayload(payload, { requireClientId: false })

  if (errors.length > 0) {
    return buildServiceError('PASSWORD_MANAGER_VALIDATION_ERROR', errors[0], 400)
  }

  const vault = await PasswordVault.findOne({
    _id: vaultId,
    'owner.userId': owner.userId,
  })

  if (!vault) {
    return buildServiceError('PASSWORD_MANAGER_VAULT_NOT_FOUND', 'Password vault not found.', 404)
  }

  const ownedClient = await findOwnedClient(owner.userId, vault.clientId)

  if (!ownedClient) {
    return buildServiceError('PASSWORD_MANAGER_CLIENT_NOT_FOUND', 'Client not found for this user.', 404)
  }

  vault.owner.lastSeenAt = new Date()
  vault.fatherName = data.fatherName
  vault.sectionOrder = data.sectionOrder

  applyFixedSection(vault.it, data.it)
  applyFixedSection(vault.gst, data.gst)
  applyOptionalSection(vault.eway, data.eway)
  applyOptionalSection(vault.einvoice, data.einvoice)
  applyEpfSection(vault.epf, data.epf)
  vault.customSections = mergeCustomSections(vault.customSections, data.customSections)

  await vault.save()

  return {
    collection: PASSWORD_MANAGER_COLLECTION,
    vault: await serializePasswordVault(vault, ownedClient),
  }
}

/**
 * Deletes a password vault owned by the signed-in user.
 *
 * @param {object} owner - Signed-in owner metadata.
 * @param {string} clientId - Selected client id.
 * @param {string} vaultId - Vault id to remove.
 * @returns {Promise<object>} Delete result or a structured service error.
 */
export async function deletePasswordVault(owner, clientId, vaultId) {
  const normalizedClientId = String(clientId || '').trim()
  const normalizedVaultId = String(vaultId || '').trim()

  if (!normalizedClientId) {
    return buildServiceError('PASSWORD_MANAGER_CLIENT_REQUIRED', 'Client id is required.', 400)
  }

  if (!normalizedVaultId) {
    return buildServiceError('PASSWORD_MANAGER_VAULT_ID_REQUIRED', 'Vault id is required.', 400)
  }

  const deletedVault = await PasswordVault.findOneAndDelete(
    buildPasswordVaultQuery(owner.userId, normalizedClientId, normalizedVaultId),
  ).lean()

  if (!deletedVault) {
    return buildServiceError('PASSWORD_MANAGER_VAULT_NOT_FOUND', 'Password vault not found.', 404)
  }

  return {
    collection: PASSWORD_MANAGER_COLLECTION,
    deletedVaultId: normalizedVaultId,
  }
}

/**
 * Reveals one stored password for the selected client vault.
 *
 * @param {object} owner - Signed-in owner metadata.
 * @param {object} payload - Reveal payload with vault and field identifiers.
 * @returns {Promise<object>} Plaintext password response or a structured service error.
 */
export async function revealPasswordField(owner, payload = {}) {
  const clientId = String(payload.clientId || '').trim()
  const vaultId = String(payload.vaultId || '').trim()
  const target = buildRevealTarget(payload.field, payload.customSectionId)

  if (!clientId) {
    return buildServiceError('PASSWORD_MANAGER_CLIENT_REQUIRED', 'Client id is required.', 400)
  }

  if (!vaultId) {
    return buildServiceError('PASSWORD_MANAGER_VAULT_ID_REQUIRED', 'Vault id is required.', 400)
  }

  if (target.error) {
    return buildServiceError('PASSWORD_MANAGER_REVEAL_FIELD_INVALID', target.error, 400)
  }

  const vault = await PasswordVault.findOne(buildPasswordVaultQuery(owner.userId, clientId, vaultId)).lean()

  if (!vault) {
    return buildServiceError('PASSWORD_MANAGER_VAULT_NOT_FOUND', 'Password vault not found.', 404)
  }

  const encryptedSecret = readSecretForReveal(vault, target)

  if (!hasEncryptedSecret(encryptedSecret)) {
    return buildServiceError('PASSWORD_MANAGER_SECRET_NOT_FOUND', 'No password is stored for this field.', 404)
  }

  return {
    collection: PASSWORD_MANAGER_COLLECTION,
    plaintextPassword: decryptSecret(encryptedSecret),
  }
}
