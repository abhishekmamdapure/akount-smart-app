import { useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import WorkspaceIcon from './WorkspaceIcon'
import workspaceStyles from './Workspace.module.css'
import styles from './tools/shared/Tools.module.css'
import ToolClientSelector from './tools/shared/ToolClientSelector'
import { buildSourceHistoryFileLink } from './tools/shared/historyFileLinks'
import { useWorkspaceToolClient } from './tools/shared/toolClientState'
import {
  createTallyHistoryEntry,
  downloadTallyTemplate,
  fetchTallyHistory,
  markTallyHistoryCompleted,
  markTallyHistoryFailed,
  processTallySourceFile,
  uploadTallySourceFile,
} from './tools/tally-xml/tallyXmlConverterService'

const defaultPreferences = Object.freeze({
  includeMasters: true,
  autoCreate: true,
  validateGstin: false,
})

const supportedExtensions = ['.xlsm', '.xlsx', '.xls', '.csv']
const supportedMimeTypes = new Set([
  'application/vnd.ms-excel',
  'application/vnd.ms-office',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
])

function joinClasses(...values) {
  return values.filter(Boolean).join(' ')
}

function formatDateLabel(value) {
  const parsedDate = value ? new Date(value) : new Date()

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsedDate)
}

function buildOptimisticHistoryEntry({ clientName, fileName }) {
  return {
    clientName,
    createdAt: new Date().toISOString(),
    downloadHref: '',
    errorMessage: '',
    fileName,
    id: `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    processingTimeSec: null,
    sourceDownloadHref: '',
    status: 'processing',
  }
}

function replaceHistoryEntry(current, targetIds, nextEntry) {
  const targetIdSet = new Set(targetIds.filter(Boolean).map((value) => String(value)))
  const nextId = String(nextEntry.id)
  const remainingItems = current.filter(
    (item) => !targetIdSet.has(String(item.id)) && String(item.id) !== nextId,
  )

  return [nextEntry, ...remainingItems]
}

function buildFailedHistoryEntry(entry, errorMessage) {
  return {
    ...entry,
    errorMessage,
    status: 'failed',
  }
}

function formatHistoryStatusLabel(status) {
  if (status === 'completed') {
    return 'Completed'
  }

  if (status === 'failed') {
    return 'Failed'
  }

  return 'Processing'
}

function getStatusTone({ file, isProcessing, processError, result, selectedClient }) {
  if (processError) {
    return 'warning'
  }

  if (isProcessing) {
    return 'processing'
  }

  if (result) {
    return 'success'
  }

  if (file && selectedClient) {
    return 'ready'
  }

  return 'idle'
}

function getHistoryEmptyState({ historyError, historyStatus, selectedClient }) {
  if (!selectedClient) {
    return 'Select a client to check history for Tally XML runs.'
  }

  if (historyStatus === 'loading') {
    return 'Loading Tally XML conversion history...'
  }

  if (historyError) {
    return historyError
  }

  return 'No Tally XML conversions yet for this client.'
}

function isSpreadsheetFile(file) {
  if (!file) {
    return false
  }

  const fileName = String(file.name || '').toLowerCase()
  const hasSupportedExtension = supportedExtensions.some((extension) => fileName.endsWith(extension))

  if (hasSupportedExtension) {
    return true
  }

  return supportedMimeTypes.has(String(file.type || '').toLowerCase())
}

function triggerDownload(href) {
  if (!href || typeof document === 'undefined') {
    return
  }

  const link = document.createElement('a')
  link.href = href
  link.rel = 'noreferrer'
  link.target = '_blank'
  document.body.append(link)
  link.click()
  link.remove()
}

export default function TallyXmlConverterPage() {
  const outletContext = useOutletContext() ?? {}
  const authReady = outletContext.authReady ?? false
  const currentUser = outletContext.currentUser ?? null
  const openClientModal = outletContext.openClientModal ?? (() => { })
  const {
    clients,
    errorMessage,
    filteredClients,
    handleSelectClient,
    query,
    reloadClients,
    selectedClient,
    setQuery,
    status,
  } = useWorkspaceToolClient(outletContext)

  const inputRef = useRef(null)
  const historyRequestRef = useRef(0)
  const selectedClientIdRef = useRef(String(selectedClient?.id || ''))

  const [file, setFile] = useState(null)
  const [history, setHistory] = useState([])
  const [historyError, setHistoryError] = useState('')
  const [historyStatus, setHistoryStatus] = useState('idle')
  const [isDragActive, setIsDragActive] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isTemplateDownloading, setIsTemplateDownloading] = useState(false)
  const [processError, setProcessError] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => {
    selectedClientIdRef.current = String(selectedClient?.id || '')
  }, [selectedClient?.id])

  useEffect(() => {
    if (!authReady || !currentUser?.id || !currentUser?.email) {
      setHistory([])
      setHistoryError('')
      setHistoryStatus('idle')
      return
    }

    if (!selectedClient?.id) {
      setHistory([])
      setHistoryError('')
      setHistoryStatus('idle')
      return
    }

    const requestId = historyRequestRef.current + 1
    historyRequestRef.current = requestId

    setHistoryStatus('loading')
    setHistoryError('')

    fetchTallyHistory({
      clientId: selectedClient.id,
      currentUser,
    })
      .then((items) => {
        if (historyRequestRef.current !== requestId) {
          return
        }

        setHistory(items)
        setHistoryStatus('ready')
      })
      .catch((error) => {
        if (historyRequestRef.current !== requestId) {
          return
        }

        setHistory([])
        setHistoryError(error.message || 'Unable to load Tally XML history.')
        setHistoryStatus('error')
      })
  }, [authReady, currentUser?.email, currentUser?.id, selectedClient?.id])

  function resetCurrentRun() {
    setFile(null)
    setIsDragActive(false)
    setProcessError('')
    setResult(null)

    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  function updateVisibleHistory(targetClientId, updater) {
    if (selectedClientIdRef.current !== String(targetClientId)) {
      return
    }

    setHistory(updater)
  }

  function handleClientChange(clientId) {
    const nextClientId = String(clientId)
    const currentClientId = String(selectedClient?.id || '')

    if (nextClientId !== currentClientId) {
      resetCurrentRun()
    }

    handleSelectClient(clientId)
  }

  function handleFilesSelected(fileList) {
    const selectedFile = fileList?.[0]

    if (!selectedFile) {
      return
    }

    if (!isSpreadsheetFile(selectedFile)) {
      setProcessError('Only XLSM, XLSX, XLS, and CSV files are supported for Tally XML conversion.')
      setResult(null)
      return
    }

    setFile(selectedFile)
    setProcessError('')
    setResult(null)
  }

  function handleDrop(event) {
    event.preventDefault()
    event.stopPropagation()
    setIsDragActive(false)

    if (!selectedClient || isProcessing) {
      return
    }

    handleFilesSelected(event.dataTransfer?.files)
  }

  function handleBrowseClick() {
    if (!selectedClient || isProcessing) {
      return
    }

    inputRef.current?.click()
  }

  function handleClearFile() {
    resetCurrentRun()
  }

  async function handleDownloadTemplate() {
    if (isTemplateDownloading) {
      return
    }

    setIsTemplateDownloading(true)
    setProcessError('')

    try {
      const templateResult = await downloadTallyTemplate()
      triggerDownload(templateResult.downloadHref)
    } catch (error) {
      setProcessError(error.message || 'Unable to download the sample template.')
    } finally {
      setIsTemplateDownloading(false)
    }
  }

  async function handleProcess() {
    if (!currentUser?.id || !currentUser?.email) {
      setProcessError('No signed-in user was found. Please sign in again.')
      return
    }

    if (!selectedClient) {
      setProcessError('Choose a client before starting Tally XML conversion.')
      return
    }

    if (!file) {
      setProcessError('Upload a spreadsheet before starting Tally XML conversion.')
      return
    }

    const activeClient = selectedClient
    const activeFile = file
    const optimisticEntry = buildOptimisticHistoryEntry({
      clientName: activeClient.name,
      fileName: activeFile.name,
    })
    let persistedEntryId = ''

    historyRequestRef.current += 1
    setIsProcessing(true)
    setHistoryError('')
    setHistoryStatus('ready')
    setProcessError('')
    setResult(null)
    updateVisibleHistory(activeClient.id, (current) => [optimisticEntry, ...current])

    try {
      const createdEntry = await createTallyHistoryEntry({
        currentUser,
        file: activeFile,
        preferences: defaultPreferences,
        selectedClient: activeClient,
      })

      persistedEntryId = createdEntry.entry.id
      updateVisibleHistory(activeClient.id, (current) =>
        replaceHistoryEntry(current, [optimisticEntry.id], createdEntry.entry),
      )

      await uploadTallySourceFile({
        file: activeFile,
        sourceUpload: createdEntry.sourceUpload,
      })

      const nextResult = await processTallySourceFile({
        file: activeFile,
        preferences: defaultPreferences,
        selectedClient: activeClient,
      })
      const completedEntry = await markTallyHistoryCompleted({
        currentUser,
        entryId: persistedEntryId,
        result: nextResult,
      })

      setResult({
        ...nextResult,
        downloadHref: completedEntry.downloadHref || nextResult.downloadHref || '',
        processingTimeSec: completedEntry.processingTimeSec ?? nextResult.processingTimeSec ?? null,
        sourceDownloadHref: completedEntry.sourceDownloadHref || '',
      })
      setFile(null)
      setIsDragActive(false)
      if (inputRef.current) {
        inputRef.current.value = ''
      }
      const finalDownloadHref = completedEntry.downloadHref || nextResult.downloadHref || ''

      if (finalDownloadHref) {
        triggerDownload(finalDownloadHref)
      }
      updateVisibleHistory(activeClient.id, (current) =>
        replaceHistoryEntry(current, [optimisticEntry.id, persistedEntryId], completedEntry),
      )
    } catch (error) {
      const message = error.message || 'Unable to convert the uploaded spreadsheet to Tally XML.'

      setProcessError(message)

      if (persistedEntryId) {
        try {
          const failedEntry = await markTallyHistoryFailed({
            currentUser,
            entryId: persistedEntryId,
            errorMessage: message,
          })

          updateVisibleHistory(activeClient.id, (current) =>
            replaceHistoryEntry(current, [optimisticEntry.id, persistedEntryId], failedEntry),
          )
        } catch {
          updateVisibleHistory(activeClient.id, (current) =>
            replaceHistoryEntry(current, [optimisticEntry.id, persistedEntryId], {
              ...buildFailedHistoryEntry(
                current.find((item) => String(item.id) === String(persistedEntryId)) || optimisticEntry,
                message,
              ),
              id: persistedEntryId,
            }),
          )
        }
      } else {
        updateVisibleHistory(activeClient.id, (current) =>
          replaceHistoryEntry(current, [optimisticEntry.id], buildFailedHistoryEntry(optimisticEntry, message)),
        )
      }
    } finally {
      setIsProcessing(false)
    }
  }

  function handleDownloadCurrentXml() {
    if (!result?.downloadHref) {
      return
    }

    triggerDownload(result.downloadHref)
  }

  const processingEnabled = Boolean(selectedClient && file && !isProcessing)
  const statusTone = getStatusTone({
    file,
    isProcessing,
    processError,
    result,
    selectedClient,
  })
  const statusTitle = processError
    ? 'Conversion needs attention'
    : isProcessing
      ? 'Generating Tally XML'
      : result
        ? 'Conversion complete'
        : processingEnabled
          ? 'Ready to generate'
          : selectedClient
            ? 'No spreadsheet attached'
            : 'Choose a client first'
  const statusMessage = processError
    ? processError
    : isProcessing
      ? 'A conversion entry has been created. The history row will stay yellow until XML generation and storage finish.'
      : result
        ? result.message
        : selectedClient
          ? file
            ? `${file.name} is ready for XML conversion.`
            : 'Upload a spreadsheet to continue.'
          : 'Select a client to enable upload and conversion.'
  const historyEmptyState = getHistoryEmptyState({
    historyError,
    historyStatus,
    selectedClient,
  })
  const formatProcessingTime = (value) => {
    if (value === null || value === undefined || value === '') {
      return '-'
    }

    const numericValue = Number(value)

    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return '-'
    }

    return `${numericValue.toFixed(2)} s`
  }

  return (
    <div className={joinClasses(workspaceStyles.page, styles.toolPage, styles.invoicePage)}>
      <section className={styles.invoiceTopbar}>
        <div className={styles.invoiceTopbarLeft}>
          <h1 className={styles.invoicePageTitle}>Tally XML Converter</h1>
        </div>

        <ToolClientSelector
          clients={clients}
          errorMessage={errorMessage}
          filteredClients={filteredClients}
          onCreateClient={openClientModal}
          onQueryChange={setQuery}
          onRetry={reloadClients}
          onSelectClient={handleClientChange}
          query={query}
          selectedClient={selectedClient}
          status={status}
          variant="badge"
        />
      </section>

      <article className={styles.invoiceMainCard}>
        <div className={styles.invoiceCardTop}>
          <section className={styles.invoiceUploadZone}>
            <span className={styles.invoiceSectionLabel}>Source file</span>
            <div
              className={joinClasses(
                styles.invoiceUploadArea,
                isDragActive && styles.invoiceUploadAreaActive,
                !selectedClient && styles.invoiceUploadAreaDisabled,
              )}
              onClick={handleBrowseClick}
              onDragEnter={(event) => {
                event.preventDefault()
                if (selectedClient && !isProcessing) {
                  setIsDragActive(true)
                }
              }}
              onDragLeave={(event) => {
                event.preventDefault()
                setIsDragActive(false)
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              role="presentation"
            >
              <span className={styles.invoiceUploadIcon}>
                <WorkspaceIcon name="upload" size={18} />
              </span>
              {file ? (
                <button
                  aria-label="Clear selected file"
                  className={styles.tallyUploadClearButton}
                  disabled={isProcessing}
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    handleClearFile()
                  }}
                  type="button"
                >
                  <WorkspaceIcon name="close" size={14} />
                </button>
              ) : null}
              <h2>{file ? file.name : 'Drag and drop spreadsheet file'}</h2>
              <p>
                {selectedClient
                  ? file
                    ? 'Use browse to replace the current source or generate XML now.'
                    : 'Or browse to choose a spreadsheet for the selected client.'
                  : 'Select a client first to unlock upload.'}
              </p>
              <div className={styles.invoiceUploadTags}>
                <span className={styles.invoiceTag}>XLSM Template supported</span>
              </div>
              <input
                accept=".xlsm,.xlsx,.xls,.csv"
                onChange={(event) => handleFilesSelected(event.target.files)}
                ref={inputRef}
                style={{ display: 'none' }}
                type="file"
              />
            </div>
          </section>

          <aside className={`${styles.invoiceControlsPanel} ${styles.tallyControlsPanel}`}>
            <section className={styles.tallyControlSection}>
              <span className={styles.invoiceSectionLabel}>Template</span>
              <div className={styles.invoiceButtonStack}>
                <button
                  className={`${styles.invoiceSecondaryButton} ${styles.tallyTemplateButton}`}
                  disabled={isTemplateDownloading}
                  onClick={handleDownloadTemplate}
                  type="button"
                >
                  <WorkspaceIcon name="download" size={15} />
                  <span>{isTemplateDownloading ? 'Preparing Template...' : 'Download Template'}</span>
                </button>
              </div>
            </section>

            <section className={`${styles.tallyControlSection} ${styles.tallyProcessingSection}`}>
              <div>
                <span className={styles.invoiceSectionLabel}>File status</span>
                <div className={styles.invoiceStatusRow}>
                  <span
                    className={joinClasses(
                      styles.invoiceStatusDot,
                      statusTone === 'processing' && styles.invoiceStatusDotProcessing,
                      statusTone === 'success' && styles.invoiceStatusDotSuccess,
                      statusTone === 'warning' && styles.invoiceStatusDotWarning,
                      statusTone === 'ready' && styles.invoiceStatusDotReady,
                    )}
                  />
                  <div className={styles.invoiceStatusCopy}>
                    <strong>{statusTitle}</strong>
                    <span>{statusMessage}</span>
                  </div>
                </div>
              </div>

              <div className={styles.invoiceButtonStack}>
                <button
                  className={styles.invoicePrimaryButton}
                  disabled={!processingEnabled}
                  onClick={handleProcess}
                  type="button"
                >
                  <WorkspaceIcon name="spark" size={16} />
                  <span>{isProcessing ? 'Generating XML...' : 'Generate Tally XML'}</span>
                </button>
                {result?.downloadHref ? (
                  <button
                    className={styles.invoiceSecondaryButton}
                    disabled={isProcessing}
                    onClick={handleDownloadCurrentXml}
                    type="button"
                  >
                    <WorkspaceIcon name="download" size={15} />
                    <span>Download XML</span>
                  </button>
                ) : null}
              </div>
            </section>
          </aside>
        </div>

        <div className={styles.invoiceCardDivider} />

        <section className={styles.invoiceHistorySection}>
          <div className={styles.invoiceHistoryHeader}>
            <h2>File history</h2>
          </div>

          <div className={styles.invoiceHistoryTableWrap}>
            <table className={styles.invoiceHistoryTable}>
              <thead>
                <tr>
                  <th>File name</th>
                  <th>Client</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Output</th>
                  <th>Processing time</th>
                </tr>
              </thead>
              <tbody>
                {history.length > 0 ? (
                  history.map((item) => {
                    const sourceFileLink = buildSourceHistoryFileLink(item, 'source.xlsx')

                    return (
                      <tr key={item.id}>
                        <td>
                          {sourceFileLink.href ? (
                            <a
                              className={styles.tallyHistoryFileLink}
                              href={sourceFileLink.href}
                              rel="noreferrer"
                              target="_blank"
                            >
                              {sourceFileLink.fileName || '-'}
                            </a>
                          ) : (
                            sourceFileLink.fileName || '-'
                          )}
                        </td>
                        <td>{item.clientName}</td>
                        <td>{formatDateLabel(item.createdAt || item.updatedAt)}</td>
                        <td>
                          <span
                            className={joinClasses(
                              styles.invoiceHistoryStatus,
                              item.status === 'processing' && styles.invoiceHistoryStatusProcessing,
                              item.status === 'completed' && styles.invoiceHistoryStatusCompleted,
                              item.status === 'failed' && styles.invoiceHistoryStatusFailed,
                            )}
                          >
                            {item.status === 'processing' ? (
                              <span className={styles.invoiceHistorySpinner} aria-hidden="true" />
                            ) : null}
                            <span>{formatHistoryStatusLabel(item.status)}</span>
                          </span>
                        </td>
                        <td>
                          {item.downloadHref ? (
                            <a
                              className={styles.tallyHistoryFileLink}
                              href={item.downloadHref}
                              rel="noreferrer"
                              target="_blank"
                            >
                              {item.resultFileName || 'tally-output.xml'}
                            </a>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td>{formatProcessingTime(item.processingTimeSec)}</td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td className={styles.invoiceHistoryEmpty} colSpan={6}>
                      {historyEmptyState}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </article>
    </div>
  )
}
