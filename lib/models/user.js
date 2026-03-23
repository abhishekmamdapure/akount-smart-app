import mongoose from 'mongoose'

const emailPattern = /^\S+@\S+\.\S+$/
const gstPattern = /^[0-9A-Z]{15}$/
const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/

export const USER_COLLECTION = 'users'

const UserOwnerSchema = new mongoose.Schema(
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
    uniqueId: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
)

const UserProfileSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      default: '',
      trim: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    gst: {
      type: String,
      default: '',
      trim: true,
      uppercase: true,
    },
    pan: {
      type: String,
      default: '',
      trim: true,
      uppercase: true,
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    photoUrl: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false },
)

const UserPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: 'Basic Plan',
      trim: true,
    },
    clientLimit: {
      type: Number,
      default: 10,
      min: 1,
      max: 10,
    },
  },
  { _id: false },
)

const UserSettingsSchema = new mongoose.Schema(
  {
    owner: {
      type: UserOwnerSchema,
      required: true,
    },
    profile: {
      type: UserProfileSchema,
      required: true,
    },
    plan: {
      type: UserPlanSchema,
      default: () => ({ name: 'Basic Plan', clientLimit: 10 }),
    },
  },
  {
    timestamps: true,
    collection: USER_COLLECTION,
  },
)

UserSettingsSchema.index({ 'owner.userId': 1 }, { unique: true })
UserSettingsSchema.index({ 'owner.uniqueId': 1 }, { unique: true })

export const UserSettings =
  mongoose.models.UserSettings || mongoose.model('UserSettings', UserSettingsSchema)

function capitalizeWord(value) {
  const lower = String(value || '').trim().toLowerCase()
  if (!lower) {
    return ''
  }

  return lower[0].toUpperCase() + lower.slice(1)
}

export function buildDefaultProfileFromOwner(owner) {
  const localPart = String(owner.email || '')
    .split('@')[0]
    .replace(/[^a-zA-Z0-9._-]/g, '')

  const tokens = localPart.split(/[._-]+/).filter(Boolean)
  const firstName = capitalizeWord(tokens[0] || 'AkountSmart')
  const lastName = capitalizeWord(tokens.slice(1).join(' ') || 'User')

  return {
    firstName,
    lastName,
    phone: '',
    gst: '',
    pan: '',
    address: '',
    photoUrl: '',
  }
}

export function normalizeUserProfilePayload(payload = {}) {
  const phoneDigits = String(payload.phone ?? '').replace(/\D/g, '').slice(-10)

  return {
    firstName: String(payload.firstName ?? '').trim(),
    lastName: String(payload.lastName ?? '').trim(),
    phone: phoneDigits ? `+91 ${phoneDigits}` : '',
    gst: String(payload.gst ?? '').trim().toUpperCase(),
    pan: String(payload.pan ?? '').trim().toUpperCase(),
    address: String(payload.address ?? '').trim(),
    photoUrl: String(payload.photoUrl ?? '').trim(),
  }
}

export function validateUserProfilePayload(profile) {
  if (!profile.firstName) {
    return 'First name is required.'
  }

  if (profile.phone && !/^\+91 \d{10}$/.test(profile.phone)) {
    return 'Mobile number must be 10 digits.'
  }

  if (profile.gst && !gstPattern.test(profile.gst)) {
    return 'GST number must be 15 alpha-numeric characters.'
  }

  if (profile.pan && !panPattern.test(profile.pan)) {
    return 'PAN number format is invalid.'
  }

  return null
}

export function serializeUserSettings(document) {
  const settings = document.toObject ? document.toObject() : document

  return {
    owner: {
      userId: settings.owner.userId,
      email: settings.owner.email,
      uniqueId: settings.owner.uniqueId,
      lastSeenAt: settings.owner.lastSeenAt,
    },
    profile: {
      firstName: settings.profile.firstName,
      lastName: settings.profile.lastName || '',
      phone: settings.profile.phone || '',
      gst: settings.profile.gst || '',
      pan: settings.profile.pan || '',
      address: settings.profile.address || '',
      photoUrl: settings.profile.photoUrl || '',
    },
    plan: {
      name: settings.plan?.name || 'Basic Plan',
      clientLimit: settings.plan?.clientLimit || 10,
    },
    updatedAt: settings.updatedAt,
  }
}