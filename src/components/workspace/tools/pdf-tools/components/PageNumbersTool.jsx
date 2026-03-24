import { useState } from 'react'
import WorkspaceIcon from '../../../WorkspaceIcon'
import styles from '../../shared/Tools.module.css'
import { addPageNumbersToPdf, downloadBytes, getPdfPageCount, parseIntegerList } from '../pdfToolsOperations'
import { joinClasses } from './helpers'
import PdfDropzone from './PdfDropzone'

export default function PageNumbersTool({ onUsage }) {
  const [file, setFile] = useState(null)
  const [position, setPosition] = useState('bottom_center')
  const [format, setFormat] = useState('numeric')
  const [startFrom, setStartFrom] = useState('1')
  const [fontSize, setFontSize] = useState('12')
  const [skipPagesInput, setSkipPagesInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [statusTone, setStatusTone] = useState('ready')
  const [statusMessage, setStatusMessage] = useState('Upload a PDF and apply numbering.')

  async function handleProcess() {
    if (!file) {
      setStatusTone('warning')
      setStatusMessage('Select a PDF first.')
      return
    }

    const startedAt = Date.now()
    setIsProcessing(true)

    try {
      const pageCount = await getPdfPageCount(file)

      if (skipPagesInput.trim()) {
        parseIntegerList(skipPagesInput, {
          min: 1,
          max: pageCount,
        })
      }

      const result = await addPageNumbersToPdf(file, {
        position,
        format,
        startFrom,
        fontSize,
        skipPagesInput,
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

  return (
    <section className={styles.uploadCard}>
      <div className={styles.uploadHeader}>
        <div>
          <span className={styles.invoiceSectionLabel}>Page Numbers</span>
          <h2 className={styles.pdfToolHeading}>Add automatic numbering</h2>
          <p className={styles.uploadHint}>Set position, format, and start number before processing.</p>
        </div>
      </div>

      <PdfDropzone
        file={file}
        hint="Drop your PDF here or click to browse."
        meta={['PDF only']}
        onFiles={setFile}
        title="Drop your PDF here"
      />

      <div className={styles.pdfControlGrid}>
        <label className={styles.pdfField}>
          <span>Position</span>
          <select onChange={(event) => setPosition(event.target.value)} value={position}>
            <option value="bottom_center">Bottom Center</option>
            <option value="bottom_right">Bottom Right</option>
            <option value="top_center">Top Center</option>
          </select>
        </label>

        <label className={styles.pdfField}>
          <span>Format</span>
          <select onChange={(event) => setFormat(event.target.value)} value={format}>
            <option value="numeric">1, 2, 3...</option>
            <option value="page_n_of_total">Page 1 of N</option>
            <option value="dash_n_dash">- 1 -</option>
          </select>
        </label>

        <label className={styles.pdfField}>
          <span>Start from</span>
          <input min="1" onChange={(event) => setStartFrom(event.target.value)} type="number" value={startFrom} />
        </label>

        <label className={styles.pdfField}>
          <span>Font size</span>
          <input min="8" onChange={(event) => setFontSize(event.target.value)} type="number" value={fontSize} />
        </label>

        <label className={styles.pdfFieldWide}>
          <span>Skip pages (optional)</span>
          <input
            onChange={(event) => setSkipPagesInput(event.target.value)}
            placeholder="e.g. 1, 2"
            type="text"
            value={skipPagesInput}
          />
        </label>
      </div>

      <div className={styles.uploadActions}>
        <button className={styles.uploadAction} disabled={isProcessing} onClick={handleProcess} type="button">
          <WorkspaceIcon name="spark" size={15} />
          <span>{isProcessing ? 'Applying...' : 'Apply Page Numbers'}</span>
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
