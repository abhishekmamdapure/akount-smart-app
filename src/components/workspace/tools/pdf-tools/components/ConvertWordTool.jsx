import { useState } from 'react'
import WorkspaceIcon from '../../../WorkspaceIcon'
import styles from '../../shared/Tools.module.css'
import { convertPdfToWord, downloadBlob } from '../pdfToolsOperations'
import { joinClasses } from './helpers'
import PdfDropzone from './PdfDropzone'

export default function ConvertWordTool({ onUsage }) {
  const [file, setFile] = useState(null)
  const [language, setLanguage] = useState('eng')
  const [mode, setMode] = useState('editable')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progressText, setProgressText] = useState('')
  const [statusTone, setStatusTone] = useState('ready')
  const [statusMessage, setStatusMessage] = useState('Upload a PDF to convert into .docx.')

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
      const result = await convertPdfToWord(file, {
        ocrLanguage: language,
        mode,
        onProgress: ({ page, total }) => {
          setProgressText(`OCR in progress: page ${page} of ${total}`)
        },
      })

      downloadBlob(result.blob, result.fileName)
      setStatusTone('success')
      setStatusMessage(`Done. ${result.summary}.`)
      setProgressText('')
      await onUsage({
        tool: 'to_word',
        status: 'completed',
        summary: result.summary,
        durationMs: Date.now() - startedAt,
      })
    } catch (error) {
      const message = error?.message || 'Unable to convert PDF to Word.'
      setStatusTone('warning')
      setStatusMessage(message)
      setProgressText('')
      await onUsage({
        tool: 'to_word',
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
          <span className={styles.invoiceSectionLabel}>Convert to Word</span>
          <h2 className={styles.pdfToolHeading}>Generate editable .docx output</h2>
          <p className={styles.uploadHint}>Text extraction runs first. OCR automatically handles scanned pages.</p>
        </div>
      </div>

      <PdfDropzone
        file={file}
        hint="Drop your PDF here or click to browse."
        meta={['PDF only', '.docx output']}
        onFiles={setFile}
        title="Drop your PDF here"
      />

      <div className={styles.pdfControlGrid}>
        <label className={styles.pdfField}>
          <span>Mode</span>
          <select onChange={(event) => setMode(event.target.value)} value={mode}>
            <option value="editable">Editable text</option>
            <option value="layout">Preserve layout (best effort)</option>
          </select>
        </label>

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
          <span>{isProcessing ? 'Converting...' : 'Convert to Word'}</span>
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
