import {
  PAGE_NUMBER_DEFAULTS,
  buildPageNumberText,
  resolvePageNumberRange,
  validatePageNumberColor,
  validatePageNumberFontSize,
  validatePageNumberRange,
  validatePageNumberStartFrom,
} from './pageNumbersHelpers'
import { calculatePdfCompressionStats, getPdfCompressionPreset } from './pdfCompressionHelpers'

const SCRIPT_LOADERS = new Map()

const TOOL_LABELS = Object.freeze({
  compress_pdf: 'Compress PDF',
  split_merge: 'Split / Merge',
  reorder_delete: 'Reorder / Delete',
  page_numbers: 'Page Numbers',
  watermark: 'Watermark',
  to_word: 'Convert to Word',
  to_excel: 'Convert to Excel',
})

const PDF_LIB_SRC = 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js'
const PDF_JS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
const PDF_JS_WORKER_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
const TESSERACT_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'
const DOCX_SRC = 'https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js'
const XLSX_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'

function ensureBrowser() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('PDF tools are available only in browser context.')
  }
}

function loadScriptOnce(key, src, resolveGlobal) {
  ensureBrowser()

  const existing = resolveGlobal()

  if (existing) {
    return Promise.resolve(existing)
  }

  if (SCRIPT_LOADERS.has(key)) {
    return SCRIPT_LOADERS.get(key)
  }

  const loader = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => {
      const value = resolveGlobal()

      if (!value) {
        reject(new Error(`Script loaded but ${key} global is missing.`))
        SCRIPT_LOADERS.delete(key)
        return
      }

      resolve(value)
    }
    script.onerror = () => {
      reject(new Error(`Unable to load ${key} library.`))
      SCRIPT_LOADERS.delete(key)
    }

    document.head.append(script)
  })

  SCRIPT_LOADERS.set(key, loader)

  return loader
}

async function getPdfLib() {
  return loadScriptOnce('pdf-lib', PDF_LIB_SRC, () => window.PDFLib)
}

async function getPdfJs() {
  const pdfjsLib = await loadScriptOnce('pdf.js', PDF_JS_SRC, () => window.pdfjsLib)

  if (pdfjsLib?.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_JS_WORKER_SRC
  }

  return pdfjsLib
}

async function getTesseract() {
  return loadScriptOnce('tesseract', TESSERACT_SRC, () => window.Tesseract)
}

async function getDocx() {
  return loadScriptOnce('docx', DOCX_SRC, () => window.docx)
}

async function getXlsx() {
  return loadScriptOnce('xlsx', XLSX_SRC, () => window.XLSX)
}

export function getToolLabel(toolKey) {
  return TOOL_LABELS[toolKey] || toolKey
}

export function formatFileSize(sizeBytes) {
  const value = Number(sizeBytes)

  if (!Number.isFinite(value) || value <= 0) {
    return '0 KB'
  }

  if (value < 1024) {
    return `${Math.round(value)} B`
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

export function formatDurationMs(value) {
  const numeric = Number(value)

  if (!Number.isFinite(numeric) || numeric < 0) {
    return '-'
  }

  if (numeric < 1000) {
    return `${Math.round(numeric)} ms`
  }

  return `${(numeric / 1000).toFixed(2)} s`
}

export async function fileToUint8Array(file) {
  const arrayBuffer = await file.arrayBuffer()
  return new Uint8Array(arrayBuffer)
}

export function downloadBlob(blob, fileName) {
  ensureBrowser()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1200)
}

export function downloadBytes(bytes, fileName, mimeType = 'application/pdf') {
  const blob = new Blob([bytes], { type: mimeType })
  downloadBlob(blob, fileName)
}

export function sanitizeFileBase(fileName = '', fallback = 'document') {
  const name = String(fileName || '').trim()

  if (!name) {
    return fallback
  }

  const withoutExtension = name.replace(/\.[^.]+$/, '')
  const normalized = withoutExtension.replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '')

  return normalized || fallback
}

