import mongoose from 'mongoose'
import { normalizeIndianStateValue } from '../../src/constants/indianStates.js'

const emailPattern = /^\S+@\S+\.\S+$/
const GST_NUMBER_LENGTH = 15
const INDIA_PHONE_DIGIT_COUNT = 10
const INDIA_PINCODE_DIGIT_COUNT = 6
const gstPattern = new RegExp(`^[0-9A-Z]{${GST_NUMBER_LENGTH}}$`)
const phonePattern = new RegExp(`^\\+91 \\d{${INDIA_PHONE_DIGIT_COUNT}}$`)
const pincodePattern = new RegExp(`^\\d{${INDIA_PINCODE_DIGIT_COUNT}}$`)

export const CLIENT_CRM_COLLECTION = 'client_crm_workspaces'

function normalizeDigits(value, maxLength) {
  return String(value ?? '').replace(/\D/g, '').slice(0, maxLength)
}

function normalizePhoneDigits(value) {
  return String(value ?? '').replace(/\D/g, '').slice(-INDIA_PHONE_DIGIT_COUNT)
}

function buildClientAddress({ addressLine = '', city = '', state = '', pincode = '' } = {}) {
  return [addressLine, city, state, pincode].map((part) => String(part ?? '').trim()).filter(Boolean).join(', ')
}

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
    addressLine: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    pincode: {
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

/**
 * Serializes a client document for API responses.
 *
 * @param {object} document - The Mongoose subdocument or plain client object.
 * @returns {object} A normalized client payload for the frontend.
 */
export function serializeClient(document) {
  const client = document.toObject ? document.toObject() : document
  const addressLine = client.addressLine || client.address || ''
  const city = client.city || ''
  const state = client.state || ''
  const pincode = client.pincode || ''

  return {
    id: String(client._id),
    name: client.name,
    tradeName: client.tradeName || '',
    gst: client.gst || '',
    pan: client.pan || '',
    address: client.address || buildClientAddress({ addressLine, city, state, pincode }),
    addressLine,
    city,
    state,
    pincode,
    phone: client.phone,
    email: client.email,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
  }
}

/**
 * Serializes all client records from a workspace document.
 *
 * @param {object} workspace - The owner workspace document.
 * @returns {Array<object>} Serialized client records for the workspace.
 */
export function serializeWorkspaceClients(workspace) {
  if (!workspace || !Array.isArray(workspace.clients)) {
    return []
  }

  return workspace.clients.map(serializeClient)
}

/**
 * Normalizes owner identity values coming from an API request.
 *
 * @param {object} payload - The raw owner payload.
 * @returns {{ userId: string, email: string }} The normalized owner identity.
 */
export function normalizeOwnerPayload(payload = {}) {
  return {
    userId: String(payload.userId ?? '').trim(),
    email: String(payload.email ?? '').trim().toLowerCase(),
  }
}

/**
 * Validates the normalized owner payload.
 *
 * @param {{ userId: string, email: string }} owner - The normalized owner payload.
 * @returns {string|null} A validation error message when invalid, else null.
 */
export function validateOwnerPayload(owner) {
  if (!owner.userId) {
    return 'User id is required.'
  }

  if (!owner.email || !emailPattern.test(owner.email)) {
    return 'A valid user email is required.'
  }

  return null
}

/**
 * Normalizes client data coming from the onboarding form.
 *
 * @param {object} payload - The raw client payload from the request body.
 * @returns {object} The normalized client payload used for validation and persistence.
 */
export function normalizeClientPayload(payload = {}) {
  const addressLine = String(payload.addressLine ?? payload.address ?? '').trim()
  const city = String(payload.city ?? '').trim()
  const state = normalizeIndianStateValue(payload.state)
  const pincode = normalizeDigits(payload.pincode, INDIA_PINCODE_DIGIT_COUNT)
  const normalizedPhoneDigits = normalizePhoneDigits(payload.phone)

  return {
    name: String(payload.name ?? '').trim(),
    tradeName: String(payload.tradeName ?? '').trim(),
    gst: String(payload.gst ?? '').trim().toUpperCase() || undefined,
    pan: String(payload.pan ?? '').trim().toUpperCase(),
    address: buildClientAddress({ addressLine, city, state, pincode }),
    addressLine,
    city,
    state,
    pincode,
    phone: normalizedPhoneDigits ? `+91 ${normalizedPhoneDigits}` : '',
    email: String(payload.email ?? '').trim().toLowerCase(),
  }
}

/**
 * Validates the normalized client payload.
 *
 * @param {object} client - The normalized client payload.
 * @returns {string|null} A validation error message when invalid, else null.
 */
export function validateClientPayload(client) {
  if (!client.name) {
    return 'Client name is required.'
  }

  if (!client.addressLine) {
    return 'Address is required.'
  }

  if (!client.city) {
    return 'City is required.'
  }

  if (!client.state) {
    return 'State is required.'
  }

  if (!client.pincode) {
    return 'Pincode is required.'
  }

  if (!pincodePattern.test(client.pincode)) {
    return 'Pincode must be 6 digits.'
  }

  if (!client.phone) {
    return 'Mobile number is required.'
  }

  if (!phonePattern.test(client.phone)) {
    return 'Mobile number must be 10 digits.'
  }

  if (!client.email || !emailPattern.test(client.email)) {
    return 'A valid email address is required.'
  }

  if (client.gst && !gstPattern.test(client.gst)) {
    return `GST number must be ${GST_NUMBER_LENGTH} alpha-numeric characters.`
  }

  if (client.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(client.pan)) {
    return 'PAN number format is invalid.'
  }

  return null
}
