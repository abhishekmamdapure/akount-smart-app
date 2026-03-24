import mongoose from 'mongoose'
import { ClientWorkspace } from '../models/client.js'
import {
  GST_RECONCILIATION_COLLECTION,
  GstReconciliationJob,
} from '../models/gstReconciliation.js'
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

const GST_TYPES = new Set(['gst_2b', 'gst_4a'])
const PROCESSING_STATUSES = new Set(['processing', 'completed', 'failed'])
const SUPPORTED_SOURCE_EXTENSIONS = ['.xlsx', '.xls']
const SUPPORTED_CONTENT_TYPES = new Set([
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

function normalizeProcessingTime(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const numeric = Number(value)

  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null
}

function normalizeTolerance(value, fallback = 10) {
  if (value === null || value === undefined || value === '') {
    return fallback
  }

  const numeric = Number(value)

  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined) {
    return fallback
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()

    if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
      return true
    }

    if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
      return false
    }
  }

  return Boolean(value)
}

function normalizeFileName(value, fallback = 'source.xlsx') {
  return sanitizeObjectFileName(value, fallback)
}

function deriveResultFileName(sourceFileName, type = 'gst_2b') {
  const normalizedSource = normalizeFileName(sourceFileName, 'purchase-register.xlsx')
  const parts = normalizedSource.split('.')

  if (parts.length > 1) {
    parts.pop()
  }

  const baseName = parts.join('.') || 'gst-reconciliation'
  const suffix = type === 'gst_4a' ? '4a' : '2b'
  return `${baseName}-reconciliation-${suffix}.xlsx`
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

  const apiBaseUrl = String(
    process.env.GST_RECONCILIATION_API_BASE_URL || process.env.VITE_GST_RECONCILIATION_API_BASE_URL || '',
  ).trim()

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

  if (extension === '.xls') {
    return 'application/vnd.ms-excel'
  }

  if (extension === '.xlsx') {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }

  return fallback
}

function isSupportedSpreadsheet({ contentType, fileName }) {
  const extension = getFileExtension(fileName)

  if (extension) {
    return true
  }

  return SUPPORTED_CONTENT_TYPES.has(String(contentType || '').trim().toLowerCase())
}

function normalizeSourceDescriptor(payload = {}, fallbackFileName) {
  const fileName = normalizeFileName(payload.fileName, fallbackFileName)
  const contentType = String(payload.contentType || '').trim() || getContentTypeFromFileName(fileName)
  const fileSize = Number(payload.fileSize ?? 0)

  return {
    contentType,
    fileName,
    fileSize,
  }
}