export function parseIntegerList(inputValue = '', { min = 1, max = Number.POSITIVE_INFINITY } = {}) {
  const parts = String(inputValue || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  const values = []

  for (const part of parts) {
    const numeric = Number(part)

    if (!Number.isInteger(numeric)) {
      throw new Error(`"${part}" is not a valid whole number.`)
    }

    if (numeric < min || numeric > max) {
      throw new Error(`Value ${numeric} is out of allowed range (${min}-${max}).`)
    }

    values.push(numeric)
  }

  return [...new Set(values)].sort((a, b) => a - b)
}

export async function getPdfPageCount(file) {
  const pdfLib = await getPdfLib()
  const { PDFDocument } = pdfLib
  const bytes = await fileToUint8Array(file)
  const doc = await PDFDocument.load(bytes)
  return doc.getPageCount()
}

export async function renderPdfThumbnails(file, { scale = 0.25, maxPages = 120 } = {}) {
  const pdfjsLib = await getPdfJs()
  const bytes = await file.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({ data: bytes })
  const pdf = await loadingTask.promise
  const totalPages = Math.min(pdf.numPages, maxPages)
  const thumbnails = []

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')

    canvas.width = viewport.width
    canvas.height = viewport.height

    if (!context) {
      throw new Error('Unable to render page thumbnail.')
    }

    await page.render({ canvasContext: context, viewport }).promise

    thumbnails.push({
      pageNumber,
      dataUrl: canvas.toDataURL('image/png'),
      width: canvas.width,
      height: canvas.height,
    })
  }

  if (pdf.destroy) {
    pdf.destroy()
  }

  return {
    pageCount: pdf.numPages,
    thumbnails,
  }
}

function parseColorHexToRgb(color = '#666666') {
  const value = String(color || '').trim().replace('#', '')

  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    return { r: 0.5, g: 0.5, b: 0.5 }
  }

  const red = parseInt(value.slice(0, 2), 16) / 255
  const green = parseInt(value.slice(2, 4), 16) / 255
  const blue = parseInt(value.slice(4, 6), 16) / 255

  return {
    r: red,
    g: green,
    b: blue,
  }
}

function buildSplitAfterPages(pageCount, { mode, splitAfterPagesInput, everyN }) {
  if (mode === 'every_n') {
    const chunkSize = Number(everyN)

    if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
      throw new Error('Every N Pages value must be a positive whole number.')
    }

    const splitAfter = []

    for (let page = chunkSize; page < pageCount; page += chunkSize) {
      splitAfter.push(page - 1)
    }

    return splitAfter
  }

  const splitAfterPages = parseIntegerList(splitAfterPagesInput, {
    min: 1,
    max: Math.max(1, pageCount - 1),
  })

  return splitAfterPages.map((pageNumber) => pageNumber - 1)
}

export async function splitPdfFile(file, options = {}) {
  const pdfLib = await getPdfLib()
  const { PDFDocument } = pdfLib
  const bytes = await fileToUint8Array(file)
  const sourceDoc = await PDFDocument.load(bytes)
  const pageCount = sourceDoc.getPageCount()

  if (pageCount < 2) {
    throw new Error('At least two pages are required to split a PDF.')
  }

  const splitAfter = buildSplitAfterPages(pageCount, options)
  const baseName = sanitizeFileBase(file.name, 'split')

  const ranges = []
  let start = 0

  splitAfter.forEach((cutIndex) => {
    ranges.push([start, cutIndex])
    start = cutIndex + 1
  })

  ranges.push([start, pageCount - 1])

  const downloads = []

  for (let index = 0; index < ranges.length; index += 1) {
    const [rangeStart, rangeEnd] = ranges[index]
    const nextDoc = await PDFDocument.create()
    const pageIndexes = Array.from({ length: rangeEnd - rangeStart + 1 }, (_, offset) => rangeStart + offset)
    const copiedPages = await nextDoc.copyPages(sourceDoc, pageIndexes)

    copiedPages.forEach((page) => nextDoc.addPage(page))

    const nextBytes = await nextDoc.save()

    downloads.push({
      fileName: `${baseName}-part-${index + 1}.pdf`,
      bytes: nextBytes,
    })
  }

  return {
    downloads,
    summary: `split into ${downloads.length} files`,
  }
}

