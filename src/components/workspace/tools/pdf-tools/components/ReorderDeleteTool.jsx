import { useState } from 'react'
import WorkspaceIcon from '../../../WorkspaceIcon'
import styles from '../../shared/Tools.module.css'
import { downloadBytes, renderPdfThumbnails, reorderAndDeletePdf } from '../pdfToolsOperations'
import { joinClasses } from './helpers'
import PdfDropzone from './PdfDropzone'

export default function ReorderDeleteTool({ onUsage }) {
  const [file, setFile] = useState(null)
  const [cards, setCards] = useState([])
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [statusTone, setStatusTone] = useState('ready')
  const [statusMessage, setStatusMessage] = useState('Upload a PDF to arrange pages.')
  const [dragIndex, setDragIndex] = useState(null)

  async function handleFile(fileValue) {
    setFile(fileValue)
    setIsLoadingPreview(true)
    setStatusMessage('Rendering page previews...')

    try {
      const { thumbnails } = await renderPdfThumbnails(fileValue)

      setCards(
        thumbnails.map((thumb) => ({
          pageNumber: thumb.pageNumber,
          dataUrl: thumb.dataUrl,
          removed: false,
        })),
      )
      setStatusTone('ready')
      setStatusMessage('Drag cards to reorder. Toggle remove to delete pages.')
    } catch (error) {
      setCards([])
      setStatusTone('warning')
      setStatusMessage(error?.message || 'Unable to render page previews.')
    } finally {
      setIsLoadingPreview(false)
    }
  }

  async function handleProcess() {
    if (!file) {
      setStatusTone('warning')
      setStatusMessage('Select a PDF first.')
      return
    }

    const startedAt = Date.now()
    setIsProcessing(true)

    try {
      const orderedPageNumbers = cards.filter((card) => !card.removed).map((card) => card.pageNumber)
      const result = await reorderAndDeletePdf(file, { orderedPageNumbers })

      downloadBytes(result.bytes, result.fileName)
      setStatusTone('success')
      setStatusMessage(`Done. ${result.summary}.`)
      await onUsage({
        tool: 'reorder_delete',
        status: 'completed',
        summary: result.summary,
        durationMs: Date.now() - startedAt,
      })
    } catch (error) {
      const message = error?.message || 'Unable to reorder/delete pages.'
      setStatusTone('warning')
      setStatusMessage(message)
      await onUsage({
        tool: 'reorder_delete',
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
          <span className={styles.invoiceSectionLabel}>Reorder / Delete</span>
          <h2 className={styles.pdfToolHeading}>Arrange and remove pages</h2>
          <p className={styles.uploadHint}>Drag cards to reorder. Use remove to exclude pages from final output.</p>
        </div>
      </div>

      <PdfDropzone
        file={file}
        hint="Drop your PDF here or click to browse."
        meta={['PDF only']}
        onFiles={handleFile}
        title="Drop your PDF here"
      />

      {isLoadingPreview ? <p className={styles.uploadHint}>Rendering thumbnails...</p> : null}

      {cards.length > 0 ? (
        <div className={styles.pdfThumbGrid}>
          {cards.map((card, index) => (
            <div
              className={joinClasses(styles.pdfThumbCard, card.removed && styles.pdfThumbCardRemoved)}
              draggable
              key={`${card.pageNumber}-${index}`}
              onDragEnd={() => setDragIndex(null)}
              onDragOver={(event) => event.preventDefault()}
              onDragStart={() => setDragIndex(index)}
              onDrop={() => {
                if (dragIndex === null || dragIndex === index) {
                  return
                }

                setCards((current) => {
                  const next = [...current]
                  const [moved] = next.splice(dragIndex, 1)
                  next.splice(index, 0, moved)
                  return next
                })
              }}
            >
              <img alt={`Page ${card.pageNumber}`} src={card.dataUrl} />
              <div className={styles.pdfThumbMeta}>
                <span>Page {card.pageNumber}</span>
                <button
                  className={styles.uploadActionSecondary}
                  onClick={() => {
                    setCards((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? {
                            ...item,
                            removed: !item.removed,
                          }
                          : item,
                      ),
                    )
                  }}
                  type="button"
                >
                  {card.removed ? 'Restore' : 'Remove'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className={styles.uploadActions}>
        <button className={styles.uploadAction} disabled={isProcessing || cards.length === 0} onClick={handleProcess} type="button">
          <WorkspaceIcon name="spark" size={15} />
          <span>{isProcessing ? 'Saving PDF...' : 'Save New PDF'}</span>
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
