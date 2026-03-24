import { connectDB } from '../mongodb.js'
import { normalizeOwnerPayload, validateOwnerPayload } from '../models/client.js'
import { TALLY_XML_CONVERSION_COLLECTION } from '../models/tallyXmlConversion.js'
import {
  createTallyXmlJob,
  listTallyXmlJobs,
  updateTallyXmlJob,
} from '../services/tallyXmlConversion.js'

function getOwnerFromRequest(req) {
  return normalizeOwnerPayload({
    userId: req.headers['x-user-id'],
    email: req.headers['x-user-email'],
  })
}

export async function handleTallyXmlConversionRequest(req, res, { enableCors = false } = {}) {
  if (enableCors) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, x-user-id, x-user-email')
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const owner = getOwnerFromRequest(req)
  const ownerValidationError = validateOwnerPayload(owner)

  if (ownerValidationError) {
    return res.status(401).json({ error: ownerValidationError, collection: TALLY_XML_CONVERSION_COLLECTION })
  }

  try {
    await connectDB()
  } catch (error) {
    console.error('Mongo connection error:', error)
    return res
      .status(500)
      .json({ error: 'Unable to connect to the database.', collection: TALLY_XML_CONVERSION_COLLECTION })
  }

  if (req.method === 'GET') {
    try {
      const result = await listTallyXmlJobs(owner, req.query?.clientId)

      if (result.validationError) {
        return res.status(400).json({ error: result.validationError, collection: TALLY_XML_CONVERSION_COLLECTION })
      }

      if (result.notFound) {
        return res.status(404).json({ error: result.notFound, collection: TALLY_XML_CONVERSION_COLLECTION })
      }

      return res.status(200).json({
        collection: TALLY_XML_CONVERSION_COLLECTION,
        items: result.items,
      })
    } catch (error) {
      console.error('Failed to fetch Tally XML history:', error)
      return res
        .status(500)
        .json({ error: 'Unable to fetch Tally XML history.', collection: TALLY_XML_CONVERSION_COLLECTION })
    }
  }

  if (req.method === 'POST') {
    try {
      const result = await createTallyXmlJob(owner, req.body)

      if (result.validationError) {
        return res.status(400).json({ error: result.validationError, collection: TALLY_XML_CONVERSION_COLLECTION })
      }

      if (result.notFound) {
        return res.status(404).json({ error: result.notFound, collection: TALLY_XML_CONVERSION_COLLECTION })
      }

      return res.status(201).json(result)
    } catch (error) {
      console.error('Failed to create Tally XML history entry:', error)
      return res.status(500).json({
        error: error.message || 'Unable to create Tally XML history entry.',
        collection: TALLY_XML_CONVERSION_COLLECTION,
      })
    }
  }

  if (req.method === 'PUT') {
    try {
      const result = await updateTallyXmlJob(owner, req.body, {
        authorizationHeader: req.headers.authorization || '',
      })

      if (result.validationError) {
        return res.status(400).json({ error: result.validationError, collection: TALLY_XML_CONVERSION_COLLECTION })
      }

      if (result.notFound) {
        return res.status(404).json({ error: result.notFound, collection: TALLY_XML_CONVERSION_COLLECTION })
      }

      return res.status(200).json(result)
    } catch (error) {
      console.error('Failed to update Tally XML history entry:', error)
      return res.status(500).json({
        error: error.message || 'Unable to update Tally XML history entry.',
        collection: TALLY_XML_CONVERSION_COLLECTION,
      })
    }
  }

  return res.status(405).json({ error: 'Method not allowed', collection: TALLY_XML_CONVERSION_COLLECTION })
}