export async function mergePdfFiles(files = []) {
  if (!Array.isArray(files) || files.length < 2) {
    throw new Error('Select at least two PDF files to merge.')
  }

  const pdfLib = await getPdfLib()
  const { PDFDocument } = pdfLib
  const outputDoc = await PDFDocument.create()

  for (const file of files) {
    const bytes = await fileToUint8Array(file)
    const doc = await PDFDocument.load(bytes)
    const copiedPages = await outputDoc.copyPages(doc, doc.getPageIndices())
    copiedPages.forEach((page) => outputDoc.addPage(page))
  }

  const baseName = sanitizeFileBase(files[0]?.name, 'merged')

  return {
    fileName: `${baseName}-merged.pdf`,
    bytes: await outputDoc.save(),
    summary: `merged ${files.length} files`,
  }
}

export async function reorderAndDeletePdf(file, { orderedPageNumbers = [] } = {}) {
  if (!Array.isArray(orderedPageNumbers) || orderedPageNumbers.length === 0) {
    throw new Error('At least one page must remain in the final PDF.')
  }

  const pdfLib = await getPdfLib()
  const { PDFDocument } = pdfLib
  const bytes = await fileToUint8Array(file)
  const sourceDoc = await PDFDocument.load(bytes)
  const pageCount = sourceDoc.getPageCount()

  const pageIndexes = orderedPageNumbers.map((pageNumber) => {
    const numeric = Number(pageNumber)

    if (!Number.isInteger(numeric) || numeric < 1 || numeric > pageCount) {
      throw new Error(`Page ${pageNumber} is outside the valid range.`)
    }

    return numeric - 1
  })

  const nextDoc = await PDFDocument.create()
  const copiedPages = await nextDoc.copyPages(sourceDoc, pageIndexes)
  copiedPages.forEach((page) => nextDoc.addPage(page))

  const baseName = sanitizeFileBase(file.name, 'reordered')

  return {
    fileName: `${baseName}-reordered.pdf`,
    bytes: await nextDoc.save(),
    summary: `saved ${pageIndexes.length} pages`,
  }
}

function parseSkipPages(skipPagesInput, totalPages) {
  if (!String(skipPagesInput || '').trim()) {
    return new Set()
  }

  return new Set(parseIntegerList(skipPagesInput, { min: 1, max: totalPages }))
}

function getPageNumberCoordinates({ position, width, height, textWidth, fontSize }) {
  const margin = PAGE_NUMBER_DEFAULTS.outputMargin

  if (position === 'bottom_right') {
    return {
      x: width - textWidth - margin,
      y: margin,
    }
  }

  if (position === 'bottom_left') {
    return {
      x: margin,
      y: margin,
    }
  }

  if (position === 'top_center') {
    return {
      x: (width - textWidth) / 2,
      y: height - fontSize - margin,
    }
  }

  if (position === 'top_right') {
    return {
      x: width - textWidth - margin,
      y: height - fontSize - margin,
    }
  }

  if (position === 'top_left') {
    return {
      x: margin,
      y: height - fontSize - margin,
    }
  }

  return {
    x: (width - textWidth) / 2,
    y: margin,
  }
}

