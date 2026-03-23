import { connectDB } from '../lib/mongodb.js'
import { normalizeOwnerPayload, validateOwnerPayload } from '../lib/models/client.js'
import { USER_COLLECTION } from '../lib/models/user.js'
import { getOrCreateUserSettings, updateUserSettings } from '../lib/services/userSettings.js'

function getOwnerFromRequest(req) {
  return normalizeOwnerPayload({
    userId: req.headers['x-user-id'],
    email: req.headers['x-user-email'],
  })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-id, x-user-email')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const owner = getOwnerFromRequest(req)
  const ownerValidationError = validateOwnerPayload(owner)

  if (ownerValidationError) {
    return res.status(401).json({ error: ownerValidationError, collection: USER_COLLECTION })
  }

  try {
    await connectDB()
  } catch (error) {
    console.error('Mongo connection error:', error)
    return res.status(500).json({ error: 'Unable to connect to the database.', collection: USER_COLLECTION })
  }

  if (req.method === 'GET') {
    try {
      const result = await getOrCreateUserSettings(owner)

      return res.status(200).json({
        user: result.settings,
        usage: result.usage,
        collection: USER_COLLECTION,
      })
    } catch (error) {
      console.error('Failed to fetch user settings:', error)
      return res.status(500).json({ error: 'Unable to fetch user settings.', collection: USER_COLLECTION })
    }
  }

  if (req.method === 'PUT') {
    try {
      const result = await updateUserSettings(owner, req.body)

      if (result.validationError) {
        return res.status(400).json({ error: result.validationError, collection: USER_COLLECTION })
      }

      return res.status(200).json({
        user: result.settings,
        usage: result.usage,
        collection: USER_COLLECTION,
      })
    } catch (error) {
      console.error('Failed to update user settings:', error)
      return res.status(500).json({ error: 'Unable to update user settings.', collection: USER_COLLECTION })
    }
  }

  return res.status(405).json({ error: 'Method not allowed', collection: USER_COLLECTION })
}