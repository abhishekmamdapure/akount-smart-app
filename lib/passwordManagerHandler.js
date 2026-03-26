import { connectDB } from './mongodb.js'
import { normalizeOwnerPayload, validateOwnerPayload } from './models/client.js'
import { PASSWORD_MANAGER_COLLECTION } from './models/passwordManager.js'
import {
  createPasswordVault,
  deletePasswordVault,
  getPasswordVault,
  revealPasswordField,
  updatePasswordVault,
} from './services/passwordManager.js'

function getOwnerFromRequest(req) {
  return normalizeOwnerPayload({
    email: req.headers['x-user-email'],
    userId: req.headers['x-user-id'],
  })
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-id, x-user-email')
}

function sendError(res, result) {
  return res.status(result.status || 500).json({
    code: result.code || 'PASSWORD_MANAGER_UNKNOWN_ERROR',
    collection: PASSWORD_MANAGER_COLLECTION,
    error: result.error || 'Unable to complete the password-manager request.',
  })
}

/**
 * Handles CRUD requests for password-manager vaults.
 *
 * @param {import('express').Request} req - Incoming HTTP request.
 * @param {import('express').Response} res - HTTP response.
 * @param {object} [options={}] - Handler options.
 * @param {boolean} [options.enableCors=false] - Enables permissive CORS headers for serverless use.
 * @returns {Promise<import('express').Response | void>} HTTP response.
 */
export async function handlePasswordManagerRequest(req, res, { enableCors = false } = {}) {
  if (enableCors) {
    setCorsHeaders(res)
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const owner = getOwnerFromRequest(req)
  const ownerValidationError = validateOwnerPayload(owner)

  if (ownerValidationError) {
    return res.status(401).json({
      code: 'PASSWORD_MANAGER_OWNER_INVALID',
      collection: PASSWORD_MANAGER_COLLECTION,
      error: ownerValidationError,
    })
  }

  try {
    await connectDB()
  } catch (error) {
    console.error('Mongo connection error:', error)
    return res.status(500).json({
      code: 'PASSWORD_MANAGER_DB_UNAVAILABLE',
      collection: PASSWORD_MANAGER_COLLECTION,
      error: 'Unable to connect to the database.',
    })
  }

  try {
    if (req.method === 'GET') {
      const result = await getPasswordVault(owner, req.query?.clientId)
      return result.code ? sendError(res, result) : res.status(200).json(result)
    }

    if (req.method === 'POST') {
      const result = await createPasswordVault(owner, req.body)
      return result.code ? sendError(res, result) : res.status(201).json(result)
    }

    if (req.method === 'PUT') {
      const result = await updatePasswordVault(owner, req.body)
      return result.code ? sendError(res, result) : res.status(200).json(result)
    }

    if (req.method === 'DELETE') {
      const result = await deletePasswordVault(owner, req.query?.clientId, req.query?.vaultId)
      return result.code ? sendError(res, result) : res.status(200).json(result)
    }
  } catch (error) {
    console.error('Password-manager request failed:', error)
    return res.status(500).json({
      code: 'PASSWORD_MANAGER_REQUEST_FAILED',
      collection: PASSWORD_MANAGER_COLLECTION,
      error: error.message || 'Unable to complete the password-manager request.',
    })
  }

  return res.status(405).json({
    code: 'PASSWORD_MANAGER_METHOD_NOT_ALLOWED',
    collection: PASSWORD_MANAGER_COLLECTION,
    error: 'Method not allowed.',
  })
}

/**
 * Handles password reveal requests for password-manager vaults.
 *
 * @param {import('express').Request} req - Incoming HTTP request.
 * @param {import('express').Response} res - HTTP response.
 * @param {object} [options={}] - Handler options.
 * @param {boolean} [options.enableCors=false] - Enables permissive CORS headers for serverless use.
 * @returns {Promise<import('express').Response | void>} HTTP response.
 */
export async function handlePasswordManagerRevealRequest(req, res, { enableCors = false } = {}) {
  if (enableCors) {
    setCorsHeaders(res)
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const owner = getOwnerFromRequest(req)
  const ownerValidationError = validateOwnerPayload(owner)

  if (ownerValidationError) {
    return res.status(401).json({
      code: 'PASSWORD_MANAGER_OWNER_INVALID',
      collection: PASSWORD_MANAGER_COLLECTION,
      error: ownerValidationError,
    })
  }

  try {
    await connectDB()
  } catch (error) {
    console.error('Mongo connection error:', error)
    return res.status(500).json({
      code: 'PASSWORD_MANAGER_DB_UNAVAILABLE',
      collection: PASSWORD_MANAGER_COLLECTION,
      error: 'Unable to connect to the database.',
    })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      code: 'PASSWORD_MANAGER_METHOD_NOT_ALLOWED',
      collection: PASSWORD_MANAGER_COLLECTION,
      error: 'Method not allowed.',
    })
  }

  try {
    const result = await revealPasswordField(owner, req.body)

    return result.code ? sendError(res, result) : res.status(200).json(result)
  } catch (error) {
    console.error('Password-manager reveal failed:', error)
    return res.status(500).json({
      code: 'PASSWORD_MANAGER_REVEAL_FAILED',
      collection: PASSWORD_MANAGER_COLLECTION,
      error: error.message || 'Unable to reveal the requested password.',
    })
  }
}