export async function addPageNumbersToPdf(file, options = {}) {
  const pdfLib = await getPdfLib()
  const { PDFDocument, StandardFonts, rgb } = pdfLib
  const bytes = await fileToUint8Array(file)
  const doc = await PDFDocument.load(bytes)
  const pages = doc.getPages()
  const totalPages = pages.length
  const startFromError = validatePageNumberStartFrom(options.startFrom ?? PAGE_NUMBER_DEFAULTS.startFrom)
  const fontSizeError = validatePageNumberFontSize(options.fontSize ?? PAGE_NUMBER_DEFAULTS.fontSize)
  const fontColorValue = options.fontColor ?? PAGE_NUMBER_DEFAULTS.fontColor
  const fontColorError = validatePageNumberColor(fontColorValue)
  const pageRangeError = validatePageNumberRange(options.pageRangeStart, options.pageRangeEnd, totalPages)

  if (startFromError) {
    throw new Error(startFromError)
  }

  if (fontSizeError) {
    throw new Error(fontSizeError)
  }

  if (fontColorError) {
    throw new Error(fontColorError)
  }

  if (pageRangeError) {
    throw new Error(pageRangeError)
  }

  const startFrom = Number.parseInt(options.startFrom ?? PAGE_NUMBER_DEFAULTS.startFrom, 10)
  const fontSize = Number.parseInt(options.fontSize ?? PAGE_NUMBER_DEFAULTS.fontSize, 10)
  const position = options.position || PAGE_NUMBER_DEFAULTS.position
  const skipPages = parseSkipPages(options.skipPagesInput, totalPages)
  const pageRange = resolvePageNumberRange(options.pageRangeStart, options.pageRangeEnd, totalPages)
  const targetPages = pages
    .map((_, index) => index + 1)
    .filter((pageNumber) => pageNumber >= pageRange.start && pageNumber <= pageRange.end && !skipPages.has(pageNumber))
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const color = parseColorHexToRgb(fontColorValue)

  if (targetPages.length === 0) {
    throw new Error('No pages matched the selected range and skip settings.')
  }

  const targetPageSet = new Set(targetPages)
  const numberingTotal = startFrom + targetPages.length - 1
  let numberedCount = 0

  pages.forEach((page, index) => {
    const renderedPage = index + 1

    if (!targetPageSet.has(renderedPage)) {
      return
    }

    const text = buildPageNumberText(options.format || PAGE_NUMBER_DEFAULTS.format, startFrom + numberedCount, numberingTotal)
    const { width, height } = page.getSize()
    const textWidth = font.widthOfTextAtSize(text, fontSize)
    const { x, y } = getPageNumberCoordinates({ position, width, height, textWidth, fontSize })

    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(color.r, color.g, color.b),
    })

    numberedCount += 1
  })

  const baseName = sanitizeFileBase(file.name, 'numbered')

  return {
    fileName: `${baseName}-numbered.pdf`,
    bytes: await doc.save(),
    summary: `added page numbers to ${targetPages.length} pages`,
  }
}

function getWatermarkPosition({ position, width, height, contentWidth, contentHeight }) {
  const margin = 28

  if (position === 'top_left') {
    return { x: margin, y: height - contentHeight - margin }
  }

  if (position === 'top_right') {
    return { x: width - contentWidth - margin, y: height - contentHeight - margin }
  }

  if (position === 'bottom_left') {
    return { x: margin, y: margin }
  }

  if (position === 'bottom_right') {
    return { x: width - contentWidth - margin, y: margin }
  }

  return {
    x: (width - contentWidth) / 2,
    y: (height - contentHeight) / 2,
  }
}

export async function addTextWatermarkToPdf(file, options = {}) {
  const pdfLib = await getPdfLib()
  const { PDFDocument, StandardFonts, rgb, degrees } = pdfLib
  const bytes = await fileToUint8Array(file)
  const doc = await PDFDocument.load(bytes)
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const pages = doc.getPages()
  const text = String(options.text || 'CONFIDENTIAL').trim() || 'CONFIDENTIAL'
  const fontSize = Number(options.fontSize) || 42
  const opacity = Number(options.opacity)
  const normalizedOpacity = Number.isFinite(opacity) ? Math.min(1, Math.max(0.05, opacity)) : 0.25
  const angle = Number(options.angle)
  const rotation = Number.isFinite(angle) ? angle : -35
  const color = parseColorHexToRgb(options.color)

  pages.forEach((page) => {
    const { width, height } = page.getSize()
    const textWidth = font.widthOfTextAtSize(text, fontSize)
    const textHeight = fontSize
    const position = getWatermarkPosition({
      position: options.position || 'center',
      width,
      height,
      contentWidth: textWidth,
      contentHeight: textHeight,
    })

    page.drawText(text, {
      x: position.x,
      y: position.y,
      size: fontSize,
      font,
      color: rgb(color.r, color.g, color.b),
      opacity: normalizedOpacity,
      rotate: degrees(rotation),
    })
  })

  const baseName = sanitizeFileBase(file.name, 'watermarked')

  return {
    fileName: `${baseName}-watermark.pdf`,
    bytes: await doc.save(),
    summary: `applied text watermark`,
  }
}

