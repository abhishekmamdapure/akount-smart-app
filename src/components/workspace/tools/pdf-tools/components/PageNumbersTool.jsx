import { useCallback, useEffect, useState } from 'react'
import WorkspaceIcon from '../../../WorkspaceIcon'
import styles from '../../shared/Tools.module.css'
import {
  addPageNumbersToPdf,
  downloadBytes,
  getPdfPageCount,
  parseIntegerList,
  renderPdfThumbnails,
} from '../pdfToolsOperations'
import {
  PAGE_NUMBER_DEFAULTS,
  PAGE_NUMBER_FORMAT_OPTIONS,
  PAGE_NUMBER_POSITION_OPTIONS,
  PAGE_NUMBER_STATUS_MESSAGES,
  buildPageNumberText,
  formatPageNumberPreviewText,
  getPageNumberPreviewStyle,
  resolvePageNumberRange,
  validatePageNumberColor,
  validatePageNumberFontSize,
  validatePageNumberRange,
  validatePageNumberStartFrom,
} from '../pageNumbersHelpers'
import { joinClasses } from './helpers'
import PdfDropzone from './PdfDropzone'

const EMPTY_ERRORS = Object.freeze({
  startFrom: '',
  fontSize: '',
  fontColor: '',
  pageRange: '',
  skipPages: '',
})

function createEmptyErrors() {
  return { ...EMPTY_ERRORS }
}

function LivePreview({ position, previewImage, previewText, fontColor, fontSize }) {
  const previewTextStyle = getPageNumberPreviewStyle(position, fontColor, fontSize)

  return (
    <div className={styles.pageNumberPreviewCard}>
      {previewImage?.dataUrl ? (
        <img
          alt="First page preview"
          className={styles.pageNumberPreviewImage}
          src={previewImage.dataUrl}
        />
      ) : null}

      {previewText ? (
        <span className={styles.pageNumberPreviewValue} style={previewTextStyle}>
          {previewText}
        </span>
      ) : null}
    </div>
  )
}

