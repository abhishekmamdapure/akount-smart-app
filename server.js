import express from 'express'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { connectDB } from './lib/mongodb.js'
import { handleGstReconciliationRequest } from './lib/handlers/gstReconciliation.js'
import { handleInvoiceProcessingRequest } from './lib/handlers/invoiceProcessing.js'
import { handleTallyXmlConversionRequest } from './lib/handlers/tallyXmlConversion.js'
import { handlePdfToolsUsageRequest } from './lib/handlers/pdfToolsUsage.js'
import {
  handlePasswordManagerRequest,
  handlePasswordManagerRevealRequest,
} from './lib/passwordManagerHandler.js'
import {
  CLIENT_CRM_COLLECTION,
  normalizeClientPayload,
  normalizeOwnerPayload,
  validateClientPayload,
  validateOwnerPayload,
} from './lib/models/client.js'
import { USER_COLLECTION } from './lib/models/user.js'
import {
  createClientForOwner,
  deleteClientForOwner,
  getWorkspaceClientsForOwner,
  updateClientForOwner,
} from './lib/services/clientWorkspace.js'
import { getOrCreateUserSettings, updateUserSettings } from './lib/services/userSettings.js'
import { createWaitlistEntry, validateWaitlistEmail } from './lib/services/waitlist.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

try {
  const envFile = readFileSync(join(__dirname, '.env.local'), 'utf-8')
  envFile.split('\n').forEach((line) => {
    const [key, ...val] = line.split('=')

    if (key && !key.startsWith('#')) {
      process.env[key.trim()] = val.join('=').trim()
    }
  })
} catch {
  // .env.local not found
}

const app = express()
app.use(express.json())

function getOwnerFromHeaders(headers) {
  return normalizeOwnerPayload({
    userId: headers['x-user-id'],
    email: headers['x-user-email'],
  })
}

function getClientIdFromRequest(req) {
  return String(req.body?.clientId ?? req.query?.clientId ?? '').trim()
}