async function imageFileToPngBytes(file, grayscale = false) {
  ensureBrowser()

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()

    image.onload = async () => {
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')

      canvas.width = image.width
      canvas.height = image.height

      if (!context) {
        URL.revokeObjectURL(url)
        reject(new Error('Unable to process watermark image.'))
        return
      }

      context.drawImage(image, 0, 0)

      if (grayscale) {
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height)

        for (let index = 0; index < imageData.data.length; index += 4) {
          const grey = Math.round(
            0.299 * imageData.data[index] +
              0.587 * imageData.data[index + 1] +
              0.114 * imageData.data[index + 2],
          )
          imageData.data[index] = grey
          imageData.data[index + 1] = grey
          imageData.data[index + 2] = grey
        }

        context.putImageData(imageData, 0, 0)
      }

      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            URL.revokeObjectURL(url)
            reject(new Error('Unable to encode watermark image.'))
            return
          }

          const arrayBuffer = await blob.arrayBuffer()
          URL.revokeObjectURL(url)
          resolve(new Uint8Array(arrayBuffer))
        },
        'image/png',
        1,
      )
    }

    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Unable to load watermark image.'))
    }

    image.src = url
  })
}

function applyCanvasGrayscale(context, width, height) {
  const imageData = context.getImageData(0, 0, width, height)

  for (let index = 0; index < imageData.data.length; index += 4) {
    const grey = Math.round(
      0.299 * imageData.data[index] +
        0.587 * imageData.data[index + 1] +
        0.114 * imageData.data[index + 2],
    )
    imageData.data[index] = grey
    imageData.data[index + 1] = grey
    imageData.data[index + 2] = grey
  }

  context.putImageData(imageData, 0, 0)
}

async function canvasToJpegBytes(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error('Unable to encode the compressed PDF page preview.'))
          return
        }

        const arrayBuffer = await blob.arrayBuffer()
        resolve(new Uint8Array(arrayBuffer))
      },
      'image/jpeg',
      quality,
    )
  })
}

export async function addImageWatermarkToPdf(file, options = {}) {
  if (!options.imageFile) {
    throw new Error('Select a watermark image to continue.')
  }

  const pdfLib = await getPdfLib()
  const { PDFDocument } = pdfLib
  const bytes = await fileToUint8Array(file)
  const doc = await PDFDocument.load(bytes)
  const imageBytes = await imageFileToPngBytes(options.imageFile, Boolean(options.grayscale))
  const image = await doc.embedPng(imageBytes)
  const pages = doc.getPages()
  const scale = Number(options.scale)
  const normalizedScale = Number.isFinite(scale) ? Math.min(1.2, Math.max(0.1, scale)) : 0.35
  const opacity = Number(options.opacity)
  const normalizedOpacity = Number.isFinite(opacity) ? Math.min(1, Math.max(0.05, opacity)) : 0.35

  pages.forEach((page) => {
    const { width, height } = page.getSize()
    const scaled = image.scale(normalizedScale)
    const position = getWatermarkPosition({
      position: options.position || 'center',
      width,
      height,
      contentWidth: scaled.width,
      contentHeight: scaled.height,
    })

    page.drawImage(image, {
      x: position.x,
      y: position.y,
      width: scaled.width,
      height: scaled.height,
      opacity: normalizedOpacity,
    })
  })

  const baseName = sanitizeFileBase(file.name, 'watermarked')

  return {
    fileName: `${baseName}-watermark.pdf`,
    bytes: await doc.save(),
    summary: 'applied image watermark',
  }
}

