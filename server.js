// server.js - Local dev server only
// In production, Vercel handles /api/ automatically — this file is NOT deployed

import express from 'express'
import mongoose from 'mongoose'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Load .env.local manually
const __dirname = dirname(fileURLToPath(import.meta.url))
try {
  const envFile = readFileSync(join(__dirname, '.env.local'), 'utf-8')
  envFile.split('\n').forEach(line => {
    const [key, ...val] = line.split('=')
    if (key && !key.startsWith('#')) {
      process.env[key.trim()] = val.join('=').trim()
    }
  })
} catch {
  // .env.local not found
}

const app = express()
app.use(express.json())

// ---- MongoDB — connect EAGERLY on startup ----
const WaitlistSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  joinedAt: { type: Date, default: Date.now },
  emailSent: { type: String, enum: ['true', 'false'], default: 'false' },
})
const Waitlist = mongoose.models.Waitlist || mongoose.model('Waitlist', WaitlistSchema)

async function sendWaitlistEmail(email) {
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

async function startServer() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set in .env.local')
    process.exit(1)
  }

  console.log('⏳ Connecting to MongoDB...')
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: 'akountsmart',
      serverSelectionTimeoutMS: 10000, // fail fast after 10s
    })
    console.log('✅ MongoDB connected successfully')
  } catch (err) {
    console.error('❌ MongoDB connection FAILED:')
    console.error('   Message:', err.message)
    console.error('   Code:', err.code)
    process.exit(1)
  }

  // ---- POST /api/waitlist ----
  app.post('/api/waitlist', async (req, res) => {
    const { email } = req.body

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' })
    }

    try {
      const entry = new Waitlist({ email: email.trim().toLowerCase() })
      await entry.save()

      const isEmailSent = await sendWaitlistEmail(entry.email)
      if (isEmailSent) {
        entry.emailSent = 'true'
        await entry.save()
      }

      return res.status(201).json({
        success: true,
        message: "You're on the waitlist!",
        emailSent: entry.emailSent,
      })
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ error: 'This email is already on the waitlist!' })
      }
      console.error('Save error:', err.message)
      return res.status(500).json({ error: 'Something went wrong. Please try again.' })
    }
  })

  app.listen(3001, () => {
    console.log('🚀 API server running at http://localhost:3001')
  })
}

startServer()
