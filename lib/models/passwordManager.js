import mongoose from 'mongoose'

const emailPattern = /^\S+@\S+\.\S+$/

export const PASSWORD_MANAGER_COLLECTION = 'password_manager_vaults'

const PasswordManagerOwnerSchema = new mongoose.Schema(
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
  {
    _id: false,
  },
)

const EncryptedSecretSchema = new mongoose.Schema(
  {
    authTag: {
      type: String,
      default: '',
      trim: true,
    },
    cipherText: {
      type: String,
      default: '',
      trim: true,
    },
    iv: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    _id: false,
  },
)

const CredentialSectionSchema = new mongoose.Schema(
  {
    loginId: {
      type: String,
      default: '',
      trim: true,
    },
    password: {
      type: EncryptedSecretSchema,
      default: null,
    },
  },
  {
    _id: false,
  },
)

const OptionalCredentialSectionSchema = new mongoose.Schema(
  {
    enabled: {
      type: Boolean,
      default: false,
    },
    loginId: {
      type: String,
      default: '',
      trim: true,
    },
    password: {
      type: EncryptedSecretSchema,
      default: null,
    },
  },
  {
    _id: false,
  },
)

const EpfCredentialSectionSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      default: '',
      trim: true,
    },
    enabled: {
      type: Boolean,
      default: false,
    },
    loginId: {
      type: String,
      default: '',
      trim: true,
    },
    password: {
      type: EncryptedSecretSchema,
      default: null,
    },
  },
  {
    _id: false,
  },
)

const CustomSectionSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    password: {
      type: EncryptedSecretSchema,
      default: null,
    },
    username: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    _id: false,
  },
)

const PasswordVaultSchema = new mongoose.Schema(
  {
    clientId: {
      type: String,
      required: true,
      trim: true,
    },
    customSections: {
      type: [CustomSectionSchema],
      default: [],
    },
    einvoice: {
      type: OptionalCredentialSectionSchema,
      default: () => ({}),
    },
    epf: {
      type: EpfCredentialSectionSchema,
      default: () => ({}),
    },
    eway: {
      type: OptionalCredentialSectionSchema,
      default: () => ({}),
    },
    fatherName: {
      type: String,
      default: '',
      trim: true,
    },
    gst: {
      type: CredentialSectionSchema,
      default: () => ({}),
    },
    it: {
      type: CredentialSectionSchema,
      default: () => ({}),
    },
    owner: {
      type: PasswordManagerOwnerSchema,
      required: true,
    },
    sectionOrder: {
      type: [String],
      default: [],
    },
  },
  {
    collection: PASSWORD_MANAGER_COLLECTION,
    timestamps: true,
  },
)

PasswordVaultSchema.index({ 'owner.userId': 1, clientId: 1 }, { unique: true })
PasswordVaultSchema.index({ 'owner.userId': 1, updatedAt: -1 })

export const PasswordVault =
  mongoose.models.PasswordVault || mongoose.model('PasswordVault', PasswordVaultSchema)
