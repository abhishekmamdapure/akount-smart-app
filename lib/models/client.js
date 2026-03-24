import mongoose from 'mongoose'

const emailPattern = /^\S+@\S+\.\S+$/
export const CLIENT_CRM_COLLECTION = 'client_crm_workspaces'

const ClientRecordSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    tradeName: {
      type: String,
      default: '',
      trim: true,
    },
    gst: {
      type: String,
      trim: true,
      uppercase: true,
      default: undefined,
    },
    pan: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [emailPattern, 'Invalid email format'],
    },
  },
  {
    _id: true,
    timestamps: true,
  },
)

const ClientOwnerSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [emailPattern, 'Invalid owner email format'],
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  },
)

const ClientWorkspaceSchema = new mongoose.Schema(
  {
    owner: {
      type: ClientOwnerSchema,
      required: true,
    },
    clients: {
      type: [ClientRecordSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: CLIENT_CRM_COLLECTION,
  },
)

ClientWorkspaceSchema.index({ 'owner.userId': 1 }, { unique: true })
ClientWorkspaceSchema.index({ 'owner.email': 1 })
ClientWorkspaceSchema.index({ 'owner.userId': 1, 'clients._id': 1 })
ClientWorkspaceSchema.index({ 'owner.userId': 1, 'clients.gst': 1 })

export const ClientWorkspace =
  mongoose.models.ClientWorkspace || mongoose.model('ClientWorkspace', ClientWorkspaceSchema)

export function serializeClient(document) {
  const client = document.toObject ? document.toObject() : document

  return {
    id: String(client._id),
    name: client.name,
    tradeName: client.tradeName || '',
    gst: client.gst || '',
    pan: client.pan || '',
    address: client.address,
    phone: client.phone,
    email: client.email,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
  }
}

export function serializeWorkspaceClients(workspace) {
  if (!workspace || !Array.isArray(workspace.clients)) {
    return []
  }

  return workspace.clients.map(serializeClient)
}

export function normalizeOwnerPayload(payload = {}) {
  return {
    userId: String(payload.userId ?? '').trim(),
    email: String(payload.email ?? '').trim().toLowerCase(),
  }
}

export function validateOwnerPayload(owner) {
  if (!owner.userId) {
    return 'User id is required.'
  }

  if (!owner.email || !emailPattern.test(owner.email)) {
    return 'A valid user email is required.'
  }

  return null
}

export function normalizeClientPayload(payload = {}) {
  const normalizedPhoneDigits = String(payload.phone ?? '').replace(/\D/g, '').slice(-10)

  return {
    name: String(payload.name ?? '').trim(),
    tradeName: String(payload.tradeName ?? '').trim(),
    gst: String(payload.gst ?? '').trim().toUpperCase() || undefined,
    pan: String(payload.pan ?? '').trim().toUpperCase(),
    address: String(payload.address ?? '').trim(),
    phone: normalizedPhoneDigits ? `+91 ${normalizedPhoneDigits}` : '',
    email: String(payload.email ?? '').trim().toLowerCase(),
  }
}

export function validateClientPayload(client) {
  if (!client.name) {
    return 'Client name is required.'
  }

  if (!client.address) {
    return 'Registered address is required.'
  }

  if (!client.phone) {
    return 'Mobile number is required.'
  }

  if (!/^\+91 \d{10}$/.test(client.phone)) {
    return 'Mobile number must be 10 digits.'
  }

  if (!client.email || !emailPattern.test(client.email)) {
    return 'A valid email address is required.'
  }

  if (client.gst && !/^[0-9A-Z]{15}$/.test(client.gst)) {
    return 'GST number must be 15 alpha-numeric characters.'
  }

  if (client.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(client.pan)) {
    return 'PAN number format is invalid.'
  }

  return null
}
