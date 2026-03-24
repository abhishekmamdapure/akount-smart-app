import { connectDB } from '../mongodb.js'
import { normalizeOwnerPayload, validateOwnerPayload } from '../models/client.js'
import { INVOICE_PROCESSING_COLLECTION } from '../models/invoiceProcessing.js'
import {
  createInvoiceProcessingJob,
  listInvoiceProcessingJobs,
  updateInvoiceProcessingJob,
} from '../services/invoiceProcessing.js'

function getOwnerFromRequest(req) {
  return normalizeOwnerPayload({
    userId: req.headers['x-user-id'],
    email: req.headers['x-user-email'],
  })
}

export async function handleInvoiceProcessingRequest(req, res, { enableCors = false } = {}) {
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
    return res.status(401).json({ error: ownerValidationError, collection: INVOICE_PROCESSING_COLLECTION })
  }

  try {
    await connectDB()
  } catch (error) {
    console.error('Mongo connection error:', error)
    return res
      .status(500)
      .json({ error: 'Unable to connect to the database.', collection: INVOICE_PROCESSING_COLLECTION })
  }

  if (req.method === 'GET') {
    try {
      const result = await listInvoiceProcessingJobs(owner, req.query?.clientId)

      if (result.validationError) {
        return res.status(400).json({ error: result.validationError, collection: INVOICE_PROCESSING_COLLECTION })
      }

      if (result.notFound) {
        return res.status(404).json({ error: result.notFound, collection: INVOICE_PROCESSING_COLLECTION })
      }

      return res.status(200).json({
        collection: INVOICE_PROCESSING_COLLECTION,
        items: result.items,
      })
    } catch (error) {
      console.error('Failed to fetch invoice history:', error)
      return res
        .status(500)
        .json({ error: 'Unable to fetch invoice history.', collection: INVOICE_PROCESSING_COLLECTION })
    }
  }

  if (req.method === 'POST') {
    try {
      const result = await createInvoiceProcessingJob(owner, req.body)

      if (result.validationError) {
        return res.status(400).json({ error: result.validationError, collection: INVOICE_PROCESSING_COLLECTION })
      }

      if (result.notFound) {
        return res.status(404).json({ error: result.notFound, collection: INVOICE_PROCESSING_COLLECTION })
      }

      return res.status(201).json(result)
    } catch (error) {
      console.error('Failed to create invoice history entry:', error)
      return res
        .status(500)
        .json({ error: error.message || 'Unable to create invoice history entry.', collection: INVOICE_PROCESSING_COLLECTION })
    }
  }

  if (req.method === 'PUT') {
    try {
      const result = await updateInvoiceProcessingJob(owner, req.body, {
        authorizationHeader: req.headers.authorization || '',
      })

      if (result.validationError) {
        return res.status(400).json({ error: result.validationError, collection: INVOICE_PROCESSING_COLLECTION })
      }

      if (result.notFound) {
        return res.status(404).json({ error: result.notFound, collection: INVOICE_PROCESSING_COLLECTION })
      }

      return res.status(200).json(result)
    } catch (error) {
      console.error('Failed to update invoice history entry:', error)
      return res
        .status(500)
        .json({ error: error.message || 'Unable to update invoice history entry.', collection: INVOICE_PROCESSING_COLLECTION })
    }
  }

  return res.status(405).json({ error: 'Method not allowed', collection: INVOICE_PROCESSING_COLLECTION })
}
