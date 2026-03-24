import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const globalS3State = globalThis.__akountsmartS3 ?? {
  client: null,
  cacheKey: '',
}

globalThis.__akountsmartS3 = globalS3State

function readFirstEnv(...names) {
  for (const name of names) {
    const value = String(process.env[name] ?? '').trim()
    if (value) {
      return value
    }
  }

  return ''
}

export function getS3Config() {
  return {
    accessKeyId: readFirstEnv('S3_ACCESS_KEY_ID', 'AWS_ACCESS_KEY_ID'),
    bucketName: readFirstEnv('S3_BUCKET_NAME', 'AWS_S3_BUCKET_NAME'),
    endpointUrl: readFirstEnv('S3_ENDPOINT_URL', 'AWS_ENDPOINT_URL_S3', 'AWS_S3_ENDPOINT_URL'),
    region: readFirstEnv('S3_REGION', 'AWS_REGION', 'AWS_DEFAULT_REGION'),
    secretAccessKey: readFirstEnv('S3_SECRET_ACCESS_KEY', 'AWS_SECRET_ACCESS_KEY'),
  }
}

export function isS3Configured() {
  const config = getS3Config()

  return Boolean(
    config.bucketName &&
      config.endpointUrl &&
      config.region &&
      config.accessKeyId &&
      config.secretAccessKey,
  )
}

export function assertS3Configured() {
  const config = getS3Config()

  if (!config.endpointUrl) {
    throw new Error('S3 endpoint URL is not configured.')
  }

  if (!config.region) {
    throw new Error('S3 region is not configured.')
  }

  if (!config.bucketName) {
    throw new Error('S3 bucket name is not configured.')
  }

  if (!config.accessKeyId || !config.secretAccessKey) {
    throw new Error('S3 access credentials are not configured.')
  }

  return config
}

function getS3Client() {
  const config = assertS3Configured()
  const cacheKey = JSON.stringify(config)

  if (globalS3State.client && globalS3State.cacheKey === cacheKey) {
    return globalS3State.client
  }

  globalS3State.client = new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: config.endpointUrl,
    forcePathStyle: true,
    region: config.region,
  })
  globalS3State.cacheKey = cacheKey

  return globalS3State.client
}

function normalizeDownloadFileName(fileName = '') {
  return String(fileName || 'download')
    .replace(/["\r\n]/g, '')
    .trim()
}

export function sanitizeObjectSegment(value, fallback = 'item') {
  const sanitized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return sanitized || fallback
}

export function sanitizeObjectFileName(fileName, fallback = 'file.bin') {
  const source = String(fileName || '').trim()
  const parts = source.split('.')
  const extension = parts.length > 1 ? parts.pop() : ''
  const baseName = parts.join('.') || source
  const normalizedBase = baseName
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
  const normalizedExt = String(extension || '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase()

  if (!normalizedBase) {
    return fallback
  }

  return normalizedExt ? `${normalizedBase}.${normalizedExt}` : normalizedBase
}

export async function createSignedUploadUrl({ contentType, key, expiresIn = 900 }) {
  const client = getS3Client()
  const { bucketName } = assertS3Configured()

  const command = new PutObjectCommand({
    Bucket: bucketName,
    ContentType: contentType,
    Key: key,
  })

  return getSignedUrl(client, command, { expiresIn })
}

export async function createSignedDownloadUrl({ fileName, key, expiresIn = 3600 }) {
  const client = getS3Client()
  const { bucketName } = assertS3Configured()

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${normalizeDownloadFileName(fileName)}"`,
  })

  return getSignedUrl(client, command, { expiresIn })
}

export async function uploadBufferToS3({ buffer, contentType, fileName, key }) {
  const client = getS3Client()
  const { bucketName } = assertS3Configured()

  await client.send(
    new PutObjectCommand({
      Body: buffer,
      Bucket: bucketName,
      ContentDisposition: `attachment; filename="${normalizeDownloadFileName(fileName)}"`,
      ContentType: contentType,
      Key: key,
    }),
  )

  return {
    bucketName,
    key,
  }
}
