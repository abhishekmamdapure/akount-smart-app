import { ClientWorkspace, serializeClient, serializeWorkspaceClients } from '../models/client.js'

function buildOwnerUpdate(owner) {
  return {
    'owner.email': owner.email,
    'owner.lastSeenAt': new Date(),
  }
}

async function hasDuplicateGstForOwner(ownerUserId, gst, excludeClientId = '') {
  if (!gst) {
    return false
  }

  const duplicate = await ClientWorkspace.findOne(
    {
      'owner.userId': ownerUserId,
      clients: {
        $elemMatch: {
          gst,
          ...(excludeClientId ? { _id: { $ne: excludeClientId } } : {}),
        },
      },
    },
    { _id: 1 },
  ).lean()

  return Boolean(duplicate)
}

async function getClientSnapshot(ownerUserId, clientId) {
  const workspace = await ClientWorkspace.findOne(
    {
      'owner.userId': ownerUserId,
      'clients._id': clientId,
    },
    {
      clients: {
        $elemMatch: { _id: clientId },
      },
    },
  ).lean()

  return workspace?.clients?.[0] || null
}

export async function getWorkspaceClientsForOwner(ownerUserId) {
  const workspace = await ClientWorkspace.findOne(
    { 'owner.userId': ownerUserId },
    { clients: 1 },
  ).lean()

  return serializeWorkspaceClients(workspace)
}

export async function createClientForOwner(owner, payload) {
  const filter = {
    'owner.userId': owner.userId,
    ...(payload.gst ? { 'clients.gst': { $ne: payload.gst } } : {}),
  }
  const update = {
    $set: buildOwnerUpdate(owner),
    $setOnInsert: {
      'owner.userId': owner.userId,
    },
    $push: {
      clients: {
        $each: [payload],
        $position: 0,
      },
    },
  }

  try {
    const workspace = await ClientWorkspace.findOneAndUpdate(filter, update, {
      new: true,
      projection: { clients: { $slice: 1 } },
      upsert: true,
    })
    const createdClient = workspace?.clients?.[0]

    if (!createdClient) {
      return { error: 'Unable to create client.' }
    }

    return { client: serializeClient(createdClient) }
  } catch (error) {
    if (error?.code === 11000) {
      if (await hasDuplicateGstForOwner(owner.userId, payload.gst)) {
        return { conflict: 'A client with this GST number already exists for this user.' }
      }

      const workspace = await ClientWorkspace.findOneAndUpdate(filter, update, {
        new: true,
        projection: { clients: { $slice: 1 } },
      })
      const createdClient = workspace?.clients?.[0]

      if (createdClient) {
        return { client: serializeClient(createdClient) }
      }
    }

    throw error
  }
}

export async function updateClientForOwner(owner, clientId, payload) {
  if (await hasDuplicateGstForOwner(owner.userId, payload.gst, clientId)) {
    return { conflict: 'A client with this GST number already exists for this user.' }
  }

  const result = await ClientWorkspace.updateOne(
    {
      'owner.userId': owner.userId,
      'clients._id': clientId,
    },
    {
      $set: {
        ...buildOwnerUpdate(owner),
        'clients.$.address': payload.address,
        'clients.$.email': payload.email,
        'clients.$.gst': payload.gst,
        'clients.$.name': payload.name,
        'clients.$.pan': payload.pan,
        'clients.$.phone': payload.phone,
        'clients.$.tradeName': payload.tradeName,
      },
    },
  )

  if (!result.matchedCount) {
    return { notFound: 'Client not found.' }
  }

  const client = await getClientSnapshot(owner.userId, clientId)

  if (!client) {
    return { notFound: 'Client not found.' }
  }

  return { client: serializeClient(client) }
}

export async function deleteClientForOwner(owner, clientId) {
  const existingClient = await getClientSnapshot(owner.userId, clientId)

  if (!existingClient) {
    return { notFound: 'Client not found.' }
  }

  const result = await ClientWorkspace.updateOne(
    {
      'owner.userId': owner.userId,
      'clients._id': clientId,
    },
    {
      $pull: { clients: { _id: clientId } },
      $set: buildOwnerUpdate(owner),
    },
  )

  if (!result.modifiedCount) {
    return { notFound: 'Client not found.' }
  }

  return {
    deletedClientId: String(existingClient._id),
    deletedClientName: existingClient.name,
  }
}
