import express from 'express'
import mongoose from 'mongoose'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { connectDB } from './lib/mongodb.js'
import {
  CLIENT_CRM_COLLECTION,
  ClientWorkspace,
  normalizeClientPayload,
  normalizeOwnerPayload,
  serializeClient,
  serializeWorkspaceClients,
  validateClientPayload,
  validateOwnerPayload,
} from './lib/models/client.js'
import { USER_COLLECTION } from './lib/models/user.js'
import { getOrCreateUserSettings, updateUserSettings } from './lib/services/userSettings.js'

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

const WaitlistSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  joinedAt: { type: Date, default: Date.now },
  emailSent: { type: String, enum: ['true', 'false'], default: 'false' },
})
const Waitlist = mongoose.models.Waitlist || mongoose.model('Waitlist', WaitlistSchema)

function getOwnerFromHeaders(headers) {
  return normalizeOwnerPayload({
    userId: headers['x-user-id'],
    email: headers['x-user-email'],
  })
}

function touchWorkspaceOwner(workspace, owner) {
  workspace.owner.email = owner.email
  workspace.owner.lastSeenAt = new Date()
}

function getClientIdFromRequest(req) {
  return String(req.body?.clientId ?? req.query?.clientId ?? '').trim()
}

function hasDuplicateGst(workspace, gst, excludeClientId = '') {
  if (!gst) {
    return false
  }

  return workspace.clients.some(
    (client) => client.gst && client.gst === gst && String(client._id) !== String(excludeClientId),
  )
}

async function sendWaitlistEmail(email) {
  const baseUrl = process.env.WAITLIST_EMAIL_API_BASE_URL
  if (!baseUrl) {
    console.warn('WAITLIST_EMAIL_API_BASE_URL is not set; skipping waitlist email sending.')
    return false
  }

  try {
    const response = await fetch(`${baseUrl}/api/misc/send-waitlist-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({ email }),
    })

    if (!response.ok) {
      console.error(`Waitlist email API failed with status ${response.status}`)
      return false
    }

    const emailResult = await response.json()
    return emailResult?.status === 'sent'
  } catch (error) {
    console.error('Failed to call waitlist email API:', error)
    return false
  }
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
    const { email } = req.body

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' })
    }

    try {
      const entry = new Waitlist({ email: email.trim().toLowerCase() })
      await entry.save()

      const isEmailSent = await sendWaitlistEmail(entry.email)
      if (isEmailSent) {
        entry.emailSent = 'true'
        await entry.save()
      }

      return res.status(201).json({
        success: true,
        message: "You're on the waitlist!",
        emailSent: entry.emailSent,
      })
    } catch (error) {
      if (error.code === 11000) {
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
      const workspace = await ClientWorkspace.findOne({ 'owner.userId': owner.userId })
      const clients = serializeWorkspaceClients(workspace)

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
      let workspace = await ClientWorkspace.findOne({ 'owner.userId': owner.userId })

      if (!workspace) {
        workspace = new ClientWorkspace({
          owner: {
            userId: owner.userId,
            email: owner.email,
            lastSeenAt: new Date(),
          },
          clients: [],
        })
      } else {
        touchWorkspaceOwner(workspace, owner)
      }

      if (hasDuplicateGst(workspace, payload.gst)) {
        return res.status(409).json({
          error: 'A client with this GST number already exists for this user.',
          collection: CLIENT_CRM_COLLECTION,
        })
      }

      workspace.clients.unshift(payload)
      await workspace.save()

      const createdClient = workspace.clients[0]

      console.info('[clients:create]', {
        collection: CLIENT_CRM_COLLECTION,
        ownerUserId: owner.userId,
        clientId: String(createdClient._id),
        clientName: createdClient.name,
      })

      return res.status(201).json({
        client: serializeClient(createdClient),
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
      const workspace = await ClientWorkspace.findOne({ 'owner.userId': owner.userId })

      if (!workspace) {
        return res.status(404).json({ error: 'Client workspace not found.', collection: CLIENT_CRM_COLLECTION })
      }

      const existingClient = workspace.clients.id(clientId)

      if (!existingClient) {
        return res.status(404).json({ error: 'Client not found.', collection: CLIENT_CRM_COLLECTION })
      }

      if (hasDuplicateGst(workspace, payload.gst, clientId)) {
        return res.status(409).json({
          error: 'A client with this GST number already exists for this user.',
          collection: CLIENT_CRM_COLLECTION,
        })
      }

      touchWorkspaceOwner(workspace, owner)
      Object.assign(existingClient, payload)
      await workspace.save()

      console.info('[clients:update]', {
        collection: CLIENT_CRM_COLLECTION,
        ownerUserId: owner.userId,
        clientId: String(existingClient._id),
        clientName: existingClient.name,
      })

      return res.status(200).json({
        client: serializeClient(existingClient),
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
      const workspace = await ClientWorkspace.findOne({ 'owner.userId': owner.userId })

      if (!workspace) {
        return res.status(404).json({ error: 'Client workspace not found.', collection: CLIENT_CRM_COLLECTION })
      }

      const existingClient = workspace.clients.id(clientId)

      if (!existingClient) {
        return res.status(404).json({ error: 'Client not found.', collection: CLIENT_CRM_COLLECTION })
      }

      const deletedClientId = String(existingClient._id)
      const deletedClientName = existingClient.name

      touchWorkspaceOwner(workspace, owner)
      workspace.clients.pull({ _id: clientId })
      await workspace.save()

      console.info('[clients:delete]', {
        collection: CLIENT_CRM_COLLECTION,
        ownerUserId: owner.userId,
        clientId: deletedClientId,
        clientName: deletedClientName,
      })

      return res.status(200).json({
        deletedClientId,
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
  app.listen(3001, () => {
    console.log('API server running at http://localhost:3001')
  })
}

startServer()
