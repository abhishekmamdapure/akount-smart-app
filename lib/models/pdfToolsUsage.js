import mongoose from 'mongoose'

const emailPattern = /^\S+@\S+\.\S+$/

export const PDF_TOOLS_USAGE_COLLECTION = 'pdf_tools_usage_events'

const PDF_TOOL_KEYS = ['split_merge', 'reorder_delete', 'page_numbers', 'watermark', 'to_word', 'to_excel']
const PDF_TOOL_STATUSES = ['completed', 'failed']

const UsageOwnerSchema = new mongoose.Schema(
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
  { _id: false },
)

const PdfToolsUsageSchema = new mongoose.Schema(
  {
    owner: {
      type: UsageOwnerSchema,
      required: true,
    },
    tool: {
      type: String,
      enum: PDF_TOOL_KEYS,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: PDF_TOOL_STATUSES,
      required: true,
      trim: true,
    },
    summary: {
      type: String,
      default: '',
      trim: true,
      maxlength: 320,
    },
    durationMs: {
      type: Number,
      default: null,
      min: 0,
    },
  },
  {
    timestamps: true,
    collection: PDF_TOOLS_USAGE_COLLECTION,
  },
)

PdfToolsUsageSchema.index({ 'owner.userId': 1, createdAt: -1 })
PdfToolsUsageSchema.index({ 'owner.userId': 1, tool: 1, createdAt: -1 })

export const PdfToolsUsageEvent =
  mongoose.models.PdfToolsUsageEvent || mongoose.model('PdfToolsUsageEvent', PdfToolsUsageSchema)

export const PDF_TOOLS_USAGE_KEYS = Object.freeze(PDF_TOOL_KEYS)
export const PDF_TOOLS_USAGE_STATUSES = Object.freeze(PDF_TOOL_STATUSES)
