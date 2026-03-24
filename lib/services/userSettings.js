import { ClientWorkspace } from '../models/client.js'
import {
  buildDefaultProfileFromOwner,
  normalizeUserProfilePayload,
  serializeUserSettings,
  UserSettings,
  validateUserProfilePayload,
} from '../models/user.js'

const BASIC_PLAN = {
  name: 'Basic Plan',
  clientLimit: 10,
}

function slugPart(value, fallback) {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 12)

  return slug || fallback
}

function randomDigits(length = 4) {
  let result = ''
  for (let index = 0; index < length; index += 1) {
    result += Math.floor(Math.random() * 10)
  }
  return result
}

async function generateUniqueOwnerId(firstName, lastName, userId) {
  const first = slugPart(firstName, 'user')
  const last = slugPart(lastName, 'account')

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const candidate = `${first}${last}${randomDigits(4)}`
    const existing = await UserSettings.findOne(
      { 'owner.uniqueId': candidate },
      { 'owner.userId': 1 },
    ).lean()

    if (!existing || existing.owner.userId === userId) {
      return candidate
    }
  }

  return `${first}${last}${Date.now().toString().slice(-4)}`
}

async function countClientsForUser(ownerUserId) {
  const [result] = await ClientWorkspace.aggregate([
    { $match: { 'owner.userId': ownerUserId } },
    {
      $project: {
        _id: 0,
        clientsUsed: {
          $size: {
            $ifNull: ['$clients', []],
          },
        },
      },
    },
  ])

  return result?.clientsUsed || 0
}

async function ensureLegacyUserFields(owner, fallbackProfile) {
  const existing = await UserSettings.findOne(
    { 'owner.userId': owner.userId },
    { owner: 1, profile: 1 },
  ).lean()

  if (!existing) {
    return null
  }

  const patch = {}

  if (!existing.owner?.uniqueId) {
    patch['owner.uniqueId'] = await generateUniqueOwnerId(
      existing.profile?.firstName || fallbackProfile.firstName,
      existing.profile?.lastName || fallbackProfile.lastName,
      owner.userId,
    )
  }

  if (!existing.profile?.firstName) {
    patch.profile = {
      ...fallbackProfile,
      ...existing.profile,
    }
  }

  if (!Object.keys(patch).length) {
    return existing
  }

  return UserSettings.findOneAndUpdate(
    { 'owner.userId': owner.userId },
    { $set: patch },
    { new: true, lean: true },
  )
}

export async function getOrCreateUserSettings(owner) {
  const defaults = buildDefaultProfileFromOwner(owner)
  const generatedUniqueId = await generateUniqueOwnerId(defaults.firstName, defaults.lastName, owner.userId)

  let settings = await UserSettings.findOneAndUpdate(
    { 'owner.userId': owner.userId },
    {
      $set: {
        'owner.email': owner.email,
        'owner.lastSeenAt': new Date(),
        plan: BASIC_PLAN,
      },
      $setOnInsert: {
        'owner.uniqueId': generatedUniqueId,
        'owner.userId': owner.userId,
        profile: defaults,
      },
    },
    {
      new: true,
      lean: true,
      upsert: true,
    },
  )

  if (!settings.owner?.uniqueId || !settings.profile?.firstName) {
    settings = (await ensureLegacyUserFields(owner, defaults)) || settings
  }

  const clientsUsed = await countClientsForUser(owner.userId)

  return {
    settings: serializeUserSettings(settings),
    usage: {
      clientsUsed,
    },
  }
}

export async function updateUserSettings(owner, payload) {
  const normalizedProfile = normalizeUserProfilePayload(payload)
  const validationError = validateUserProfilePayload(normalizedProfile)

  if (validationError) {
    return {
      validationError,
      settings: null,
      usage: null,
    }
  }

  const generatedUniqueId = await generateUniqueOwnerId(
    normalizedProfile.firstName,
    normalizedProfile.lastName,
    owner.userId,
  )

  let settings = await UserSettings.findOneAndUpdate(
    { 'owner.userId': owner.userId },
    {
      $set: {
        'owner.email': owner.email,
        'owner.lastSeenAt': new Date(),
        plan: BASIC_PLAN,
        profile: normalizedProfile,
      },
      $setOnInsert: {
        'owner.uniqueId': generatedUniqueId,
        'owner.userId': owner.userId,
      },
    },
    {
      new: true,
      lean: true,
      upsert: true,
    },
  )

  if (!settings.owner?.uniqueId) {
    settings =
      (await ensureLegacyUserFields(owner, normalizedProfile)) ||
      settings
  }

  const clientsUsed = await countClientsForUser(owner.userId)

  return {
    validationError: null,
    settings: serializeUserSettings(settings),
    usage: {
      clientsUsed,
    },
  }
}
