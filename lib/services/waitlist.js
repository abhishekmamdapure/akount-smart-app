import { Waitlist } from '../models/waitlist.js'

export function normalizeWaitlistEmail(email) {
  return String(email || '').trim().toLowerCase()
}

export function validateWaitlistEmail(email) {
  return /^\S+@\S+\.\S+$/.test(normalizeWaitlistEmail(email))
}

export async function sendWaitlistEmail(email) {
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

export async function createWaitlistEntry(email) {
  const normalizedEmail = normalizeWaitlistEmail(email)
  const entry = await Waitlist.create({ email: normalizedEmail })
  const isEmailSent = await sendWaitlistEmail(normalizedEmail)

  if (isEmailSent) {
    await Waitlist.updateOne({ _id: entry._id }, { $set: { emailSent: 'true' } })

    return {
      email: normalizedEmail,
      emailSent: 'true',
    }
  }

  return {
    email: normalizedEmail,
    emailSent: entry.emailSent,
  }
}
