import mongoose from 'mongoose'
import { ClientWorkspace } from '../models/client.js'
import {
  INVOICE_PROCESSING_COLLECTION,
  InvoiceProcessingJob,
} from '../models/invoiceProcessing.js'
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

const PROCESSING_MODES = new Set(['separate', 'combined'])
const PROCESSING_STATUSES = new Set(['processing', 'completed', 'failed'])

function normalizeProcessingTime(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const numeric = Number(value)

  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null
}

function normalizeFileName(value, fallback = 'invoice.pdf') {
  return sanitizeObjectFileName(value, fallback)
}

function deriveResultFileName(sourceFileName, fallbackExtension = 'xlsx') {
  const normalizedSource = normalizeFileName(sourceFileName, 'invoice.pdf')
  const parts = normalizedSource.split('.')

  if (parts.length > 1) {
    parts.pop()
  }

  const baseName = parts.join('.') || 'invoice'
  return `${baseName}-processed.${fallbackExtension}`
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
    process.env.INVOICE_PROCESS_API_BASE_URL || process.env.VITE_INVOICE_PROCESS_API_BASE_URL || '',
  ).trim()

  if (apiBaseUrl && urlValue) {
    const normalizedPath = urlValue.startsWith('/') ? urlValue : `/${urlValue}`
    return `${apiBaseUrl.replace(/\/$/, '')}${normalizedPath}`
  }

  return ''
}

function getContentTypeFromFileName(fileName, fallback = 'application/octet-stream') {
  const normalized = String(fileName || '').toLowerCase()

  if (normalized.endsWith('.pdf')) {
    return 'application/pdf'
  }

  if (normalized.endsWith('.xlsx')) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }

  if (normalized.endsWith('.xls')) {
    return 'application/vnd.ms-excel'
  }

  if (normalized.endsWith('.csv')) {
    return 'text/csv'
  }

  return fallback
}

function buildStorageKey({ clientId, entryId, fileName, ownerUserId, variant }) {
  const ownerSegment = sanitizeObjectSegment(ownerUserId, 'user')
  const clientSegment = sanitizeObjectSegment(clientId, 'client')
  const safeFileName = normalizeFileName(
    fileName,
    variant === 'source' ? 'invoice.pdf' : 'invoice-processed.xlsx',
  )

  return `invoice-processing/${ownerSegment}/${clientSegment}/${entryId}/${variant}/${safeFileName}`
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

async function buildSerializedInvoiceJob(job) {
  const sourceFile = job.sourceFile?.toObject ? job.sourceFile.toObject() : job.sourceFile || {}
  const resultFile = job.resultFile?.toObject ? job.resultFile.toObject() : job.resultFile || {}
  const processor = job.processor?.toObject ? job.processor.toObject() : job.processor || {}

  let sourceDownloadHref = ''
  let downloadHref = ''

  if (isS3Configured()) {
    if (sourceFile.key) {
      sourceDownloadHref = await createSignedDownloadUrl({
        fileName: sourceFile.fileName || 'invoice.pdf',
        key: sourceFile.key,
      })
    }

    if (resultFile.key) {
      downloadHref = await createSignedDownloadUrl({
        fileName: resultFile.fileName || 'invoice-processed.xlsx',
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
    mode: job.mode,
    pages: processor.pages ?? null,
    processingTimeSec: normalizeProcessingTime(processor.processingTimeSec),
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
    throw new Error(`Unable to fetch processed file (${response.status}).`)
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

export async function listInvoiceProcessingJobs(owner, clientId) {
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

  const jobs = await InvoiceProcessingJob.find({
    'owner.userId': owner.userId,
    clientId: normalizedClientId,
  })
    .lean()
    .sort({ createdAt: -1 })
    .limit(100)

  const items = await Promise.all(jobs.map((job) => buildSerializedInvoiceJob(job)))

  return {
    clientName: ownedClient.name,
    items,
    validationError: null,
  }
}

export async function createInvoiceProcessingJob(owner, payload = {}) {
  const clientId = String(payload.clientId || '').trim()
  const mode = String(payload.mode || '').trim().toLowerCase()
  const fileName = String(payload.fileName || '').trim()
  const fileSize = Number(payload.fileSize ?? 0)
  const contentType = String(payload.contentType || '').trim() || getContentTypeFromFileName(fileName)

  if (!clientId) {
    return { validationError: 'Client id is required.' }
  }

  if (!fileName) {
    return { validationError: 'Invoice file name is required.' }
  }

  if (contentType !== 'application/pdf' && !fileName.toLowerCase().endsWith('.pdf')) {
    return { validationError: 'Only PDF files are supported for invoice processing.' }
  }

  if (!PROCESSING_MODES.has(mode)) {
    return { validationError: 'A valid processing mode is required.' }
  }

  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return { validationError: 'A valid invoice file size is required.' }
  }

  const ownedClient = await findOwnedClient(owner.userId, clientId)

  if (!ownedClient) {
    return { notFound: 'Client not found for this user.' }
  }

  assertS3Configured()

  const jobId = new mongoose.Types.ObjectId()
  const { bucketName } = getS3Config()
  const normalizedFileName = normalizeFileName(fileName, 'invoice.pdf')
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

  const job = new InvoiceProcessingJob({
    _id: jobId,
    clientId,
    clientName: ownedClient.name,
    mode,
    owner: {
      email: owner.email,
      lastSeenAt: new Date(),
      userId: owner.userId,
    },
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
    collection: INVOICE_PROCESSING_COLLECTION,
    entry: await buildSerializedInvoiceJob(job),
    sourceUpload: {
      method: 'PUT',
      url: sourceUploadUrl,
    },
    validationError: null,
  }
}

export async function updateInvoiceProcessingJob(owner, payload = {}, options = {}) {
  const entryId = String(payload.entryId || '').trim()
  const status = String(payload.status || '').trim().toLowerCase()

  if (!entryId || !mongoose.isValidObjectId(entryId)) {
    return { validationError: 'A valid invoice history entry id is required.' }
  }

  if (!PROCESSING_STATUSES.has(status) || status === 'processing') {
    return { validationError: 'A valid final invoice status is required.' }
  }

  const job = await InvoiceProcessingJob.findOne({
    _id: entryId,
    'owner.userId': owner.userId,
  })

  if (!job) {
    return { notFound: 'Invoice history entry not found.' }
  }

  job.owner.email = owner.email
  job.owner.lastSeenAt = new Date()
  job.completedAt = new Date()

  if (status === 'failed') {
    job.status = 'failed'
    job.errorMessage = String(payload.errorMessage || 'Invoice processing failed.').trim()
    await job.save()

    return {
      collection: INVOICE_PROCESSING_COLLECTION,
      entry: await buildSerializedInvoiceJob(job),
      validationError: null,
    }
  }

  job.status = 'completed'
  job.errorMessage = ''
  job.processor.fileId = String(payload.fileId || '').trim()
  job.processor.pages =
    payload.pages === null || payload.pages === undefined || payload.pages === ''
      ? null
      : Number(payload.pages)
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
      sourceFileName: job.sourceFile?.fileName || 'invoice.pdf',
    })

    if (storedResult) {
      job.resultFile = storedResult
    }
  } catch (error) {
    console.error('[invoice-processing:result-upload]', {
      entryId,
      message: error?.message || 'Unknown error',
    })
  }

  await job.save()

  return {
    collection: INVOICE_PROCESSING_COLLECTION,
    entry: await buildSerializedInvoiceJob(job),
    validationError: null,
  }
}
