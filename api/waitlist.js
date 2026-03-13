// api/waitlist.js
// Vercel Serverless Function - Node.js runtime
// Stores waitlist emails in MongoDB Atlas

import mongoose from 'mongoose'

// ---- MongoDB Connection ----
let isConnected = false

async function connectDB() {
  if (isConnected) return

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not set')
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: 'akountsmart',
  })

  isConnected = true
}

// ---- Mongoose Schema ----
const WaitlistSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
  },
  joinedAt: {
    type: Date,
    default: Date.now,
  },
})

// Avoid model re-compilation in serverless warm starts
const Waitlist = mongoose.models.Waitlist || mongoose.model('Waitlist', WaitlistSchema)

// ---- Handler ----
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email } = req.body

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required.' })
  }

  const emailRegex = /^\S+@\S+\.\S+$/
  if (!emailRegex.test(email.trim())) {
    return res.status(400).json({ error: 'Please enter a valid email address.' })
  }

  try {
    await connectDB()

    const entry = new Waitlist({ email: email.trim().toLowerCase() })
    await entry.save()

    return res.status(201).json({
      success: true,
      message: "You're on the waitlist! We'll notify you when we launch.",
    })
  } catch (err) {
    // Duplicate email (MongoDB unique index error)
    if (err.code === 11000) {
      return res.status(409).json({ error: "This email is already on the waitlist!" })
    }

    console.error('Waitlist error:', err)
    return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}
