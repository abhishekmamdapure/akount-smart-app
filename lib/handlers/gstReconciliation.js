import { connectDB } from '../mongodb.js'
import { normalizeOwnerPayload, validateOwnerPayload } from '../models/client.js'
import { GST_RECONCILIATION_COLLECTION } from '../models/gstReconciliation.js'
import {
  createGstReconciliationJob,
  listGstReconciliationJobs,
  updateGstReconciliationJob,
} from '../services/gstReconciliation.js'

function getOwnerFromRequest(req) {
  return normalizeOwnerPayload({
    userId: req.headers['x-user-id'],
    email: req.headers['x-user-email'],
  })
}

export async function handleGstReconciliationRequest(req, res, { enableCors = false } = {}) {
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
    return res.status(401).json({ error: ownerValidationError, collection: GST_RECONCILIATION_COLLECTION })
  }

  try {
    await connectDB()
  } catch (error) {
    console.error('Mongo connection error:', error)
    return res
      .status(500)
      .json({ error: 'Unable to connect to the database.', collection: GST_RECONCILIATION_COLLECTION })
  }

  if (req.method === 'GET') {
    try {
      const result = await listGstReconciliationJobs(owner, req.query?.clientId)

      if (result.validationError) {
        return res.status(400).json({ error: result.validationError, collection: GST_RECONCILIATION_COLLECTION })
      }

      if (result.notFound) {
        return res.status(404).json({ error: result.notFound, collection: GST_RECONCILIATION_COLLECTION })
      }

      return res.status(200).json({
        collection: GST_RECONCILIATION_COLLECTION,
        items: result.items,
      })
    } catch (error) {
      console.error('Failed to fetch GST reconciliation history:', error)
      return res
        .status(500)
        .json({ error: 'Unable to fetch GST reconciliation history.', collection: GST_RECONCILIATION_COLLECTION })
    }
  }

  if (req.method === 'POST') {
    try {
      const result = await createGstReconciliationJob(owner, req.body)

      if (result.validationError) {
        return res.status(400).json({ error: result.validationError, collection: GST_RECONCILIATION_COLLECTION })
      }

      if (result.notFound) {
        return res.status(404).json({ error: result.notFound, collection: GST_RECONCILIATION_COLLECTION })
      }

      return res.status(201).json(result)
    } catch (error) {
      console.error('Failed to create GST reconciliation history entry:', error)
      return res.status(500).json({
        error: error.message || 'Unable to create GST reconciliation history entry.',
        collection: GST_RECONCILIATION_COLLECTION,
      })
    }
  }

  if (req.method === 'PUT') {
    try {
      const result = await updateGstReconciliationJob(owner, req.body, {
        authorizationHeader: req.headers.authorization || '',
      })

      if (result.validationError) {
        return res.status(400).json({ error: result.validationError, collection: GST_RECONCILIATION_COLLECTION })
      }

      if (result.notFound) {
        return res.status(404).json({ error: result.notFound, collection: GST_RECONCILIATION_COLLECTION })
      }

      return res.status(200).json(result)
    } catch (error) {
      console.error('Failed to update GST reconciliation history entry:', error)
      return res.status(500).json({
        error: error.message || 'Unable to update GST reconciliation history entry.',
        collection: GST_RECONCILIATION_COLLECTION,
      })
    }
  }

  return res.status(405).json({ error: 'Method not allowed', collection: GST_RECONCILIATION_COLLECTION })
}
