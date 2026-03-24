import mongoose from 'mongoose'

const emailPattern = /^\S+@\S+\.\S+$/

export const GST_RECONCILIATION_COLLECTION = 'gst_reconciliation_jobs'

const GstOwnerSchema = new mongoose.Schema(
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

const StoredGstFileSchema = new mongoose.Schema(
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

const GstSettingsSchema = new mongoose.Schema(
  {
    tolerance: {
      type: Number,
      default: 10,
      min: 0,
    },
    ignoreDecimal: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false },
)

const GstProcessorMetadataSchema = new mongoose.Schema(
  {
    fileId: {
      type: String,
      default: '',
      trim: true,
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

const GstReconciliationJobSchema = new mongoose.Schema(
  {
    owner: {
      type: GstOwnerSchema,
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
    type: {
      type: String,
      enum: ['gst_2b', 'gst_4a'],
      required: true,
    },
    settings: {
      type: GstSettingsSchema,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: ['processing', 'completed', 'failed'],
      default: 'processing',
      required: true,
    },
    purchaseFile: {
      type: StoredGstFileSchema,
      default: () => ({}),
    },
    gstFile: {
      type: StoredGstFileSchema,
      default: () => ({}),
    },
    resultFile: {
      type: StoredGstFileSchema,
      default: () => ({}),
    },
    processor: {
      type: GstProcessorMetadataSchema,
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
    collection: GST_RECONCILIATION_COLLECTION,
  },
)

GstReconciliationJobSchema.index({ 'owner.userId': 1, clientId: 1, createdAt: -1 })
GstReconciliationJobSchema.index({ 'owner.userId': 1, type: 1, createdAt: -1 })
GstReconciliationJobSchema.index({ 'owner.userId': 1, status: 1, createdAt: -1 })

export const GstReconciliationJob =
  mongoose.models.GstReconciliationJob ||
  mongoose.model('GstReconciliationJob', GstReconciliationJobSchema)
