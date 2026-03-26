import { useCallback, useEffect, useState } from 'react'
import WorkspaceIcon from '../../../WorkspaceIcon'
import styles from '../../shared/Tools.module.css'
import {
  addImageWatermarkToPdf,
  addTextWatermarkToPdf,
  downloadBytes,
  getPdfPageCount,
  renderPdfThumbnails,
} from '../pdfToolsOperations'
import { joinClasses } from './helpers'
import PdfDropzone from './PdfDropzone'

const WATERMARK_DEFAULTS = Object.freeze({
  mode: 'text',
  text: 'CONFIDENTIAL',
  opacity: '0.25',
  angle: '-30',
  fontSize: '35',
  color: '#8a94a6',
  position: 'center',
  imageScale: '0.35',
  imageOpacity: '0.35',
  grayscale: true,
})

const WATERMARK_STATUS_MESSAGES = Object.freeze({
  idle: '',
  missingFile: 'Select a PDF first.',
  processing: 'Applying watermark...',
})

const WATERMARK_COLOR_RE = /^#[0-9a-fA-F]{6}$/

function parseNumberValue(value, fallback) {
  const numeric = Number.parseFloat(value)

  if (!Number.isFinite(numeric)) {
    return fallback
  }

  return numeric
}

function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function getPreviewPlacement(position) {
  if (position === 'top_left') {
    return { top: '11%', left: '10%' }
  }

  if (position === 'top_right') {
    return { top: '11%', right: '10%' }
  }

  if (position === 'bottom_left') {
    return { bottom: '11%', left: '10%' }
  }

  if (position === 'bottom_right') {
    return { bottom: '11%', right: '10%' }
  }

  return {
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  }
}

function buildTextPreviewStyle({ position, color, fontSize, opacity, angle }) {
  const previewColor = WATERMARK_COLOR_RE.test(String(color || '').trim())
    ? String(color).trim()
    : WATERMARK_DEFAULTS.color
  const previewFontSize = clampValue(parseNumberValue(fontSize, 42) * 0.52, 14, 40)
  const previewOpacity = clampValue(parseNumberValue(opacity, 0.25), 0.05, 1)
  const previewAngle = parseNumberValue(angle, -35)
  const placement = getPreviewPlacement(position)
  const rotation = `rotate(${previewAngle}deg)`

  return {
    ...placement,
    color: previewColor,
    fontSize: `${previewFontSize}px`,
    opacity: previewOpacity,
    transform: placement.transform ? `${placement.transform} ${rotation}` : rotation,
  }
}

function buildImagePreviewStyle({ position, opacity, scale, grayscale }) {
  const previewOpacity = clampValue(parseNumberValue(opacity, 0.35), 0.05, 1)
  const previewScale = clampValue(parseNumberValue(scale, 0.35), 0.1, 1.2)
  const placement = getPreviewPlacement(position)

  return {
    ...placement,
    width: `${clampValue(previewScale * 100, 14, 78)}%`,
    opacity: previewOpacity,
    filter: grayscale ? 'grayscale(1)' : 'none',
    transform: placement.transform || 'none',
  }
}

function LivePreview({
  mode,
  pdfPreview,
  text,
  position,
  opacity,
  angle,
  fontSize,
  color,
  imagePreviewUrl,
  imageScale,
  imageOpacity,
  grayscale,
}) {
  const previewText = String(text || '').trim()

  return (
    <div className={styles.pageNumberPreviewCard}>
      {pdfPreview?.dataUrl ? (
        <img
          alt="First page preview"
          className={styles.pageNumberPreviewImage}
          src={pdfPreview.dataUrl}
        />
      ) : null}

      {mode === 'text' && previewText ? (
        <span
          className={styles.watermarkPreviewText}
          style={buildTextPreviewStyle({ position, color, fontSize, opacity, angle })}
        >
          {previewText}
        </span>
      ) : null}

      {mode === 'image' && imagePreviewUrl ? (
        <img
          alt="Watermark overlay preview"
          className={styles.watermarkPreviewImage}
          src={imagePreviewUrl}
          style={buildImagePreviewStyle({ position, opacity: imageOpacity, scale: imageScale, grayscale })}
        />
      ) : null}
    </div>
  )
}

