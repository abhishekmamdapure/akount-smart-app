import { useEffect, useState } from 'react'
import WorkspaceIcon from '../../../WorkspaceIcon'
import styles from '../../shared/Tools.module.css'
import { compressPdfFile, downloadBytes, formatFileSize, getPdfPageCount } from '../pdfToolsOperations'
import { getPdfCompressionPreset, PDF_COMPRESSION_PRESETS } from '../pdfCompressionHelpers'
import { joinClasses } from './helpers'
import PdfDropzone from './PdfDropzone'

export default function CompressPdfTool({ onUsage }) {
  const [file, setFile] = useState(null)
  const [pageCount, setPageCount] = useState(null)
  const [preset, setPreset] = useState('balanced')
  const [grayscale, setGrayscale] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progressText, setProgressText] = useState('')
  const [statusTone, setStatusTone] = useState('ready')
  const [statusMessage, setStatusMessage] = useState('Upload a PDF to create a smaller compressed copy.')
  const [lastResult, setLastResult] = useState(null)

  useEffect(() => {
    let isActive = true

    if (!file) {
      setPageCount(null)
      return undefined
    }

    getPdfPageCount(file)
      .then((count) => {
        if (isActive) {
          setPageCount(count)
        }
      })
      .catch(() => {
        if (isActive) {
          setPageCount(null)
        }
      })

    return () => {
      isActive = false
    }
  }, [file])

  const activePreset = getPdfCompressionPreset(preset)

  async function handleProcess() {
    if (!file) {
      setStatusTone('warning')
      setStatusMessage('Select a PDF first.')
      return
    }

    const startedAt = Date.now()
    setIsProcessing(true)
    setStatusTone('ready')
    setProgressText('Preparing compression...')
    setLastResult(null)

    try {
      const result = await compressPdfFile(file, {
        grayscale,
        onProgress: ({ page, total }) => {
          setProgressText(`Compressing page ${page} of ${total}`)
        },
        preset,
      })

      downloadBytes(result.bytes, result.fileName)
      setStatusTone('success')
      setStatusMessage(`Done. ${result.summary}.`)
      setProgressText('')
      setLastResult(result)
      await onUsage({
        durationMs: Date.now() - startedAt,
        status: 'completed',
        summary: result.summary,
        tool: 'compress_pdf',
      })
    } catch (error) {
      const message = error?.message || 'Unable to compress PDF.'
      setStatusTone('warning')
      setStatusMessage(message)
      setProgressText('')
      await onUsage({
        durationMs: Date.now() - startedAt,
        status: 'failed',
        summary: message,
        tool: 'compress_pdf',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <section className={styles.uploadCard}>
      <div className={styles.uploadHeader}>
        <div>
          <span className={styles.invoiceSectionLabel}>Compress PDF</span>
          <h2 className={styles.pdfToolHeading}>Create a smaller flattened PDF copy</h2>
          <p className={styles.uploadHint}>Compression rasterizes each page and rebuilds the PDF for a lighter download.</p>
        </div>
      </div>

      <div className={styles.splitMergeWorkspace}>
        <div className={styles.splitMergeUploadColumn}>
          <PdfDropzone
            file={file}
            hint="Drop your PDF here or click to browse."
            meta={['PDF only', 'Compressed output']}
            onFiles={setFile}
            title="Drop your PDF here"
          />

          {progressText ? (
            <p className={joinClasses(styles.uploadHint, styles.splitMergeLoadingHint)}>{progressText}</p>
          ) : null}

          <div className={styles.splitMergeSummaryStack}>
            <div className={styles.splitMergeSummaryCard}>
              <strong>Input file</strong>
              <span>
                {file
                  ? `${file.name} / ${formatFileSize(file.size)}${pageCount ? ` / ${pageCount} pages` : ''}`
                  : 'No PDF selected yet.'}
              </span>
            </div>
            <div className={styles.splitMergeSummaryCard}>
              <strong>Compression profile</strong>
              <span>{activePreset.description}</span>
            </div>
            {lastResult ? (
              <div className={styles.splitMergeSummaryCard}>
                <strong>Last result</strong>
                <span>
                  {lastResult.wasReduced
                    ? `${formatFileSize(lastResult.originalSize)} to ${formatFileSize(lastResult.outputSize)}`
                    : `No reduction below ${formatFileSize(lastResult.originalSize)}`}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        <aside className={styles.splitMergeSidebar}>
          <section className={styles.splitMergeSidePanel}>
            <div className={styles.splitMergePanelHeader}>
              <span className={styles.invoiceSectionLabel}>Compression options</span>
            </div>

            <div className={joinClasses(styles.pdfControlGrid, styles.splitMergeControlGrid)}>
              <label className={styles.pdfField}>
                <span>Compression preset</span>
                <select onChange={(event) => setPreset(event.target.value)} value={preset}>
                  {Object.values(PDF_COMPRESSION_PRESETS).map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.pdfField}>
                <span>Color mode</span>
                <select onChange={(event) => setGrayscale(event.target.value === 'grayscale')} value={grayscale ? 'grayscale' : 'color'}>
                  <option value="color">Keep color</option>
                  <option value="grayscale">Convert to grayscale</option>
                </select>
              </label>

              <div className={styles.pdfField}>
                <span>How this works</span>
                <div className={styles.pdfInfoCard}>
                  Each page is redrawn as an image so dense PDFs can shrink before download.
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
                <span>{isProcessing ? 'Compressing...' : 'Compress PDF'}</span>
              </button>
            </div>
          </section>
        </aside>
      </div>
    </section>
  )
}
