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
    const existing = await UserSettings.findOne({ 'owner.uniqueId': candidate }, { 'owner.userId': 1 })

    if (!existing || existing.owner.userId === userId) {
      return candidate
    }
  }

  return `${first}${last}${Date.now().toString().slice(-4)}`
}

async function countClientsForUser(ownerUserId) {
  const workspace = await ClientWorkspace.findOne({ 'owner.userId': ownerUserId }, { clients: 1 })
  return Array.isArray(workspace?.clients) ? workspace.clients.length : 0
}

function enforceBasicPlan(document) {
  document.plan = {
    ...BASIC_PLAN,
  }
}

export async function getOrCreateUserSettings(owner) {
  let settings = await UserSettings.findOne({ 'owner.userId': owner.userId })

  if (!settings) {
    const defaults = buildDefaultProfileFromOwner(owner)
    const uniqueId = await generateUniqueOwnerId(defaults.firstName, defaults.lastName, owner.userId)

    settings = new UserSettings({
      owner: {
        userId: owner.userId,
        email: owner.email,
        uniqueId,
        lastSeenAt: new Date(),
      },
      profile: defaults,
      plan: BASIC_PLAN,
    })
  } else {
    settings.owner.email = owner.email
    settings.owner.lastSeenAt = new Date()

    if (!settings.owner.uniqueId) {
      settings.owner.uniqueId = await generateUniqueOwnerId(
        settings.profile?.firstName,
        settings.profile?.lastName,
        owner.userId,
      )
    }

    if (!settings.profile?.firstName) {
      settings.profile = {
        ...buildDefaultProfileFromOwner(owner),
        ...settings.profile,
      }
    }

    enforceBasicPlan(settings)
  }

  await settings.save()

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

  let settings = await UserSettings.findOne({ 'owner.userId': owner.userId })

  if (!settings) {
    const uniqueId = await generateUniqueOwnerId(
      normalizedProfile.firstName,
      normalizedProfile.lastName,
      owner.userId,
    )

    settings = new UserSettings({
      owner: {
        userId: owner.userId,
        email: owner.email,
        uniqueId,
        lastSeenAt: new Date(),
      },
      profile: normalizedProfile,
      plan: BASIC_PLAN,
    })
  } else {
    if (!settings.owner.uniqueId) {
      settings.owner.uniqueId = await generateUniqueOwnerId(
        normalizedProfile.firstName,
        normalizedProfile.lastName,
        owner.userId,
      )
    }

    settings.owner.email = owner.email
    settings.owner.lastSeenAt = new Date()
    settings.profile = {
      ...settings.profile?.toObject?.(),
      ...normalizedProfile,
    }
    enforceBasicPlan(settings)
  }

  await settings.save()

  const clientsUsed = await countClientsForUser(owner.userId)

  return {
    validationError: null,
    settings: serializeUserSettings(settings),
    usage: {
      clientsUsed,
    },
  }
}