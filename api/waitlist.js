import { connectDB } from '../lib/mongodb.js'
import { createWaitlistEntry, validateWaitlistEmail } from '../lib/services/waitlist.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email } = req.body || {}

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required.' })
  }

  if (!validateWaitlistEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' })
  }

  try {
    await connectDB()

    const entry = await createWaitlistEntry(email)

    return res.status(201).json({
      success: true,
      message: "You're on the waitlist! We'll notify you when we launch.",
      emailSent: entry.emailSent,
    })
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'This email is already on the waitlist!' })
    }

    console.error('Waitlist error:', error)
    return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
