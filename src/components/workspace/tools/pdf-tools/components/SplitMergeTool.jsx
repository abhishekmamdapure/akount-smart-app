import { useState } from 'react'
import WorkspaceIcon from '../../../WorkspaceIcon'
import styles from '../../shared/Tools.module.css'
import {
  downloadBytes,
  formatFileSize,
  mergePdfFiles,
  renderPdfThumbnails,
  splitPdfFile,
} from '../pdfToolsOperations'
import { joinClasses } from './helpers'
import PdfDropzone from './PdfDropzone'

export default function SplitMergeTool({ onUsage }) {
  const [mode, setMode] = useState('split')
  const [splitFile, setSplitFile] = useState(null)
  const [splitPreview, setSplitPreview] = useState(null)
  const [splitCuts, setSplitCuts] = useState([])
  const [mergeItems, setMergeItems] = useState([])
  const [splitMode, setSplitMode] = useState('after_pages')
  const [everyN, setEveryN] = useState('2')
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [statusTone, setStatusTone] = useState('ready')
  const [statusMessage, setStatusMessage] = useState('Upload a PDF to split or multiple PDFs to merge.')

  async function handleSplitFile(file) {
    setSplitFile(file)
    setSplitCuts([])
    setIsPreviewLoading(true)
    setStatusTone('ready')
    setStatusMessage('Rendering PDF preview...')

    try {
      const preview = await renderPdfThumbnails(file, {
        scale: 0.18,
        maxPages: 80,
      })

      setSplitPreview(preview)
      setStatusMessage('Preview ready. Click the dividers between pages to set split points.')
    } catch (error) {
      setSplitPreview(null)
      setStatusTone('warning')
      setStatusMessage(error?.message || 'Unable to render PDF preview.')
    } finally {
      setIsPreviewLoading(false)
    }
  }

  function toggleSplitCut(index) {
    setSplitCuts((current) => {
      const next = current.includes(index)
        ? current.filter((value) => value !== index)
        : [...current, index].sort((a, b) => a - b)

      return next
    })
  }

  async function appendMergeFiles(files) {
    setIsPreviewLoading(true)
    setStatusTone('ready')
    setStatusMessage('Rendering PDF previews...')

    try {
      const nextItems = []

      for (const file of files) {
        const preview = await renderPdfThumbnails(file, {
          scale: 0.18,
          maxPages: 36,
        })

        nextItems.push({
          id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          thumbnails: preview.thumbnails,
          pageCount: preview.pageCount,
        })
      }

      setMergeItems((current) => [...current, ...nextItems])
      setStatusMessage('Preview ready. Files will merge in the same order shown below.')
    } catch (error) {
      setStatusTone('warning')
      setStatusMessage(error?.message || 'Unable to render PDF previews.')
    } finally {
      setIsPreviewLoading(false)
    }
  }

  function handleAddMoreFiles() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,application/pdf'
    input.multiple = true
    input.onchange = () => {
      const files = Array.from(input.files || [])

      if (files.length > 0) {
        appendMergeFiles(files)
      }
    }
    input.click()
  }

  const totalMergePages = mergeItems.reduce((sum, item) => sum + item.pageCount, 0)
  const selectedSplitPointsText =
    splitCuts.length > 0 ? splitCuts.map((cutIndex) => cutIndex + 1).join(', ') : 'No split points selected yet'

  async function handleProcess() {
    const startedAt = Date.now()
    setIsProcessing(true)
    setStatusTone('ready')

    try {
      if (mode === 'split') {
        if (!splitFile) {
          throw new Error('Select a PDF to split.')
        }

        if (splitMode === 'after_pages' && splitCuts.length === 0) {
          throw new Error('Select at least one split point from the preview.')
        }

        const result = await splitPdfFile(splitFile, {
          mode: splitMode,
          splitAfterPagesInput: splitCuts.map((cutIndex) => String(cutIndex + 1)).join(','),
          everyN,
        })

        result.downloads.forEach((download) => {
          downloadBytes(download.bytes, download.fileName)
        })

        setStatusTone('success')
        setStatusMessage(`Done. ${result.summary}.`)
        await onUsage({
          tool: 'split_merge',
          status: 'completed',
          summary: result.summary,
          durationMs: Date.now() - startedAt,
        })
        return
      }

      if (mergeItems.length < 2) {
        throw new Error('Select at least two PDFs to merge.')
      }

      const result = await mergePdfFiles(mergeItems.map((item) => item.file))
      downloadBytes(result.bytes, result.fileName)

      setStatusTone('success')
      setStatusMessage(`Done. ${result.summary}.`)
      await onUsage({
        tool: 'split_merge',
        status: 'completed',
        summary: result.summary,
        durationMs: Date.now() - startedAt,
      })
    } catch (error) {
      const message = error?.message || (mode === 'split' ? 'Unable to process split PDF.' : 'Unable to process merge PDF.')
      setStatusTone('warning')
      setStatusMessage(message)
      await onUsage({
        tool: 'split_merge',
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
          <span className={styles.invoiceSectionLabel}>Split / Merge</span>
          <h2 className={styles.pdfToolHeading}>Process one or multiple PDFs</h2>
          <p className={styles.uploadHint}>Split by page boundaries or merge multiple files in selected order.</p>
        </div>
      </div>

      <div className={styles.invoiceModeSwitch}>
        <button
          className={joinClasses(styles.invoiceModeOption, mode === 'split' && styles.invoiceModeOptionActive)}
          onClick={() => setMode('split')}
          type="button"
        >
          Split
        </button>
        <button
          className={joinClasses(styles.invoiceModeOption, mode === 'merge' && styles.invoiceModeOptionActive)}
          onClick={() => setMode('merge')}
          type="button"
        >
          Merge
        </button>
      </div>

      <div className={styles.splitMergeWorkspace}>
        <div className={styles.splitMergeUploadColumn}>
          {mode === 'split' ? (
            <>
              <PdfDropzone
                file={splitFile}
                hint="Drop a single PDF here or click to browse."
                meta={['PDF only']}
                onFiles={handleSplitFile}
                title="Drop your PDF here"
              />

              {isPreviewLoading ? (
                <p className={joinClasses(styles.uploadHint, styles.splitMergeLoadingHint)}>Rendering thumbnails...</p>
              ) : null}

              {splitPreview?.thumbnails?.length ? (
                <div className={styles.pdfPreviewSection}>
                  <div className={styles.pdfPreviewHeader}>
                    <span className={styles.invoiceSectionLabel}>Uploaded PDF Preview</span>
                    <span className={styles.invoiceMetaPillMuted}>
                      {splitPreview.pageCount} page{splitPreview.pageCount === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className={styles.pdfPreviewStrip}>
                    {splitPreview.thumbnails.map((thumb, index) => (
                      <div className={styles.pdfPreviewItem} key={`split-thumb-${thumb.pageNumber}`}>
                        <div className={styles.pdfPreviewCard}>
                          <img alt={`Page ${thumb.pageNumber}`} className={styles.pdfPreviewImage} src={thumb.dataUrl} />
                          <span className={styles.pdfPreviewLabel}>Page {thumb.pageNumber}</span>
                        </div>

                        {splitMode === 'after_pages' && index < splitPreview.thumbnails.length - 1 ? (
                          <button
                            aria-label={
                              splitCuts.includes(index)
                                ? `Remove split after page ${thumb.pageNumber}`
                                : `Add split after page ${thumb.pageNumber}`
                            }
                            className={joinClasses(
                              styles.pdfSplitDivider,
                              splitCuts.includes(index) && styles.pdfSplitDividerActive,
                            )}
                            onClick={() => toggleSplitCut(index)}
                            title={splitCuts.includes(index) ? 'Split here' : 'Add split'}
                            type="button"
                          >
                            <WorkspaceIcon className={styles.pdfSplitDividerIcon} name="scissors" size={12} />
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <PdfDropzone
                file={mergeItems[0]?.file || null}
                hint="Drop multiple PDFs here or click to browse."
                meta={['PDF only', `${mergeItems.length} selected`]}
                multiple
                onFiles={appendMergeFiles}
                title="Drop PDFs here"
              />

              {isPreviewLoading ? (
                <p className={joinClasses(styles.uploadHint, styles.splitMergeLoadingHint)}>Rendering thumbnails...</p>
              ) : null}

              {mergeItems.length > 0 ? (
                <div className={styles.pdfFileList}>
                  {mergeItems.map((item) => (
                    <div className={styles.pdfFileListItem} key={item.id}>
                      <span>{item.file.name}</span>
                      <span>{item.pageCount}p / {formatFileSize(item.file.size)}</span>
                      <button
                        className={styles.pdfInlineAction}
                        onClick={() => {
                          setMergeItems((current) => current.filter((currentItem) => currentItem.id !== item.id))
                        }}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              {mergeItems.length > 0 ? (
                <div className={styles.pdfPreviewSection}>
                  <div className={styles.pdfPreviewHeader}>
                    <span className={styles.invoiceSectionLabel}>Combined Preview</span>
                    <span className={styles.invoiceMetaPillMuted}>
                      {mergeItems.length} files / {totalMergePages} pages
                    </span>
                  </div>

                  <div className={styles.pdfPreviewStrip}>
                    {mergeItems.map((item, fileIndex) =>
                      item.thumbnails.map((thumb, thumbIndex) => (
                        <div className={styles.pdfPreviewItem} key={`${item.id}-${thumb.pageNumber}`}>
                          <div className={styles.pdfPreviewCard}>
                            {fileIndex > 0 && thumbIndex === 0 ? <span className={styles.pdfMergeBoundary} /> : null}
                            <img alt={`Page ${thumb.pageNumber}`} className={styles.pdfPreviewImage} src={thumb.dataUrl} />
                            <span className={styles.pdfPreviewLabel}>
                              {item.file.name} / {thumb.pageNumber}
                            </span>
                          </div>
                        </div>
                      )),
                    )}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

        <aside className={styles.splitMergeSidebar}>
          <section className={styles.splitMergeSidePanel}>
            <div className={styles.splitMergePanelHeader}>
              <span className={styles.invoiceSectionLabel}>{mode === 'split' ? 'Split options' : 'Merge options'}</span>
            </div>

            {mode === 'split' ? (
              <div className={joinClasses(styles.pdfControlGrid, styles.splitMergeControlGrid)}>
                <label className={styles.pdfField}>
                  <span>Split method</span>
                  <select onChange={(event) => setSplitMode(event.target.value)} value={splitMode}>
                    <option value="after_pages">Split after pages</option>
                    <option value="every_n">Every N pages</option>
                  </select>
                </label>

                {splitMode === 'after_pages' ? (
                  <div className={styles.pdfField}>
                    <span>Selected split points</span>
                    <div className={joinClasses(styles.pdfInfoCard, styles.splitMergeInfoCard)}>
                      {selectedSplitPointsText}
                    </div>
                  </div>
                ) : (
                  <label className={styles.pdfField}>
                    <span>Every N pages</span>
                    <input onChange={(event) => setEveryN(event.target.value)} type="number" value={everyN} />
                  </label>
                )}
              </div>
            ) : (
              <div className={styles.splitMergeSummaryStack}>
                <div className={styles.splitMergeSummaryCard}>
                  <strong>Selected PDFs</strong>
                  <span>
                    {mergeItems.length > 0
                      ? `${mergeItems.length} file${mergeItems.length === 1 ? '' : 's'} ready for merge`
                      : 'Upload at least two PDFs to prepare the merge queue.'}
                  </span>
                </div>
                <div className={styles.splitMergeSummaryCard}>
                  <strong>Total pages</strong>
                  <span>{totalMergePages > 0 ? `${totalMergePages} pages in current order` : 'No pages loaded yet'}</span>
                </div>
              </div>
            )}
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
              {mode === 'merge' && mergeItems.length > 0 ? (
                <button className={styles.uploadActionSecondary} onClick={handleAddMoreFiles} type="button">
                  <WorkspaceIcon name="plus" size={14} />
                  <span>Add more PDFs</span>
                </button>
              ) : null}

              <button className={styles.uploadAction} disabled={isProcessing} onClick={handleProcess} type="button">
                <WorkspaceIcon name="spark" size={15} />
                <span>{isProcessing ? 'Processing...' : mode === 'split' ? 'Process Split' : 'Process Merge'}</span>
              </button>
            </div>
          </section>
        </aside>
      </div>
    </section>
  )
}