export async function compressPdfFile(file, options = {}) {
  const preset = getPdfCompressionPreset(options.preset)
  const pdfLib = await getPdfLib()
  const pdfjsLib = await getPdfJs()
  const { PDFDocument } = pdfLib
  const sourceBytes = await fileToUint8Array(file)
  const loadingTask = pdfjsLib.getDocument({ data: sourceBytes })
  const pdf = await loadingTask.promise
  const outputDoc = await PDFDocument.create()
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {}
  const grayscale = Boolean(options.grayscale)

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      onProgress({ page: pageNumber, total: pdf.numPages })

      const page = await pdf.getPage(pageNumber)
      const viewport = page.getViewport({ scale: preset.renderScale })
      const [x1, y1, x2, y2] = page.view
      const pageWidth = Math.max(1, x2 - x1)
      const pageHeight = Math.max(1, y2 - y1)
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d', { alpha: false })

      canvas.width = Math.max(1, Math.round(viewport.width))
      canvas.height = Math.max(1, Math.round(viewport.height))

      if (!context) {
        throw new Error('Unable to render PDF page for compression.')
      }

      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)

      await page.render({ canvasContext: context, viewport }).promise

      if (grayscale) {
        applyCanvasGrayscale(context, canvas.width, canvas.height)
      }

      const imageBytes = await canvasToJpegBytes(canvas, preset.imageQuality)
      const image = await outputDoc.embedJpg(imageBytes)
      const outputPage = outputDoc.addPage([pageWidth, pageHeight])

      outputPage.drawImage(image, {
        height: pageHeight,
        width: pageWidth,
        x: 0,
        y: 0,
      })

      page.cleanup?.()
    }
  } finally {
    if (pdf.destroy) {
      pdf.destroy()
    }
  }

  const compressedBytes = await outputDoc.save({ useObjectStreams: true })
  const originalSize = sourceBytes.length
  const compressedSize = compressedBytes.length
  const shouldKeepCompressedOutput = compressedSize < originalSize
  const finalBytes = shouldKeepCompressedOutput ? compressedBytes : sourceBytes
  const stats = calculatePdfCompressionStats(originalSize, finalBytes.length)
  const baseName = sanitizeFileBase(file.name, 'document')
  const presetLabel = preset.label.toLowerCase()
  const summary = stats.wasReduced
    ? `compressed ${pdf.numPages} pages using ${presetLabel}${grayscale ? ' with grayscale' : ''}; ${stats.reductionPercent}% smaller (${formatFileSize(originalSize)} to ${formatFileSize(finalBytes.length)})`
    : `processed ${pdf.numPages} pages using ${presetLabel}${grayscale ? ' with grayscale' : ''}; the original file was already the smaller copy`

  return {
    bytes: finalBytes,
    fileName: `${baseName}-compressed.pdf`,
    originalSize,
    outputSize: finalBytes.length,
    reductionPercent: stats.reductionPercent,
    summary,
    wasReduced: stats.wasReduced,
  }
}

function groupTextItemsIntoLines(items = []) {
  const linesByY = new Map()

  items.forEach((item) => {
    const rawY = Number(item.transform?.[5] || 0)
    const roundedY = Math.round(rawY / 5) * 5

    if (!linesByY.has(roundedY)) {
      linesByY.set(roundedY, [])
    }

    linesByY.get(roundedY).push(String(item.str || '').trim())
  })

  return [...linesByY.entries()]
    .sort((a, b) => b[0] - a[0])
    .map((entry) => entry[1].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

async function extractLinesViaPdfJs(bytes) {
  const pdfjsLib = await getPdfJs()
  const loadingTask = pdfjsLib.getDocument({ data: bytes })
  const pdf = await loadingTask.promise
  const pages = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const textContent = await page.getTextContent()
    const lines = groupTextItemsIntoLines(textContent.items || [])
    pages.push({ pageNumber, lines })
  }

  if (pdf.destroy) {
    pdf.destroy()
  }

  const textLength = pages.reduce((acc, page) => acc + page.lines.join(' ').length, 0)

  return {
    pages,
    textLength,
  }
}

async function extractLinesViaOcr(bytes, { language = 'eng', onProgress = () => {} } = {}) {
  const pdfjsLib = await getPdfJs()
  const tesseract = await getTesseract()
  const loadingTask = pdfjsLib.getDocument({ data: bytes })
  const pdf = await loadingTask.promise
  const worker = await tesseract.createWorker(language, 1)
  const pages = []

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      onProgress({ page: pageNumber, total: pdf.numPages })

      const page = await pdf.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 2.1 })
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')

      canvas.width = viewport.width
      canvas.height = viewport.height

      if (!context) {
        throw new Error('Unable to render PDF page for OCR.')
      }

      await page.render({ canvasContext: context, viewport }).promise

      const result = await worker.recognize(canvas)
      const text = String(result?.data?.text || '')
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)

      pages.push({ pageNumber, lines })
    }
  } finally {
    if (worker?.terminate) {
      await worker.terminate()
    }

    if (pdf.destroy) {
      pdf.destroy()
    }
  }

  const textLength = pages.reduce((acc, page) => acc + page.lines.join(' ').length, 0)

  return {
    pages,
    textLength,
  }
}

