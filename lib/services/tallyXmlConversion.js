import mongoose from 'mongoose'
import { ClientWorkspace } from '../models/client.js'
import {
  TALLY_XML_CONVERSION_COLLECTION,
  TallyXmlConversionJob,
} from '../models/tallyXmlConversion.js'
import {
  assertS3Configured,
  createSignedDownloadUrl,
  createSignedUploadUrl,
  getS3Config,
  isS3Configured,
  sanitizeObjectFileName,
  sanitizeObjectSegment,
  uploadBufferToS3,
} from './s3Storage.js'

const PROCESSING_STATUSES = new Set(['processing', 'completed', 'failed'])
const SUPPORTED_SOURCE_EXTENSIONS = ['.xlsm', '.xlsx', '.xls', '.csv']
const SUPPORTED_CONTENT_TYPES = new Set([
  'application/csv',
  'application/vnd.ms-excel',
  'application/vnd.ms-excel.sheet.macroenabled.12',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
])

const defaultPreferences = Object.freeze({
  includeMasters: true,
  autoCreate: true,
  validateGstin: false,
})

function normalizeFileName(value, fallback = 'source.xlsx') {
  return sanitizeObjectFileName(value, fallback)
}

function deriveResultFileName(sourceFileName) {
  const normalizedSource = normalizeFileName(sourceFileName, 'source.xlsx')
  const parts = normalizedSource.split('.')

  if (parts.length > 1) {
    parts.pop()
  }

  const baseName = parts.join('.') || 'tally'
  return `${baseName}-tally.xml`
}

function normalizePreferences(preferences = {}) {
  return {
    includeMasters:
      preferences.includeMasters === undefined
        ? defaultPreferences.includeMasters
        : Boolean(preferences.includeMasters),
    autoCreate:
      preferences.autoCreate === undefined ? defaultPreferences.autoCreate : Boolean(preferences.autoCreate),
    validateGstin:
      preferences.validateGstin === undefined
        ? defaultPreferences.validateGstin
        : Boolean(preferences.validateGstin),
  }
}

function buildPreferenceSummary(preferences = defaultPreferences) {
  const labels = []

  if (preferences.includeMasters) {
    labels.push('Masters')
  }

  if (preferences.autoCreate) {
    labels.push('Auto vouchers')
  }

  if (preferences.validateGstin) {
    labels.push('GSTIN checks')
  }

  if (labels.length === 0) {
    return 'Standard XML export'
  }

  return labels.join(' + ')
}

function resolveAbsoluteDownloadUrl(downloadHref, downloadUrl) {
  const hrefValue = String(downloadHref || '').trim()

  if (/^https?:\/\//i.test(hrefValue)) {
    return hrefValue
  }

  const urlValue = String(downloadUrl || '').trim()

  if (/^https?:\/\//i.test(urlValue)) {
    return urlValue
  }

  const apiBaseUrl = String(process.env.VITE_API_BASE_URL || '').trim()

  if (apiBaseUrl && urlValue) {
    const normalizedPath = urlValue.startsWith('/') ? urlValue : `/${urlValue}`
    return `${apiBaseUrl.replace(/\/$/, '')}${normalizedPath}`
  }

  return ''
}

function getFileExtension(fileName = '') {
  const normalized = String(fileName || '').trim().toLowerCase()

  for (const extension of SUPPORTED_SOURCE_EXTENSIONS) {
    if (normalized.endsWith(extension)) {
      return extension
    }
  }

  return ''
}

function getContentTypeFromFileName(fileName, fallback = 'application/octet-stream') {
  const extension = getFileExtension(fileName)

  if (extension === '.csv') {
    return 'text/csv'
  }

  if (extension === '.xls') {
    return 'application/vnd.ms-excel'
  }

  if (extension === '.xlsx') {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }

  if (extension === '.xlsm') {
    return 'application/vnd.ms-excel.sheet.macroEnabled.12'
  }

  if (String(fileName || '').toLowerCase().endsWith('.xml')) {
    return 'application/xml'
  }

  return fallback
}

function isSupportedSourceFile({ fileName, contentType }) {
  const extension = getFileExtension(fileName)

  if (extension) {
    return true
  }

  return SUPPORTED_CONTENT_TYPES.has(String(contentType || '').trim().toLowerCase())
}

function buildStorageKey({ clientId, entryId, fileName, ownerUserId, variant }) {
  const ownerSegment = sanitizeObjectSegment(ownerUserId, 'user')
  const clientSegment = sanitizeObjectSegment(clientId, 'client')
  const safeFileName = normalizeFileName(
    fileName,
    variant === 'source' ? 'source.xlsx' : 'tally-output.xml',
  )

  return `tally-xml/${ownerSegment}/${clientSegment}/${entryId}/${variant}/${safeFileName}`
}

