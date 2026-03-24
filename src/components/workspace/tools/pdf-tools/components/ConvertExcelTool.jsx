import { useState } from 'react'
import WorkspaceIcon from '../../../WorkspaceIcon'
import styles from '../../shared/Tools.module.css'
import { convertPdfToExcel, downloadBlob } from '../pdfToolsOperations'
import { joinClasses } from './helpers'
import PdfDropzone from './PdfDropzone'

export default function ConvertExcelTool({ onUsage }) {
  const [file, setFile] = useState(null)
  const [language, setLanguage] = useState('eng')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progressText, setProgressText] = useState('')
  const [statusTone, setStatusTone] = useState('ready')
  const [statusMessage, setStatusMessage] = useState('Upload a PDF to convert into .xlsx.')

  async function handleProcess() {
    if (!file) {
      setStatusTone('warning')
      setStatusMessage('Select a PDF first.')
      return
    }

    const startedAt = Date.now()
    setIsProcessing(true)
    setProgressText('Preparing conversion...')

    try {
      const result = await convertPdfToExcel(file, {
        ocrLanguage: language,
        onProgress: ({ page, total }) => {
          setProgressText(`OCR in progress: page ${page} of ${total}`)
        },
      })

      downloadBlob(result.blob, result.fileName)
      setStatusTone('success')
      setStatusMessage(`Done. ${result.summary}.`)
      setProgressText('')
      await onUsage({
        tool: 'to_excel',
        status: 'completed',
        summary: result.summary,
        durationMs: Date.now() - startedAt,
      })
    } catch (error) {
      const message = error?.message || 'Unable to convert PDF to Excel.'
      setStatusTone('warning')
      setStatusMessage(message)
      setProgressText('')
      await onUsage({
        tool: 'to_excel',
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
          <span className={styles.invoiceSectionLabel}>Convert to Excel</span>
          <h2 className={styles.pdfToolHeading}>Generate structured .xlsx output</h2>
          <p className={styles.uploadHint}>Tabular rows are extracted first, with OCR fallback for scanned pages.</p>
        </div>
      </div>

      <PdfDropzone
        file={file}
        hint="Drop your PDF here or click to browse."
        meta={['PDF only', '.xlsx output']}
        onFiles={setFile}
        title="Drop your PDF here"
      />

      <div className={styles.pdfControlGrid}>
        <label className={styles.pdfField}>
          <span>OCR language</span>
          <select onChange={(event) => setLanguage(event.target.value)} value={language}>
            <option value="eng">English</option>
            <option value="hin">Hindi</option>
            <option value="deu">German</option>
            <option value="fra">French</option>
            <option value="spa">Spanish</option>
          </select>
        </label>
      </div>

      {progressText ? <p className={styles.uploadHint}>{progressText}</p> : null}

      <div className={styles.uploadActions}>
        <button className={styles.uploadAction} disabled={isProcessing} onClick={handleProcess} type="button">
          <WorkspaceIcon name="spark" size={15} />
          <span>{isProcessing ? 'Converting...' : 'Convert to Excel'}</span>
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