async function extractPdfTextPages(bytes, { ocrLanguage = 'eng', onProgress = () => {} } = {}) {
  const pdfJsResult = await extractLinesViaPdfJs(bytes)

  if (pdfJsResult.textLength >= 40) {
    return {
      ...pdfJsResult,
      method: 'text',
    }
  }

  const ocrResult = await extractLinesViaOcr(bytes, {
    language: ocrLanguage,
    onProgress,
  })

  return {
    ...ocrResult,
    method: 'ocr',
  }
}

export async function convertPdfToWord(file, { ocrLanguage = 'eng', onProgress = () => {} } = {}) {
  const bytes = await fileToUint8Array(file)
  const extracted = await extractPdfTextPages(bytes, { ocrLanguage, onProgress })
  const docx = await getDocx()
  const { Document, Packer, Paragraph, HeadingLevel, PageBreak } = docx
  const baseName = sanitizeFileBase(file.name, 'document')

  const children = [
    new Paragraph({
      text: baseName,
      heading: HeadingLevel.HEADING_1,
    }),
  ]

  extracted.pages.forEach((page, pageIndex) => {
    children.push(
      new Paragraph({
        text: `Page ${page.pageNumber}`,
        heading: HeadingLevel.HEADING_2,
      }),
    )

    if (page.lines.length === 0) {
      children.push(new Paragraph({ text: ' ' }))
    } else {
      page.lines.forEach((line) => {
        children.push(new Paragraph({ text: line }))
      })
    }

    if (pageIndex < extracted.pages.length - 1) {
      children.push(new Paragraph({ children: [new PageBreak()] }))
    }
  })

  const doc = new Document({
    sections: [
      {
        children,
      },
    ],
  })

  const blob = await Packer.toBlob(doc)

  return {
    blob,
    fileName: `${baseName}.docx`,
    summary: `converted to .docx via ${extracted.method === 'ocr' ? 'OCR' : 'text extraction'}`,
    method: extracted.method,
    pageCount: extracted.pages.length,
  }
}

function parseBankLikeRows(lines = []) {
  const DATE_RE = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4})\b/
  const AMOUNT_RE = /-?[\d,]+\.\d{2}/g
  const rows = []

  lines.forEach((line) => {
    const dateMatch = line.match(DATE_RE)
    const amounts = [...line.matchAll(AMOUNT_RE)].map((match) => match[0])

    if (!dateMatch && amounts.length === 0) {
      return
    }

    const description = line
      .replace(DATE_RE, '')
      .replace(AMOUNT_RE, '')
      .replace(/\s+/g, ' ')
      .trim()

    rows.push({
      Date: dateMatch ? dateMatch[0] : '',
      Description: description,
      Debit: amounts[0] || '',
      Credit: amounts[1] || '',
      Balance: amounts[2] || amounts[1] || '',
    })
  })

  return rows
}

export async function convertPdfToExcel(file, { ocrLanguage = 'eng', onProgress = () => {} } = {}) {
  const bytes = await fileToUint8Array(file)
  const extracted = await extractPdfTextPages(bytes, { ocrLanguage, onProgress })
  const xlsx = await getXlsx()
  const baseName = sanitizeFileBase(file.name, 'document')

  const rows = []

  extracted.pages.forEach((page) => {
    const bankRows = parseBankLikeRows(page.lines)

    if (bankRows.length > 0) {
      bankRows.forEach((row) => rows.push({ Page: page.pageNumber, ...row }))
      return
    }

    page.lines.forEach((line) => {
      rows.push({
        Page: page.pageNumber,
        Date: '',
        Description: line,
        Debit: '',
        Credit: '',
        Balance: '',
      })
    })
  })

  if (rows.length === 0) {
    rows.push({
      Page: 1,
      Date: '',
      Description: 'No extractable rows found',
      Debit: '',
      Credit: '',
      Balance: '',
    })
  }

  const workbook = xlsx.utils.book_new()
  const worksheet = xlsx.utils.json_to_sheet(rows)
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Extracted')
  const outputArray = xlsx.write(workbook, { type: 'array', bookType: 'xlsx' })
  const blob = new Blob([outputArray], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  return {
    blob,
    fileName: `${baseName}.xlsx`,
    summary: `converted to .xlsx with ${rows.length} rows (${extracted.method})`,
    method: extracted.method,
    rowCount: rows.length,
  }
}