export default function PageNumbersTool({ onUsage }) {
  const [file, setFile] = useState(null)
  const [pageCount, setPageCount] = useState(null)
  const [previewImage, setPreviewImage] = useState(null)
  const [position, setPosition] = useState(PAGE_NUMBER_DEFAULTS.position)
  const [format, setFormat] = useState(PAGE_NUMBER_DEFAULTS.format)
  const [startFrom, setStartFrom] = useState(PAGE_NUMBER_DEFAULTS.startFrom)
  const [fontSize, setFontSize] = useState(PAGE_NUMBER_DEFAULTS.fontSize)
  const [fontColor, setFontColor] = useState(PAGE_NUMBER_DEFAULTS.fontColor)
  const [skipPagesInput, setSkipPagesInput] = useState('')
  const [pageRangeStart, setPageRangeStart] = useState('')
  const [pageRangeEnd, setPageRangeEnd] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [statusTone, setStatusTone] = useState('ready')
  const [statusMessage, setStatusMessage] = useState(PAGE_NUMBER_STATUS_MESSAGES.idle)
  const [errors, setErrors] = useState(() => createEmptyErrors())

  useEffect(() => {
    let isActive = true

    if (!file) {
      setPageCount(null)
      setPreviewImage(null)
      return undefined
    }

    Promise.allSettled([
      getPdfPageCount(file),
      renderPdfThumbnails(file, {
        scale: 0.7,
        maxPages: 1,
      }),
    ]).then(([pageCountResult, previewResult]) => {
      if (!isActive) {
        return
      }

      if (pageCountResult.status === 'fulfilled') {
        setPageCount(pageCountResult.value)
      } else {
        setPageCount(null)
      }

      if (previewResult.status === 'fulfilled') {
        setPreviewImage(previewResult.value.thumbnails[0] || null)
      } else {
        setPreviewImage(null)
      }
    })
      .catch(() => {
        if (isActive) {
          setPageCount(null)
          setPreviewImage(null)
        }
      })

    return () => {
      isActive = false
    }
  }, [file])

  const clearError = useCallback((field) => {
    setErrors((current) => ({
      ...current,
      [field]: '',
    }))
  }, [])

  const validateAll = useCallback(
    (resolvedPageCount) => {
      const nextErrors = {
        ...createEmptyErrors(),
        startFrom: validatePageNumberStartFrom(startFrom),
        fontSize: validatePageNumberFontSize(fontSize),
        fontColor: validatePageNumberColor(fontColor),
        pageRange: validatePageNumberRange(pageRangeStart, pageRangeEnd, resolvedPageCount),
      }

      if (skipPagesInput.trim() && Number.isInteger(resolvedPageCount)) {
        try {
          parseIntegerList(skipPagesInput, {
            min: 1,
            max: resolvedPageCount,
          })
        } catch (error) {
          nextErrors.skipPages = error?.message || 'Use comma-separated page numbers.'
        }
      }

      setErrors(nextErrors)
      return Object.values(nextErrors).every((value) => !value)
    },
    [fontColor, fontSize, pageRangeEnd, pageRangeStart, skipPagesInput, startFrom],
  )

  const handleFileChange = useCallback((fileValue) => {
    setFile(fileValue)
    setPageCount(null)
    setPreviewImage(null)
    setErrors(createEmptyErrors())
    setStatusTone('ready')
    setStatusMessage(PAGE_NUMBER_STATUS_MESSAGES.idle)
  }, [])

  async function handleProcess() {
    if (!file) {
      setStatusTone('warning')
      setStatusMessage(PAGE_NUMBER_STATUS_MESSAGES.missingFile)
      return
    }

    const startedAt = Date.now()
    setIsProcessing(true)
    setStatusTone('ready')
    setStatusMessage(PAGE_NUMBER_STATUS_MESSAGES.validating)

    try {
      const resolvedPageCount = pageCount ?? (await getPdfPageCount(file))

      if (pageCount !== resolvedPageCount) {
        setPageCount(resolvedPageCount)
      }

      if (!validateAll(resolvedPageCount)) {
        setStatusTone('warning')
        setStatusMessage(PAGE_NUMBER_STATUS_MESSAGES.invalid)
        return
      }

      setStatusMessage(PAGE_NUMBER_STATUS_MESSAGES.processing)

      const result = await addPageNumbersToPdf(file, {
        position,
        format,
        startFrom,
        fontSize,
        fontColor,
        skipPagesInput,
        pageRangeStart,
        pageRangeEnd,
      })

      downloadBytes(result.bytes, result.fileName)
      setStatusTone('success')
      setStatusMessage(`Done. ${result.summary}.`)

      await onUsage({
        tool: 'page_numbers',
        status: 'completed',
        summary: result.summary,
        durationMs: Date.now() - startedAt,
      })
    } catch (error) {
      const message = error?.message || 'Unable to add page numbers.'
      setStatusTone('warning')
      setStatusMessage(message)

      await onUsage({
        tool: 'page_numbers',
        status: 'failed',
        summary: message,
        durationMs: Date.now() - startedAt,
      })
    } finally {
      setIsProcessing(false)
    }
  }

  function handleReset() {
    setFile(null)
    setPageCount(null)
    setPosition(PAGE_NUMBER_DEFAULTS.position)
    setFormat(PAGE_NUMBER_DEFAULTS.format)
    setStartFrom(PAGE_NUMBER_DEFAULTS.startFrom)
    setFontSize(PAGE_NUMBER_DEFAULTS.fontSize)
    setFontColor(PAGE_NUMBER_DEFAULTS.fontColor)
    setSkipPagesInput('')
    setPageRangeStart('')
    setPageRangeEnd('')
    setPreviewImage(null)
    setErrors(createEmptyErrors())
    setStatusTone('ready')
    setStatusMessage(PAGE_NUMBER_STATUS_MESSAGES.idle)
  }

  const safeColorValue = validatePageNumberColor(fontColor) ? PAGE_NUMBER_DEFAULTS.fontColor : fontColor
  const pagePlaceholder = pageCount ? `1 - ${pageCount}` : 'Page number'
  let previewText = ''

  if (file && Number.isInteger(pageCount) && !validatePageNumberStartFrom(startFrom)) {
    try {
      const previewSkipPages = skipPagesInput.trim()
        ? new Set(
            parseIntegerList(skipPagesInput, {
              min: 1,
              max: pageCount,
            }),
          )
        : new Set()
      const previewRangeError = validatePageNumberRange(pageRangeStart, pageRangeEnd, pageCount)

      if (!previewRangeError) {
        const pageRange = resolvePageNumberRange(pageRangeStart, pageRangeEnd, pageCount)
        const targetPages = Array.from({ length: pageCount }, (_, index) => index + 1).filter(
          (pageNumber) =>
            pageNumber >= pageRange.start &&
            pageNumber <= pageRange.end &&
            !previewSkipPages.has(pageNumber),
        )

        if (targetPages.includes(1)) {
          const previewStart = Number.parseInt(startFrom, 10)
          const previewTotal = previewStart + targetPages.length - 1
          previewText =
            buildPageNumberText(format, previewStart, previewTotal) ||
            formatPageNumberPreviewText(format, startFrom)
        }
      }
    } catch {
      previewText = ''
    }
  }

  return (
    <section className={styles.uploadCard}>
      <div className={styles.uploadHeader}>
        <div>
          <span className={styles.invoiceSectionLabel}>Page Numbers</span>
          <h2 className={styles.pdfToolHeading}>Add automatic numbering</h2>
          <p className={styles.uploadHint}>
            Set position, format, styling, and page rules before processing.
          </p>
        </div>

        {file ? (
          <button
            className={styles.resetButton}
            onClick={handleReset}
            title="Clear file and reset all settings"
            type="button"
          >
            Reset
          </button>
        ) : null}
      </div>

      <PdfDropzone
        file={file}
        hint="Drop your PDF here or click to browse."
        meta={['PDF only', pageCount ? `${pageCount} pages` : null].filter(Boolean)}
        onFiles={handleFileChange}
        title="Drop your PDF here"
      />

      <div className={styles.pageNumberWorkspace}>
        <div className={styles.pageNumberControlsColumn}>
          <section className={styles.pageNumberControlsPanel}>
            <div className={styles.pdfControlGrid}>
              <label className={styles.pdfField}>
                <span>Position</span>
                <select onChange={(event) => setPosition(event.target.value)} value={position}>
                  {PAGE_NUMBER_POSITION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.pdfField}>
                <span>Format</span>
                <select onChange={(event) => setFormat(event.target.value)} value={format}>
                  {PAGE_NUMBER_FORMAT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.pdfField}>
                <span>Start from</span>
                <input
                  aria-invalid={errors.startFrom ? 'true' : undefined}
                  min="1"
                  onChange={(event) => {
                    setStartFrom(event.target.value)
                    clearError('startFrom')
                  }}
                  type="number"
                  value={startFrom}
                />
                {errors.startFrom ? (
                  <span className={styles.fieldError} role="alert">
                    {errors.startFrom}
                  </span>
                ) : null}
              </label>

              <label className={styles.pdfField}>
                <span>
                  Font size ({PAGE_NUMBER_DEFAULTS.fontSizeMin} - {PAGE_NUMBER_DEFAULTS.fontSizeMax})
                </span>
                <input
                  aria-invalid={errors.fontSize ? 'true' : undefined}
                  max={PAGE_NUMBER_DEFAULTS.fontSizeMax}
                  min={PAGE_NUMBER_DEFAULTS.fontSizeMin}
                  onChange={(event) => {
                    setFontSize(event.target.value)
                    clearError('fontSize')
                  }}
                  type="number"
                  value={fontSize}
                />
                {errors.fontSize ? (
                  <span className={styles.fieldError} role="alert">
                    {errors.fontSize}
                  </span>
                ) : null}
              </label>

              <label className={styles.pdfField}>
                <span>Font color</span>
                <div className={styles.pdfColorInputRow}>
                  <input
                    className={styles.pdfColorSwatch}
                    onChange={(event) => {
                      setFontColor(event.target.value)
                      clearError('fontColor')
                    }}
                    title="Pick a font color"
                    type="color"
                    value={safeColorValue}
                  />
                  <input
                    aria-invalid={errors.fontColor ? 'true' : undefined}
                    className={styles.pdfColorValueInput}
                    maxLength="7"
                    onChange={(event) => {
                      setFontColor(event.target.value)
                      clearError('fontColor')
                    }}
                    placeholder="#000000"
                    type="text"
                    value={fontColor}
                  />
                </div>
                {errors.fontColor ? (
                  <span className={styles.fieldError} role="alert">
                    {errors.fontColor}
                  </span>
                ) : null}
              </label>

              <label className={styles.pdfFieldWide}>
                <span>Page range (optional)</span>
                <div className={styles.pdfFieldInlineRow}>
                  <input
                    aria-invalid={errors.pageRange ? 'true' : undefined}
                    max={pageCount ?? undefined}
                    min="1"
                    onChange={(event) => {
                      setPageRangeStart(event.target.value)
                      clearError('pageRange')
                    }}
                    placeholder={`Start (${pagePlaceholder})`}
                    type="number"
                    value={pageRangeStart}
                  />
                  <span className={styles.pdfFieldInlineDivider}>to</span>
                  <input
                    aria-invalid={errors.pageRange ? 'true' : undefined}
                    max={pageCount ?? undefined}
                    min="1"
                    onChange={(event) => {
                      setPageRangeEnd(event.target.value)
                      clearError('pageRange')
                    }}
                    placeholder={`End (${pagePlaceholder})`}
                    type="number"
                    value={pageRangeEnd}
                  />
                </div>
                {errors.pageRange ? (
                  <span className={styles.fieldError} role="alert">
                    {errors.pageRange}
                  </span>
                ) : null}
              </label>

              <label className={styles.pdfFieldWide}>
                <span>Skip pages (optional)</span>
                <input
                  aria-invalid={errors.skipPages ? 'true' : undefined}
                  onChange={(event) => {
                    setSkipPagesInput(event.target.value)
                    clearError('skipPages')
                  }}
                  placeholder="e.g. 1, 2, 5"
                  type="text"
                  value={skipPagesInput}
                />
                {errors.skipPages ? (
                  <span className={styles.fieldError} role="alert">
                    {errors.skipPages}
                  </span>
                ) : null}
              </label>
            </div>
          </section>

          <div className={styles.uploadActions}>
            <button className={styles.uploadAction} disabled={isProcessing} onClick={handleProcess} type="button">
              <WorkspaceIcon name="spark" size={15} />
              <span>{isProcessing ? 'Applying...' : 'Apply Page Numbers'}</span>
            </button>
          </div>

          {statusMessage ? (
            <div
              className={joinClasses(
                styles.statusRow,
                statusTone === 'success' && styles.statusRowSuccess,
                statusTone === 'warning' && styles.statusRowWarning,
              )}
            >
              <div className={styles.statusTextWrap}>
                <span
                  className={joinClasses(
                    styles.statusIndicator,
                    statusTone === 'success' && styles.statusIndicatorSuccess,
                    statusTone === 'ready' && styles.statusIndicatorReady,
                  )}
                />
                <strong>{statusMessage}</strong>
              </div>
            </div>
          ) : null}
        </div>

        <aside className={styles.pageNumberPreviewSection}>
          <div className={styles.pageNumberPreviewTop}>
            <span className={styles.pageNumberPreviewLabel}>Live Preview</span>
          </div>

          <div className={styles.pageNumberPreviewFrame}>
            <LivePreview
              fontColor={fontColor}
              fontSize={fontSize}
              position={position}
              previewImage={previewImage}
              previewText={previewText}
            />
          </div>
        </aside>
      </div>
    </section>
  )
}
