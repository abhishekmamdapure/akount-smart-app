import { useMemo, useState } from 'react'
import WorkspaceIcon from '../../../WorkspaceIcon'
import styles from '../../shared/Tools.module.css'
import { convertPdfToExcel, convertPdfToWord, downloadBlob, formatFileSize } from '../pdfToolsOperations'
import { joinClasses } from './helpers'
import PdfDropzone from './PdfDropzone'

const OCR_LANGUAGES = Object.freeze([
  { label: 'English', value: 'eng' },
  { label: 'Hindi', value: 'hin' },
  { label: 'German', value: 'deu' },
  { label: 'French', value: 'fra' },
  { label: 'Spanish', value: 'spa' },
])

const CONVERT_MODE_CONTENT = Object.freeze({
  to_excel: {
    badge: '.xlsx output',
    buttonLabel: 'Convert to Excel',
    copy: 'Extract structured lines and tables from PDF into spreadsheet-ready .xlsx output.',
    dropHint: 'Drop your PDF here or click to browse.',
    icon: 'toolPdfExcel',
    label: 'Excel',
    statusReady: 'Upload a PDF to convert into .xlsx.',
    tool: 'to_excel',
  },
  to_word: {
    badge: '.docx output',
    buttonLabel: 'Convert to Word',
    copy: 'Generate editable .docx output with OCR fallback for scanned PDFs.',
    dropHint: 'Drop your PDF here or click to browse.',
    icon: 'toolPdfWord',
    label: 'Word',
    statusReady: 'Upload a PDF to convert into .docx.',
    tool: 'to_word',
  },
})

export default function ConvertPdfTool({ onUsage }) {
  const [mode, setMode] = useState('to_word')
  const [file, setFile] = useState(null)
  const [language, setLanguage] = useState('eng')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progressText, setProgressText] = useState('')
  const [statusTone, setStatusTone] = useState('ready')
  const [statusMessage, setStatusMessage] = useState(CONVERT_MODE_CONTENT.to_word.statusReady)

  const activeMode = CONVERT_MODE_CONTENT[mode]
  const selectedLanguageLabel = useMemo(
    () => OCR_LANGUAGES.find((item) => item.value === language)?.label || 'English',
    [language],
  )

  function handleModeChange(nextMode) {
    setMode(nextMode)
    setProgressText('')
    setStatusTone('ready')
    setStatusMessage(CONVERT_MODE_CONTENT[nextMode].statusReady)
  }

  async function handleProcess() {
    if (!file) {
      setStatusTone('warning')
      setStatusMessage('Select a PDF first.')
      return
    }

    const startedAt = Date.now()
    setIsProcessing(true)
    setStatusTone('ready')
    setProgressText('Preparing conversion...')

    try {
      const result =
        mode === 'to_word'
          ? await convertPdfToWord(file, {
            ocrLanguage: language,
            onProgress: ({ page, total }) => {
              setProgressText(`OCR in progress: page ${page} of ${total}`)
            },
          })
          : await convertPdfToExcel(file, {
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
        durationMs: Date.now() - startedAt,
        status: 'completed',
        summary: result.summary,
        tool: activeMode.tool,
      })
    } catch (error) {
      const message = error?.message || `Unable to ${activeMode.buttonLabel.toLowerCase()}.`
      setStatusTone('warning')
      setStatusMessage(message)
      setProgressText('')
      await onUsage({
        durationMs: Date.now() - startedAt,
        status: 'failed',
        summary: message,
        tool: activeMode.tool,
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <section className={styles.uploadCard}>
      <div className={styles.uploadHeader}>
        <div>
          <span className={styles.invoiceSectionLabel}>Convert PDF</span>
          <h2 className={styles.pdfToolHeading}>Create Word or Excel output from one PDF</h2>
          <p className={styles.uploadHint}>Switch between Word and Excel below without leaving the tool.</p>
        </div>
      </div>

      <div className={styles.invoiceModeSwitch}>
        {Object.entries(CONVERT_MODE_CONTENT).map(([key, content]) => (
          <button
            className={joinClasses(styles.invoiceModeOption, mode === key && styles.invoiceModeOptionActive)}
            key={key}
            onClick={() => handleModeChange(key)}
            type="button"
          >
            <span className={styles.pdfModeOptionContent}>
              <WorkspaceIcon className={styles.pdfModeOptionIcon} name={content.icon} size={18} />
              <span>{content.label}</span>
            </span>
          </button>
        ))}
      </div>

      <div className={styles.splitMergeWorkspace}>
        <div className={styles.splitMergeUploadColumn}>
          <PdfDropzone
            file={file}
            hint={activeMode.dropHint}
            meta={['PDF only', activeMode.badge]}
            onFiles={setFile}
            title="Drop your PDF here"
          />

          {progressText ? (
            <p className={joinClasses(styles.uploadHint, styles.splitMergeLoadingHint)}>{progressText}</p>
          ) : null}

          <div className={styles.splitMergeSummaryStack}>
            <div className={styles.splitMergeSummaryCard}>
              <strong>Selected file</strong>
              <span>{file ? `${file.name} / ${formatFileSize(file.size)}` : 'No PDF selected yet.'}</span>
            </div>
            <div className={styles.splitMergeSummaryCard}>
              <strong>Current output</strong>
              <span>{activeMode.copy}</span>
            </div>
          </div>
        </div>

        <aside className={styles.splitMergeSidebar}>
          <section className={styles.splitMergeSidePanel}>
            <div className={styles.splitMergePanelHeader}>
              <span className={styles.invoiceSectionLabel}>Convert options</span>
            </div>

            <div className={joinClasses(styles.pdfControlGrid, styles.splitMergeControlGrid)}>
              <label className={styles.pdfField}>
                <span>OCR language</span>
                <select onChange={(event) => setLanguage(event.target.value)} value={language}>
                  {OCR_LANGUAGES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className={styles.pdfField}>
                <span>Conversion profile</span>
                <div className={styles.pdfInfoCard}>
                  {mode === 'to_word'
                    ? `${selectedLanguageLabel} OCR with editable .docx output`
                    : `${selectedLanguageLabel} OCR with table and line extraction`}
                </div>
              </div>
            </div>
          </section>

          <section className={styles.splitMergeActionPanel}>
            <div
              className={joinClasses(
                styles.statusRow,
                styles.splitMergeStatusRow,
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

            <div className={styles.splitMergeActionStack}>
              <button className={styles.uploadAction} disabled={isProcessing} onClick={handleProcess} type="button">
                <WorkspaceIcon name="spark" size={15} />
                <span>{isProcessing ? 'Converting...' : activeMode.buttonLabel}</span>
              </button>
            </div>
          </section>
        </aside>
      </div>
    </section>
  )
}
