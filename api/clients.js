import { connectDB } from '../lib/mongodb.js'
import {
  CLIENT_CRM_COLLECTION,
  ClientWorkspace,
  normalizeClientPayload,
  normalizeOwnerPayload,
  serializeClient,
  serializeWorkspaceClients,
  validateClientPayload,
  validateOwnerPayload,
} from '../lib/models/client.js'

function getOwnerFromRequest(req) {
  return normalizeOwnerPayload({
    userId: req.headers['x-user-id'],
    email: req.headers['x-user-email'],
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-id, x-user-email')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const owner = getOwnerFromRequest(req)
  const ownerValidationError = validateOwnerPayload(owner)

  if (ownerValidationError) {
    return res.status(401).json({ error: ownerValidationError, collection: CLIENT_CRM_COLLECTION })
  }

  try {
    await connectDB()
  } catch (error) {
    console.error('Mongo connection error:', error)
    return res.status(500).json({ error: 'Unable to connect to the database.', collection: CLIENT_CRM_COLLECTION })
  }

  if (req.method === 'GET') {
    try {
      const workspace = await ClientWorkspace.findOne({ 'owner.userId': owner.userId })
      const clients = serializeWorkspaceClients(workspace)

      console.info('[clients:get]', {
        collection: CLIENT_CRM_COLLECTION,
        ownerUserId: owner.userId,
        count: clients.length,
      })

      return res.status(200).json({ clients, collection: CLIENT_CRM_COLLECTION })
    } catch (error) {
      console.error('Failed to fetch clients:', error)
      return res.status(500).json({ error: 'Unable to fetch clients.', collection: CLIENT_CRM_COLLECTION })
    }
  }

  if (req.method === 'POST') {
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
      console.error('Failed to create client:', error)
      return res.status(500).json({ error: 'Unable to create client.', collection: CLIENT_CRM_COLLECTION })
    }
  }

  if (req.method === 'PUT') {
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
      console.error('Failed to update client:', error)
      return res.status(500).json({ error: 'Unable to update client.', collection: CLIENT_CRM_COLLECTION })
    }
  }

  if (req.method === 'DELETE') {
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
      console.error('Failed to delete client:', error)
      return res.status(500).json({ error: 'Unable to delete client.', collection: CLIENT_CRM_COLLECTION })
    }
  }

  return res.status(405).json({ error: 'Method not allowed', collection: CLIENT_CRM_COLLECTION })
}
