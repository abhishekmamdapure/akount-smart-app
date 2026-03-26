import { connectDB } from '../mongodb.js'
import { normalizeOwnerPayload, validateOwnerPayload } from '../models/client.js'
import { getDashboardSummary } from '../services/dashboardSummary.js'

/**
 * Extracts owner identity from request headers.
 *
 * @param {import('express').Request} req
 * @returns {{ userId: string, email: string }}
 */
function getOwnerFromRequest(req) {
  return normalizeOwnerPayload({
    userId: req.headers['x-user-id'],
    email: req.headers['x-user-email'],
  })
}

/**
 * Handles GET /api/dashboard-summary requests.
 * Returns aggregated dashboard data for the authenticated user.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {{ enableCors?: boolean }} options
 */
export async function handleDashboardSummaryRequest(req, res, { enableCors = false } = {}) {
  if (enableCors) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-id, x-user-email')
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const owner = getOwnerFromRequest(req)
  const ownerValidationError = validateOwnerPayload(owner)

  if (ownerValidationError) {
    return res.status(401).json({ error: ownerValidationError })
  }

  try {
    await connectDB()
  } catch (error) {
    console.error('Dashboard summary - Mongo connection error:', error)
    return res.status(500).json({ error: 'Unable to connect to the database.' })
  }

  try {
    const timeZone = String(req.query?.timeZone || 'UTC').trim()
    const summary = await getDashboardSummary(owner, timeZone)

    return res.status(200).json(summary)
  } catch (error) {
    console.error('Dashboard summary error:', error)
    return res.status(500).json({ error: 'Unable to fetch dashboard summary.' })
  }
}