async function findOwnedClient(ownerUserId, clientId) {
  const workspace = await ClientWorkspace.findOne(
    {
      'owner.userId': ownerUserId,
      'clients._id': clientId,
    },
    {
      clients: {
        $elemMatch: { _id: clientId },
      },
    },
  ).lean()

  return workspace?.clients?.[0] || null
}

async function buildSerializedTallyJob(job) {
  const sourceFile = job.sourceFile?.toObject ? job.sourceFile.toObject() : job.sourceFile || {}
  const resultFile = job.resultFile?.toObject ? job.resultFile.toObject() : job.resultFile || {}
  const processor = job.processor?.toObject ? job.processor.toObject() : job.processor || {}
  const preferences = normalizePreferences(job.preferences)

  let sourceDownloadHref = ''
  let downloadHref = ''

  if (isS3Configured()) {
    if (sourceFile.key) {
      sourceDownloadHref = await createSignedDownloadUrl({
        fileName: sourceFile.fileName || 'source.xlsx',
        key: sourceFile.key,
      })
    }

    if (resultFile.key) {
      downloadHref = await createSignedDownloadUrl({
        fileName: resultFile.fileName || 'tally-output.xml',
        key: resultFile.key,
      })
    }
  }

  if (!downloadHref && processor.remoteDownloadUrl) {
    downloadHref = processor.remoteDownloadUrl
  }

  return {
    clientId: job.clientId,
    clientName: job.clientName,
    completedAt: job.completedAt,
    createdAt: job.createdAt,
    downloadHref,
    errorMessage: job.errorMessage || '',
    fileId: processor.fileId || '',
    fileName: sourceFile.fileName || '',
    id: String(job._id),
    preferenceSummary: buildPreferenceSummary(preferences),
    preferences,
    processingTimeSec:
      processor.processingTimeSec === null || processor.processingTimeSec === undefined
        ? null
        : Number(processor.processingTimeSec),
    resultFileName: resultFile.fileName || '',
    sourceDownloadHref,
    status: job.status,
    updatedAt: job.updatedAt,
  }
}

async function storeRemoteResultFile({
  authorizationHeader = '',
  clientId,
  downloadHref,
  downloadUrl,
  entryId,
  ownerUserId,
  sourceFileName,
}) {
  if (!isS3Configured()) {
    return null
  }

  const remoteUrl = resolveAbsoluteDownloadUrl(downloadHref, downloadUrl)

  if (!remoteUrl) {
    return null
  }

  const response = await fetch(remoteUrl, {
    headers: authorizationHeader
      ? {
          Authorization: authorizationHeader,
          accept: '*/*',
        }
      : {
          accept: '*/*',
        },
  })

  if (!response.ok) {
    throw new Error(`Unable to fetch processed XML file (${response.status}).`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const responseContentType = response.headers.get('content-type') || ''
  const remoteFileName = response.headers
    .get('content-disposition')
    ?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)?.[1]

  const normalizedFileName = normalizeFileName(
    remoteFileName || deriveResultFileName(sourceFileName),
    deriveResultFileName(sourceFileName),
  )
  const key = buildStorageKey({
    clientId,
    entryId,
    fileName: normalizedFileName,
    ownerUserId,
    variant: 'result',
  })
  const { bucketName } = getS3Config()

  await uploadBufferToS3({
    buffer,
    contentType: responseContentType || getContentTypeFromFileName(normalizedFileName, 'application/xml'),
    fileName: normalizedFileName,
    key,
  })

  return {
    bucket: bucketName,
    contentType: responseContentType || getContentTypeFromFileName(normalizedFileName, 'application/xml'),
    fileName: normalizedFileName,
    key,
    sizeBytes: buffer.byteLength,
    uploadedAt: new Date(),
  }
}

function normalizeProcessingTime(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const numeric = Number(value)

  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null
}

export async function listTallyXmlJobs(owner, clientId) {
  const normalizedClientId = String(clientId || '').trim()

  if (!normalizedClientId) {
    return {
      items: [],
      validationError: 'Client id is required.',
    }
  }

  const ownedClient = await findOwnedClient(owner.userId, normalizedClientId)

  if (!ownedClient) {
    return {
      items: [],
      notFound: 'Client not found for this user.',
    }
  }

  const jobs = await TallyXmlConversionJob.find({
    'owner.userId': owner.userId,
    clientId: normalizedClientId,
  })
    .lean()
    .sort({ createdAt: -1 })
    .limit(100)

  const items = await Promise.all(jobs.map((job) => buildSerializedTallyJob(job)))

  return {
    clientName: ownedClient.name,
    items,
    validationError: null,
  }
}

export async function createTallyXmlJob(owner, payload = {}) {
  const clientId = String(payload.clientId || '').trim()
  const fileName = String(payload.fileName || '').trim()
  const fileSize = Number(payload.fileSize ?? 0)
  const contentType = String(payload.contentType || '').trim() || getContentTypeFromFileName(fileName)
  const preferences = normalizePreferences(payload.preferences)

  if (!clientId) {
    return { validationError: 'Client id is required.' }
  }

  if (!fileName) {
    return { validationError: 'Source spreadsheet file name is required.' }
  }

  if (!isSupportedSourceFile({ contentType, fileName })) {
    return { validationError: 'Only XLSM, XLSX, XLS, and CSV files are supported.' }
  }

  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return { validationError: 'A valid source spreadsheet size is required.' }
  }

  const ownedClient = await findOwnedClient(owner.userId, clientId)

  if (!ownedClient) {
    return { notFound: 'Client not found for this user.' }
  }

  assertS3Configured()

  const jobId = new mongoose.Types.ObjectId()
  const { bucketName } = getS3Config()
  const normalizedFileName = normalizeFileName(fileName, 'source.xlsx')
  const sourceKey = buildStorageKey({
    clientId,
    entryId: String(jobId),
    fileName: normalizedFileName,
    ownerUserId: owner.userId,
    variant: 'source',
  })
  const sourceUploadUrl = await createSignedUploadUrl({
    contentType,
    key: sourceKey,
  })

  const job = new TallyXmlConversionJob({
    _id: jobId,
    clientId,
    clientName: ownedClient.name,
    owner: {
      email: owner.email,
      lastSeenAt: new Date(),
      userId: owner.userId,
    },
    preferences,
    sourceFile: {
      bucket: bucketName,
      contentType,
      fileName: normalizedFileName,
      key: sourceKey,
      sizeBytes: fileSize,
      uploadedAt: new Date(),
    },
    status: 'processing',
  })

  await job.save()

  return {
    collection: TALLY_XML_CONVERSION_COLLECTION,
    entry: await buildSerializedTallyJob(job),
    sourceUpload: {
      method: 'PUT',
      url: sourceUploadUrl,
    },
    validationError: null,
  }
}

