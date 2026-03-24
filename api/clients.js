import { connectDB } from '../lib/mongodb.js'
import {
  CLIENT_CRM_COLLECTION,
  normalizeClientPayload,
  normalizeOwnerPayload,
  validateClientPayload,
  validateOwnerPayload,
} from '../lib/models/client.js'
import {
  createClientForOwner,
  deleteClientForOwner,
  getWorkspaceClientsForOwner,
  updateClientForOwner,
} from '../lib/services/clientWorkspace.js'

function getOwnerFromRequest(req) {
  return normalizeOwnerPayload({
    userId: req.headers['x-user-id'],
    email: req.headers['x-user-email'],
  })
}

function getClientIdFromRequest(req) {
  return String(req.body?.clientId ?? req.query?.clientId ?? '').trim()
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
      const clients = await getWorkspaceClientsForOwner(owner.userId)

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
      console.error('Failed to delete client:', error)
      return res.status(500).json({ error: 'Unable to delete client.', collection: CLIENT_CRM_COLLECTION })
    }
  }

  return res.status(405).json({ error: 'Method not allowed', collection: CLIENT_CRM_COLLECTION })
}
