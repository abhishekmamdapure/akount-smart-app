import mongoose from 'mongoose'

export const WAITLIST_COLLECTION = 'waitlist'

const emailPattern = /^\S+@\S+\.\S+$/

const WaitlistSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [emailPattern, 'Invalid email format'],
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    emailSent: {
      type: String,
      enum: ['true', 'false'],
      default: 'false',
    },
  },
  {
    collection: WAITLIST_COLLECTION,
  },
)

export const Waitlist = mongoose.models.Waitlist || mongoose.model('Waitlist', WaitlistSchema)