async function startServer() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set in .env.local')
    process.exit(1)
  }

  console.log('Connecting to MongoDB...')

  try {
    await connectDB()
    console.log('MongoDB connected successfully')
  } catch (error) {
    console.error('MongoDB connection failed:')
    console.error('Message:', error.message)
    process.exit(1)
  }

  app.post('/api/waitlist', async (req, res) => {
    const { email } = req.body || {}

    if (!email || !validateWaitlistEmail(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' })
    }

    try {
      const entry = await createWaitlistEntry(email)

      return res.status(201).json({
        success: true,
        message: "You're on the waitlist!",
        emailSent: entry.emailSent,
      })
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({ error: 'This email is already on the waitlist!' })
      }

      console.error('Save error:', error.message)
      return res.status(500).json({ error: 'Something went wrong. Please try again.' })
    }
  })

  app.get('/api/clients', async (req, res) => {
    const owner = getOwnerFromHeaders(req.headers)
    const ownerValidationError = validateOwnerPayload(owner)

    if (ownerValidationError) {
      return res.status(401).json({ error: ownerValidationError, collection: CLIENT_CRM_COLLECTION })
    }

    try {
      const clients = await getWorkspaceClientsForOwner(owner.userId)

      return res.status(200).json({ clients, collection: CLIENT_CRM_COLLECTION })
    } catch (error) {
      console.error('Fetch clients error:', error.message)
      return res.status(500).json({ error: 'Unable to fetch clients.', collection: CLIENT_CRM_COLLECTION })
    }
  })

  app.post('/api/clients', async (req, res) => {
    const owner = getOwnerFromHeaders(req.headers)
    const ownerValidationError = validateOwnerPayload(owner)

    if (ownerValidationError) {
      return res.status(401).json({ error: ownerValidationError, collection: CLIENT_CRM_COLLECTION })
    }

    const payload = normalizeClientPayload(req.body)
    const validationError = validateClientPayload(payload)

    if (validationError) {
      return res.status(400).json({ error: validationError, collection: CLIENT_CRM_COLLECTION })
    }

    try {
      const result = await createClientForOwner(owner, payload)

      if (result.conflict) {
        return res.status(409).json({ error: result.conflict, collection: CLIENT_CRM_COLLECTION })
      }

      if (result.error) {
        return res.status(500).json({ error: result.error, collection: CLIENT_CRM_COLLECTION })
      }

      console.info('[clients:create]', {
        collection: CLIENT_CRM_COLLECTION,
        ownerUserId: owner.userId,
        clientId: result.client.id,
        clientName: result.client.name,
      })

      return res.status(201).json({
        client: result.client,
        collection: CLIENT_CRM_COLLECTION,
      })
    } catch (error) {
      console.error('Create client error:', error.message)
      return res.status(500).json({ error: 'Unable to create client.', collection: CLIENT_CRM_COLLECTION })
    }
  })

  app.put('/api/clients', async (req, res) => {
    const owner = getOwnerFromHeaders(req.headers)
    const ownerValidationError = validateOwnerPayload(owner)

    if (ownerValidationError) {
      return res.status(401).json({ error: ownerValidationError, collection: CLIENT_CRM_COLLECTION })
    }

    const clientId = getClientIdFromRequest(req)
    const payload = normalizeClientPayload(req.body)
    const validationError = validateClientPayload(payload)

    if (!clientId) {
      return res.status(400).json({ error: 'Client id is required.', collection: CLIENT_CRM_COLLECTION })
    }

    if (validationError) {
      return res.status(400).json({ error: validationError, collection: CLIENT_CRM_COLLECTION })
    }

    try {
      const result = await updateClientForOwner(owner, clientId, payload)

      if (result.conflict) {
        return res.status(409).json({ error: result.conflict, collection: CLIENT_CRM_COLLECTION })
      }

      if (result.notFound) {
        return res.status(404).json({ error: result.notFound, collection: CLIENT_CRM_COLLECTION })
      }

      console.info('[clients:update]', {
        collection: CLIENT_CRM_COLLECTION,
        ownerUserId: owner.userId,
        clientId: result.client.id,
        clientName: result.client.name,
      })

      return res.status(200).json({
        client: result.client,
        collection: CLIENT_CRM_COLLECTION,
      })
    } catch (error) {
      console.error('Update client error:', error.message)
      return res.status(500).json({ error: 'Unable to update client.', collection: CLIENT_CRM_COLLECTION })
    }
  })

  app.delete('/api/clients', async (req, res) => {
    const owner = getOwnerFromHeaders(req.headers)
    const ownerValidationError = validateOwnerPayload(owner)

    if (ownerValidationError) {
      return res.status(401).json({ error: ownerValidationError, collection: CLIENT_CRM_COLLECTION })
    }

    const clientId = getClientIdFromRequest(req)

    if (!clientId) {
      return res.status(400).json({ error: 'Client id is required.', collection: CLIENT_CRM_COLLECTION })
    }

    try {
      const result = await deleteClientForOwner(owner, clientId)

      if (result.notFound) {
        return res.status(404).json({ error: result.notFound, collection: CLIENT_CRM_COLLECTION })
      }

      console.info('[clients:delete]', {
        collection: CLIENT_CRM_COLLECTION,
        ownerUserId: owner.userId,
        clientId: result.deletedClientId,
        clientName: result.deletedClientName,
      })

      return res.status(200).json({
        deletedClientId: result.deletedClientId,
        collection: CLIENT_CRM_COLLECTION,
      })
    } catch (error) {
      console.error('Delete client error:', error.message)
      return res.status(500).json({ error: 'Unable to delete client.', collection: CLIENT_CRM_COLLECTION })
    }
  })

  app.get('/api/user-settings', async (req, res) => {
    const owner = getOwnerFromHeaders(req.headers)
    const ownerValidationError = validateOwnerPayload(owner)

    if (ownerValidationError) {
      return res.status(401).json({ error: ownerValidationError, collection: USER_COLLECTION })
    }

    try {
      const result = await getOrCreateUserSettings(owner)

      return res.status(200).json({
        user: result.settings,
        usage: result.usage,
        collection: USER_COLLECTION,
      })
    } catch (error) {
      console.error('Fetch user settings error:', error.message)
      return res.status(500).json({ error: 'Unable to fetch user settings.', collection: USER_COLLECTION })
    }
  })

  app.put('/api/user-settings', async (req, res) => {
    const owner = getOwnerFromHeaders(req.headers)
    const ownerValidationError = validateOwnerPayload(owner)

    if (ownerValidationError) {
      return res.status(401).json({ error: ownerValidationError, collection: USER_COLLECTION })
    }

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
      console.error('Update user settings error:', error.message)
      return res.status(500).json({ error: 'Unable to update user settings.', collection: USER_COLLECTION })
    }
  })

  app.get('/api/gst-reconciliation', (req, res) => handleGstReconciliationRequest(req, res))
  app.post('/api/gst-reconciliation', (req, res) => handleGstReconciliationRequest(req, res))
  app.put('/api/gst-reconciliation', (req, res) => handleGstReconciliationRequest(req, res))
  app.get('/api/invoice-processing', (req, res) => handleInvoiceProcessingRequest(req, res))
  app.post('/api/invoice-processing', (req, res) => handleInvoiceProcessingRequest(req, res))
  app.put('/api/invoice-processing', (req, res) => handleInvoiceProcessingRequest(req, res))
  app.get('/api/password-manager', (req, res) => handlePasswordManagerRequest(req, res))
  app.post('/api/password-manager', (req, res) => handlePasswordManagerRequest(req, res))
  app.put('/api/password-manager', (req, res) => handlePasswordManagerRequest(req, res))
  app.delete('/api/password-manager', (req, res) => handlePasswordManagerRequest(req, res))
  app.post('/api/password-manager/reveal', (req, res) => handlePasswordManagerRevealRequest(req, res))
  app.get('/api/tally-xml', (req, res) => handleTallyXmlConversionRequest(req, res))
  app.post('/api/tally-xml', (req, res) => handleTallyXmlConversionRequest(req, res))
  app.put('/api/tally-xml', (req, res) => handleTallyXmlConversionRequest(req, res))
  app.get('/api/pdf-tools-usage', (req, res) => handlePdfToolsUsageRequest(req, res))
  app.post('/api/pdf-tools-usage', (req, res) => handlePdfToolsUsageRequest(req, res))

  app.listen(3001, () => {
    console.log('API server running at http://localhost:3001')
  })
}

startServer()





