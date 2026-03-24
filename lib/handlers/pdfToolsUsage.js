import { connectDB } from '../mongodb.js'
import { normalizeOwnerPayload, validateOwnerPayload } from '../models/client.js'
import { PDF_TOOLS_USAGE_COLLECTION } from '../models/pdfToolsUsage.js'
import { createPdfToolsUsage, listPdfToolsUsage } from '../services/pdfToolsUsage.js'

function getOwnerFromRequest(req) {
  return normalizeOwnerPayload({
    userId: req.headers['x-user-id'],
    email: req.headers['x-user-email'],
  })
}

export async function handlePdfToolsUsageRequest(req, res, { enableCors = false } = {}) {
  if (enableCors) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-id, x-user-email')
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const owner = getOwnerFromRequest(req)
  const ownerValidationError = validateOwnerPayload(owner)

  if (ownerValidationError) {
    return res.status(401).json({
      error: ownerValidationError,
      collection: PDF_TOOLS_USAGE_COLLECTION,
    })
  }

  try {
    await connectDB()
  } catch (error) {
    console.error('Mongo connection error:', error)
    return res.status(500).json({
      error: 'Unable to connect to the database.',
      collection: PDF_TOOLS_USAGE_COLLECTION,
    })
  }

  if (req.method === 'GET') {
    try {
      const result = await listPdfToolsUsage(owner, {
        limit: req.query?.limit,
      })

      return res.status(200).json({
        collection: PDF_TOOLS_USAGE_COLLECTION,
        items: result.items,
        totalsByTool: result.totalsByTool,
      })
    } catch (error) {
      console.error('Failed to fetch PDF tools usage:', error)
      return res.status(500).json({
        error: 'Unable to fetch PDF tools usage.',
        collection: PDF_TOOLS_USAGE_COLLECTION,
      })
    }
  }

  if (req.method === 'POST') {
    try {
      const result = await createPdfToolsUsage(owner, req.body)

      if (result.validationError) {
        return res.status(400).json({
          error: result.validationError,
          collection: PDF_TOOLS_USAGE_COLLECTION,
        })
      }

      return res.status(201).json({
        collection: PDF_TOOLS_USAGE_COLLECTION,
        entry: result.entry,
      })
    } catch (error) {
      console.error('Failed to create PDF tools usage entry:', error)
      return res.status(500).json({
        error: error.message || 'Unable to create PDF tools usage entry.',
        collection: PDF_TOOLS_USAGE_COLLECTION,
      })
    }
  }

  return res.status(405).json({
    error: 'Method not allowed',
    collection: PDF_TOOLS_USAGE_COLLECTION,
  })
}