export async function updateTallyXmlJob(owner, payload = {}, options = {}) {
  const entryId = String(payload.entryId || '').trim()
  const status = String(payload.status || '').trim().toLowerCase()

  if (!entryId || !mongoose.isValidObjectId(entryId)) {
    return { validationError: 'A valid Tally XML history entry id is required.' }
  }

  if (!PROCESSING_STATUSES.has(status) || status === 'processing') {
    return { validationError: 'A valid final Tally XML status is required.' }
  }

  const job = await TallyXmlConversionJob.findOne({
    _id: entryId,
    'owner.userId': owner.userId,
  })

  if (!job) {
    return { notFound: 'Tally XML history entry not found.' }
  }

  job.owner.email = owner.email
  job.owner.lastSeenAt = new Date()
  job.completedAt = new Date()

  if (status === 'failed') {
    job.status = 'failed'
    job.errorMessage = String(payload.errorMessage || 'Tally XML conversion failed.').trim()
    await job.save()

    return {
      collection: TALLY_XML_CONVERSION_COLLECTION,
      entry: await buildSerializedTallyJob(job),
      validationError: null,
    }
  }

  job.status = 'completed'
  job.errorMessage = ''
  job.processor.fileId = String(payload.fileId || '').trim()
  job.processor.processingTimeSec = normalizeProcessingTime(payload.processingTimeSec)

  const remoteDownloadUrl = resolveAbsoluteDownloadUrl(payload.downloadHref, payload.downloadUrl)
  job.processor.remoteDownloadUrl = remoteDownloadUrl

  try {
    const storedResult = await storeRemoteResultFile({
      authorizationHeader: options.authorizationHeader || '',
      clientId: job.clientId,
      downloadHref: payload.downloadHref,
      downloadUrl: payload.downloadUrl,
      entryId: String(job._id),
      ownerUserId: owner.userId,
      sourceFileName: job.sourceFile?.fileName || 'source.xlsx',
    })

    if (storedResult) {
      job.resultFile = storedResult
    }
  } catch (error) {
    console.error('[tally-xml:result-upload]', {
      entryId,
      message: error?.message || 'Unknown error',
    })
  }

  await job.save()

  return {
    collection: TALLY_XML_CONVERSION_COLLECTION,
    entry: await buildSerializedTallyJob(job),
    validationError: null,
  }
}
