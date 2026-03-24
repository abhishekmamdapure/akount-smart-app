import mongoose from 'mongoose'

const emailPattern = /^\S+@\S+\.\S+$/

export const INVOICE_PROCESSING_COLLECTION = 'invoice_processing_jobs'

const InvoiceOwnerSchema = new mongoose.Schema(
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

const StoredInvoiceFileSchema = new mongoose.Schema(
  {
    bucket: {
      type: String,
      default: '',
      trim: true,
    },
    key: {
      type: String,
      default: '',
      trim: true,
    },
    fileName: {
      type: String,
      default: '',
      trim: true,
    },
    contentType: {
      type: String,
      default: '',
      trim: true,
    },
    sizeBytes: {
      type: Number,
      default: 0,
      min: 0,
    },
    uploadedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false },
)

const ProcessorMetadataSchema = new mongoose.Schema(
  {
    fileId: {
      type: String,
      default: '',
      trim: true,
    },
    pages: {
      type: Number,
      default: null,
      min: 0,
    },
    processingTimeSec: {
      type: Number,
      default: null,
      min: 0,
    },
    remoteDownloadUrl: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false },
)

const InvoiceProcessingJobSchema = new mongoose.Schema(
  {
    owner: {
      type: InvoiceOwnerSchema,
      required: true,
    },
    clientId: {
      type: String,
      required: true,
      trim: true,
    },
    clientName: {
      type: String,
      required: true,
      trim: true,
    },
    mode: {
      type: String,
      enum: ['separate', 'combined'],
      required: true,
    },
    status: {
      type: String,
      enum: ['processing', 'completed', 'failed'],
      default: 'processing',
      required: true,
    },
    sourceFile: {
      type: StoredInvoiceFileSchema,
      default: () => ({}),
    },
    resultFile: {
      type: StoredInvoiceFileSchema,
      default: () => ({}),
    },
    processor: {
      type: ProcessorMetadataSchema,
      default: () => ({}),
    },
    errorMessage: {
      type: String,
      default: '',
      trim: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: INVOICE_PROCESSING_COLLECTION,
  },
)

InvoiceProcessingJobSchema.index({ 'owner.userId': 1, clientId: 1, createdAt: -1 })
InvoiceProcessingJobSchema.index({ 'owner.userId': 1, status: 1, createdAt: -1 })

export const InvoiceProcessingJob =
  mongoose.models.InvoiceProcessingJob ||
  mongoose.model('InvoiceProcessingJob', InvoiceProcessingJobSchema)