function buildStorageKey({ clientId, entryId, fileName, ownerUserId, variant }) {
  const ownerSegment = sanitizeObjectSegment(ownerUserId, 'user')
  const clientSegment = sanitizeObjectSegment(clientId, 'client')
  const fallbackName =
    variant === 'purchase'
      ? 'purchase-register.xlsx'
      : variant === 'gst'
        ? 'gst-file.xlsx'
        : 'gst-reconciliation.xlsx'
  const safeFileName = normalizeFileName(fileName, fallbackName)

  return `gst-reconciliation/${ownerSegment}/${clientSegment}/${entryId}/${variant}/${safeFileName}`
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

async function buildSerializedGstJob(job) {
  const purchaseFile = job.purchaseFile?.toObject ? job.purchaseFile.toObject() : job.purchaseFile || {}
  const gstFile = job.gstFile?.toObject ? job.gstFile.toObject() : job.gstFile || {}
  const resultFile = job.resultFile?.toObject ? job.resultFile.toObject() : job.resultFile || {}
  const processor = job.processor?.toObject ? job.processor.toObject() : job.processor || {}
  const settings = job.settings?.toObject ? job.settings.toObject() : job.settings || {}

  let purchaseDownloadHref = ''
  let gstFileDownloadHref = ''
  let downloadHref = ''

  if (isS3Configured()) {
    if (purchaseFile.key) {
      purchaseDownloadHref = await createSignedDownloadUrl({
        fileName: purchaseFile.fileName || 'purchase-register.xlsx',
        key: purchaseFile.key,
      })
    }

    if (gstFile.key) {
      gstFileDownloadHref = await createSignedDownloadUrl({
        fileName: gstFile.fileName || 'gst-file.xlsx',
        key: gstFile.key,
      })
    }

    if (resultFile.key) {
      downloadHref = await createSignedDownloadUrl({
        fileName: resultFile.fileName || 'gst-reconciliation.xlsx',
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
    gstFileDownloadHref,
    gstFileName: gstFile.fileName || '',
    id: String(job._id),
    ignoreDecimal: Boolean(settings.ignoreDecimal),
    processingTimeSec: normalizeProcessingTime(processor.processingTimeSec),
    purchaseDownloadHref,
    purchaseFileName: purchaseFile.fileName || '',
    resultFileName: resultFile.fileName || '',
    status: job.status,
    tolerance: normalizeTolerance(settings.tolerance, 10),
    type: job.type,
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
  type,
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
    throw new Error(`Unable to fetch GST reconciliation result file (${response.status}).`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const responseContentType = response.headers.get('content-type') || ''
  const remoteFileName = response.headers
    .get('content-disposition')
    ?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)?.[1]

  const normalizedFileName = normalizeFileName(
    remoteFileName || deriveResultFileName(sourceFileName, type),
    deriveResultFileName(sourceFileName, type),
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
    contentType: responseContentType || getContentTypeFromFileName(normalizedFileName),
    fileName: normalizedFileName,
    key,
  })

  return {
    bucket: bucketName,
    contentType: responseContentType || getContentTypeFromFileName(normalizedFileName),
    fileName: normalizedFileName,
    key,
    sizeBytes: buffer.byteLength,
    uploadedAt: new Date(),
  }
}

export async function listGstReconciliationJobs(owner, clientId) {
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

  const jobs = await GstReconciliationJob.find({
    'owner.userId': owner.userId,
    clientId: normalizedClientId,
  })
    .lean()
    .sort({ createdAt: -1 })
    .limit(100)

  const items = await Promise.all(jobs.map((job) => buildSerializedGstJob(job)))

  return {
    clientName: ownedClient.name,
    items,
    validationError: null,
  }
}

export async function createGstReconciliationJob(owner, payload = {}) {
  const clientId = String(payload.clientId || '').trim()
  const type = String(payload.type || '').trim().toLowerCase()
  const tolerance = normalizeTolerance(payload.tolerance)
  const ignoreDecimal = normalizeBoolean(payload.ignoreDecimal, false)
  const purchaseFile = normalizeSourceDescriptor(payload.purchaseFile, 'purchase-register.xlsx')
  const gstFile = normalizeSourceDescriptor(
    payload.gstFile,
    type === 'gst_4a' ? 'gstr-4a.xlsx' : 'gstr-2b.xlsx',
  )

  if (!clientId) {
    return { validationError: 'Client id is required.' }
  }

  if (!GST_TYPES.has(type)) {
    return { validationError: 'A valid GST reconciliation type is required.' }
  }

  if (tolerance === null) {
    return { validationError: 'A valid reconciliation tolerance is required.' }
  }

  if (!purchaseFile.fileName) {
    return { validationError: 'Purchase register file name is required.' }
  }

  if (!gstFile.fileName) {
    return { validationError: 'GST file name is required.' }
  }

  if (!isSupportedSpreadsheet(purchaseFile)) {
    return { validationError: 'Purchase register must be an Excel file (.xlsx or .xls).' }
  }

  if (!isSupportedSpreadsheet(gstFile)) {
    return { validationError: 'GST file must be an Excel file (.xlsx or .xls).' }
  }

  if (!Number.isFinite(purchaseFile.fileSize) || purchaseFile.fileSize <= 0) {
    return { validationError: 'A valid purchase register file size is required.' }
  }

  if (!Number.isFinite(gstFile.fileSize) || gstFile.fileSize <= 0) {
    return { validationError: 'A valid GST file size is required.' }
  }

  const ownedClient = await findOwnedClient(owner.userId, clientId)

  if (!ownedClient) {
    return { notFound: 'Client not found for this user.' }
  }

  assertS3Configured()

  const jobId = new mongoose.Types.ObjectId()
  const { bucketName } = getS3Config()
  const purchaseKey = buildStorageKey({
    clientId,
    entryId: String(jobId),
    fileName: purchaseFile.fileName,
    ownerUserId: owner.userId,
    variant: 'purchase',
  })
  const gstKey = buildStorageKey({
    clientId,
    entryId: String(jobId),
    fileName: gstFile.fileName,
    ownerUserId: owner.userId,
    variant: 'gst',
  })

  const purchaseUploadUrl = await createSignedUploadUrl({
    contentType: purchaseFile.contentType,
    key: purchaseKey,
  })
  const gstUploadUrl = await createSignedUploadUrl({
    contentType: gstFile.contentType,
    key: gstKey,
  })

  const job = new GstReconciliationJob({
    _id: jobId,
    clientId,
    clientName: ownedClient.name,
    owner: {
      email: owner.email,
      lastSeenAt: new Date(),
      userId: owner.userId,
    },
    purchaseFile: {
      bucket: bucketName,
      contentType: purchaseFile.contentType,
      fileName: purchaseFile.fileName,
      key: purchaseKey,
      sizeBytes: purchaseFile.fileSize,
      uploadedAt: new Date(),
    },
    gstFile: {
      bucket: bucketName,
      contentType: gstFile.contentType,
      fileName: gstFile.fileName,
      key: gstKey,
      sizeBytes: gstFile.fileSize,
      uploadedAt: new Date(),
    },
    settings: {
      ignoreDecimal,
      tolerance,
    },
    status: 'processing',
    type,
  })

  await job.save()

  return {
    collection: GST_RECONCILIATION_COLLECTION,
    entry: await buildSerializedGstJob(job),
    gstUpload: {
      method: 'PUT',
      url: gstUploadUrl,
    },
    purchaseUpload: {
      method: 'PUT',
      url: purchaseUploadUrl,
    },
    validationError: null,
  }
}

export async function updateGstReconciliationJob(owner, payload = {}, options = {}) {
  const entryId = String(payload.entryId || '').trim()
  const status = String(payload.status || '').trim().toLowerCase()

  if (!entryId || !mongoose.isValidObjectId(entryId)) {
    return { validationError: 'A valid GST reconciliation history entry id is required.' }
  }

  if (!PROCESSING_STATUSES.has(status) || status === 'processing') {
    return { validationError: 'A valid final GST reconciliation status is required.' }
  }

  const job = await GstReconciliationJob.findOne({
    _id: entryId,
    'owner.userId': owner.userId,
  })

  if (!job) {
    return { notFound: 'GST reconciliation history entry not found.' }
  }

  job.owner.email = owner.email
  job.owner.lastSeenAt = new Date()
  job.completedAt = new Date()

  if (status === 'failed') {
    job.status = 'failed'
    job.errorMessage = String(payload.errorMessage || 'GST reconciliation failed.').trim()
    await job.save()

    return {
      collection: GST_RECONCILIATION_COLLECTION,
      entry: await buildSerializedGstJob(job),
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
      sourceFileName: job.purchaseFile?.fileName || 'purchase-register.xlsx',
      type: job.type,
    })

    if (storedResult) {
      job.resultFile = storedResult
    }
  } catch (error) {
    console.error('[gst-reconciliation:result-upload]', {
      entryId,
      message: error?.message || 'Unknown error',
    })
  }

  await job.save()

  return {
    collection: GST_RECONCILIATION_COLLECTION,
    entry: await buildSerializedGstJob(job),
    validationError: null,
  }
}
