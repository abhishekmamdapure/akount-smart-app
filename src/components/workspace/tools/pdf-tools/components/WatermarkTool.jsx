import { useState } from 'react'
import WorkspaceIcon from '../../../WorkspaceIcon'
import styles from '../../shared/Tools.module.css'
import { addImageWatermarkToPdf, addTextWatermarkToPdf, downloadBytes } from '../pdfToolsOperations'
import { joinClasses } from './helpers'
import PdfDropzone from './PdfDropzone'

export default function WatermarkTool({ onUsage }) {
  const [file, setFile] = useState(null)
  const [mode, setMode] = useState('text')
  const [text, setText] = useState('CONFIDENTIAL')
  const [opacity, setOpacity] = useState('0.25')
  const [angle, setAngle] = useState('-35')
  const [fontSize, setFontSize] = useState('42')
  const [color, setColor] = useState('#8a94a6')
  const [position, setPosition] = useState('center')
  const [imageFile, setImageFile] = useState(null)
  const [imageScale, setImageScale] = useState('0.35')
  const [imageOpacity, setImageOpacity] = useState('0.35')
  const [grayscale, setGrayscale] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [statusTone, setStatusTone] = useState('ready')
  const [statusMessage, setStatusMessage] = useState('Upload a PDF and configure watermark settings.')

  async function handleProcess() {
    if (!file) {
      setStatusTone('warning')
      setStatusMessage('Select a PDF first.')
      return
    }

    const startedAt = Date.now()
    setIsProcessing(true)

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

  return (
    <section className={styles.uploadCard}>
      <div className={styles.uploadHeader}>
        <div>
          <span className={styles.invoiceSectionLabel}>Watermark</span>
          <h2 className={styles.pdfToolHeading}>Apply text or image watermark</h2>
          <p className={styles.uploadHint}>Configure watermark style and apply it across all pages.</p>
        </div>
      </div>

      <PdfDropzone
        file={file}
        hint="Drop your PDF here or click to browse."
        meta={['PDF only']}
        onFiles={setFile}
        title="Drop your PDF here"
      />

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
            <input max="1" min="0.05" onChange={(event) => setOpacity(event.target.value)} step="0.05" type="number" value={opacity} />
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
            <input onChange={(event) => setColor(event.target.value)} type="color" value={color} />
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
            <input accept="image/*" onChange={(event) => setImageFile(event.target.files?.[0] || null)} type="file" />
          </label>

          <label className={styles.pdfField}>
            <span>Opacity</span>
            <input max="1" min="0.05" onChange={(event) => setImageOpacity(event.target.value)} step="0.05" type="number" value={imageOpacity} />
          </label>

          <label className={styles.pdfField}>
            <span>Scale</span>
            <input max="1.2" min="0.1" onChange={(event) => setImageScale(event.target.value)} step="0.05" type="number" value={imageScale} />
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

      <div className={styles.uploadActions}>
        <button className={styles.uploadAction} disabled={isProcessing} onClick={handleProcess} type="button">
          <WorkspaceIcon name="spark" size={15} />
          <span>{isProcessing ? 'Applying...' : 'Apply Watermark'}</span>
        </button>
      </div>

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
    </section>
  )
}