export default function WatermarkTool({ onUsage }) {
  const [file, setFile] = useState(null)
  const [pageCount, setPageCount] = useState(null)
  const [pdfPreview, setPdfPreview] = useState(null)
  const [mode, setMode] = useState(WATERMARK_DEFAULTS.mode)
  const [text, setText] = useState(WATERMARK_DEFAULTS.text)
  const [opacity, setOpacity] = useState(WATERMARK_DEFAULTS.opacity)
  const [angle, setAngle] = useState(WATERMARK_DEFAULTS.angle)
  const [fontSize, setFontSize] = useState(WATERMARK_DEFAULTS.fontSize)
  const [color, setColor] = useState(WATERMARK_DEFAULTS.color)
  const [position, setPosition] = useState(WATERMARK_DEFAULTS.position)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const [imageScale, setImageScale] = useState(WATERMARK_DEFAULTS.imageScale)
  const [imageOpacity, setImageOpacity] = useState(WATERMARK_DEFAULTS.imageOpacity)
  const [grayscale, setGrayscale] = useState(WATERMARK_DEFAULTS.grayscale)
  const [isProcessing, setIsProcessing] = useState(false)
  const [statusTone, setStatusTone] = useState('ready')
  const [statusMessage, setStatusMessage] = useState(WATERMARK_STATUS_MESSAGES.idle)

  useEffect(() => {
    let isActive = true

    if (!file) {
      setPageCount(null)
      setPdfPreview(null)
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
        setPdfPreview(previewResult.value.thumbnails[0] || null)
      } else {
        setPdfPreview(null)
      }
    })

    return () => {
      isActive = false
    }
  }, [file])

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl('')
      return undefined
    }

    const objectUrl = URL.createObjectURL(imageFile)
    setImagePreviewUrl(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [imageFile])

  const handleFileChange = useCallback((fileValue) => {
    setFile(fileValue)
    setPageCount(null)
    setPdfPreview(null)
    setStatusTone('ready')
    setStatusMessage(WATERMARK_STATUS_MESSAGES.idle)
  }, [])

  const handleReset = useCallback(() => {
    setFile(null)
    setPageCount(null)
    setPdfPreview(null)
    setMode(WATERMARK_DEFAULTS.mode)
    setText(WATERMARK_DEFAULTS.text)
    setOpacity(WATERMARK_DEFAULTS.opacity)
    setAngle(WATERMARK_DEFAULTS.angle)
    setFontSize(WATERMARK_DEFAULTS.fontSize)
    setColor(WATERMARK_DEFAULTS.color)
    setPosition(WATERMARK_DEFAULTS.position)
    setImageFile(null)
    setImagePreviewUrl('')
    setImageScale(WATERMARK_DEFAULTS.imageScale)
    setImageOpacity(WATERMARK_DEFAULTS.imageOpacity)
    setGrayscale(WATERMARK_DEFAULTS.grayscale)
    setStatusTone('ready')
    setStatusMessage(WATERMARK_STATUS_MESSAGES.idle)
  }, [])

  async function handleProcess() {
    if (!file) {
      setStatusTone('warning')
      setStatusMessage(WATERMARK_STATUS_MESSAGES.missingFile)
      return
    }

    const startedAt = Date.now()
    setIsProcessing(true)
    setStatusTone('ready')
    setStatusMessage(WATERMARK_STATUS_MESSAGES.processing)

    try {
      let result

      if (mode === 'text') {
        result = await addTextWatermarkToPdf(file, {
          text,
          opacity,
          angle,
          fontSize,
          color,
          position,
        })
      } else {
        result = await addImageWatermarkToPdf(file, {
          imageFile,
          opacity: imageOpacity,
          scale: imageScale,
          grayscale,
          position,
        })
      }

      downloadBytes(result.bytes, result.fileName)
      setStatusTone('success')
      setStatusMessage(`Done. ${result.summary}.`)
      await onUsage({
        tool: 'watermark',
        status: 'completed',
        summary: result.summary,
        durationMs: Date.now() - startedAt,
      })
    } catch (error) {
      const message = error?.message || 'Unable to apply watermark.'
      setStatusTone('warning')
      setStatusMessage(message)
      await onUsage({
        tool: 'watermark',
        status: 'failed',
        summary: message,
        durationMs: Date.now() - startedAt,
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const safeColorValue = WATERMARK_COLOR_RE.test(String(color || '').trim()) ? color : WATERMARK_DEFAULTS.color

  return (
    <section className={styles.uploadCard}>
      <div className={styles.uploadHeader}>
        <div>
          <span className={styles.invoiceSectionLabel}>Watermark</span>
          <h2 className={styles.pdfToolHeading}>Apply text or image watermark</h2>
          <p className={styles.uploadHint}>Configure watermark style and preview it before processing.</p>
        </div>

        {file || imageFile ? (
          <button className={styles.resetButton} onClick={handleReset} title="Clear file and reset settings" type="button">
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
            <div className={styles.invoiceModeSwitch}>
              <button
                className={joinClasses(styles.invoiceModeOption, mode === 'text' && styles.invoiceModeOptionActive)}
                onClick={() => setMode('text')}
                type="button"
              >
                Text watermark
              </button>
              <button
                className={joinClasses(styles.invoiceModeOption, mode === 'image' && styles.invoiceModeOptionActive)}
                onClick={() => setMode('image')}
                type="button"
              >
                Image watermark
              </button>
            </div>

            {mode === 'text' ? (
              <div className={styles.pdfControlGrid}>
                <label className={styles.pdfFieldWide}>
                  <span>Text</span>
                  <input onChange={(event) => setText(event.target.value)} type="text" value={text} />
                </label>

                <label className={styles.pdfField}>
                  <span>Opacity</span>
                  <input
                    max="1"
                    min="0.05"
                    onChange={(event) => setOpacity(event.target.value)}
                    step="0.05"
                    type="number"
                    value={opacity}
                  />
                </label>

                <label className={styles.pdfField}>
                  <span>Rotation (deg)</span>
                  <input onChange={(event) => setAngle(event.target.value)} step="5" type="number" value={angle} />
                </label>

                <label className={styles.pdfField}>
                  <span>Font size</span>
                  <input min="10" onChange={(event) => setFontSize(event.target.value)} type="number" value={fontSize} />
                </label>

                <label className={styles.pdfField}>
                  <span>Color</span>
                  <div className={styles.pdfColorInputRow}>
                    <input
                      className={styles.pdfColorSwatch}
                      onChange={(event) => setColor(event.target.value)}
                      title="Pick a watermark color"
                      type="color"
                      value={safeColorValue}
                    />
                    <input
                      className={styles.pdfColorValueInput}
                      maxLength="7"
                      onChange={(event) => setColor(event.target.value)}
                      placeholder="#8a94a6"
                      type="text"
                      value={color}
                    />
                  </div>
                </label>

                <label className={styles.pdfField}>
                  <span>Position</span>
                  <select onChange={(event) => setPosition(event.target.value)} value={position}>
                    <option value="center">Center</option>
                    <option value="top_left">Top Left</option>
                    <option value="top_right">Top Right</option>
                    <option value="bottom_left">Bottom Left</option>
                    <option value="bottom_right">Bottom Right</option>
                  </select>
                </label>
              </div>
            ) : (
              <div className={styles.pdfControlGrid}>
                <label className={styles.pdfFieldWide}>
                  <span>Watermark image</span>
                  <input
                    accept="image/*"
                    onChange={(event) => setImageFile(event.target.files?.[0] || null)}
                    type="file"
                  />
                </label>

                <label className={styles.pdfField}>
                  <span>Opacity</span>
                  <input
                    max="1"
                    min="0.05"
                    onChange={(event) => setImageOpacity(event.target.value)}
                    step="0.05"
                    type="number"
                    value={imageOpacity}
                  />
                </label>

                <label className={styles.pdfField}>
                  <span>Scale</span>
                  <input
                    max="1.2"
                    min="0.1"
                    onChange={(event) => setImageScale(event.target.value)}
                    step="0.05"
                    type="number"
                    value={imageScale}
                  />
                </label>

                <label className={styles.pdfField}>
                  <span>Position</span>
                  <select onChange={(event) => setPosition(event.target.value)} value={position}>
                    <option value="center">Center</option>
                    <option value="top_left">Top Left</option>
                    <option value="top_right">Top Right</option>
                    <option value="bottom_left">Bottom Left</option>
                    <option value="bottom_right">Bottom Right</option>
                  </select>
                </label>

                <label className={styles.pdfToggleField}>
                  <input checked={grayscale} onChange={(event) => setGrayscale(event.target.checked)} type="checkbox" />
                  <span>Convert watermark image to grayscale</span>
                </label>
              </div>
            )}
          </section>

          <div className={styles.uploadActions}>
            <button className={styles.uploadAction} disabled={isProcessing} onClick={handleProcess} type="button">
              <WorkspaceIcon name="spark" size={15} />
              <span>{isProcessing ? 'Applying...' : 'Apply Watermark'}</span>
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
              angle={angle}
              color={safeColorValue}
              fontSize={fontSize}
              grayscale={grayscale}
              imageOpacity={imageOpacity}
              imagePreviewUrl={imagePreviewUrl}
              imageScale={imageScale}
              mode={mode}
              opacity={opacity}
              pdfPreview={pdfPreview}
              position={position}
              text={text}
            />
          </div>
        </aside>
      </div>
    </section>
  )
}
