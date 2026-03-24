import mongoose from 'mongoose'

const emailPattern = /^\S+@\S+\.\S+$/

export const TALLY_XML_CONVERSION_COLLECTION = 'tally_xml_conversion_jobs'

const TallyOwnerSchema = new mongoose.Schema(
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

const StoredTallyFileSchema = new mongoose.Schema(
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

const TallyPreferenceSchema = new mongoose.Schema(
  {
    includeMasters: {
      type: Boolean,
      default: true,
    },
    autoCreate: {
      type: Boolean,
      default: true,
    },
    validateGstin: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false },
)

const TallyProcessorMetadataSchema = new mongoose.Schema(
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

const TallyXmlConversionJobSchema = new mongoose.Schema(
  {
    owner: {
      type: TallyOwnerSchema,
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
    preferences: {
      type: TallyPreferenceSchema,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: ['processing', 'completed', 'failed'],
      default: 'processing',
      required: true,
    },
    sourceFile: {
      type: StoredTallyFileSchema,
      default: () => ({}),
    },
    resultFile: {
      type: StoredTallyFileSchema,
      default: () => ({}),
    },
    processor: {
      type: TallyProcessorMetadataSchema,
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
    collection: TALLY_XML_CONVERSION_COLLECTION,
  },
)

TallyXmlConversionJobSchema.index({ 'owner.userId': 1, clientId: 1, createdAt: -1 })
TallyXmlConversionJobSchema.index({ 'owner.userId': 1, status: 1, createdAt: -1 })

export const TallyXmlConversionJob =
  mongoose.models.TallyXmlConversionJob ||
  mongoose.model('TallyXmlConversionJob', TallyXmlConversionJobSchema)
