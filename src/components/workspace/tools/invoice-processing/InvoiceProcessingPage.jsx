import { useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import WorkspaceIcon from '../../WorkspaceIcon'
import workspaceStyles from '../../Workspace.module.css'
import styles from '../shared/Tools.module.css'
import ToolClientSelector from '../shared/ToolClientSelector'
import { useWorkspaceToolClient } from '../shared/toolClientState'
import {
  createInvoiceHistoryEntry,
  fetchInvoiceHistory,
  markInvoiceHistoryCompleted,
  markInvoiceHistoryFailed,
  processInvoiceFile,
  uploadInvoiceSourceFile,
} from './invoiceProcessingService'

function joinClasses(...values) {
  return values.filter(Boolean).join(' ')
}

function formatModeLabel(mode) {
  return mode === 'combined' ? 'Combined' : 'Separate'
}

function formatDateLabel(value) {
  const parsedDate = value ? new Date(value) : new Date()

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsedDate)
}

function formatProcessingTime(value) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  const numericValue = Number(value)

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return '-'
  }

  return `${numericValue.toFixed(2)} s`
}

function buildOptimisticHistoryEntry({ clientName, fileName, mode }) {
  return {
    clientName,
    createdAt: new Date().toISOString(),
    downloadHref: '',
    errorMessage: '',
    fileName,
    id: `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    mode,
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
    return 'Select a client to check history for invoice runs.'
  }

  if (historyStatus === 'loading') {
    return 'Loading invoice history...'
  }

  if (historyError) {
    return historyError
  }

  return 'No processed invoices yet for this client.'
}

export default function InvoiceProcessingPage() {
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

  const [mode, setMode] = useState('separate')
  const [file, setFile] = useState(null)
  const [history, setHistory] = useState([])
  const [historyError, setHistoryError] = useState('')
  const [historyStatus, setHistoryStatus] = useState('idle')
  const [isDragActive, setIsDragActive] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
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

    fetchInvoiceHistory({
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
        setHistoryError(error.message || 'Unable to load invoice history.')
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

    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setProcessError('Only PDF files are supported for invoice processing.')
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

  async function handleProcess() {
    if (!currentUser?.id || !currentUser?.email) {
      setProcessError('No signed-in user was found. Please sign in again.')
      return
    }

    if (!selectedClient) {
      setProcessError('Choose a client before starting invoice processing.')
      return
    }

    if (!file) {
      setProcessError('Upload a PDF file before starting invoice processing.')
      return
    }

    const activeClient = selectedClient
    const activeFile = file
    const activeMode = mode
    const optimisticEntry = buildOptimisticHistoryEntry({
      clientName: activeClient.name,
      fileName: activeFile.name,
      mode: activeMode,
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
      const createdEntry = await createInvoiceHistoryEntry({
        currentUser,
        file: activeFile,
        mode: activeMode,
        selectedClient: activeClient,
      })

      persistedEntryId = createdEntry.entry.id
      updateVisibleHistory(activeClient.id, (current) =>
        replaceHistoryEntry(current, [optimisticEntry.id], createdEntry.entry),
      )

      await uploadInvoiceSourceFile({
        file: activeFile,
        sourceUpload: createdEntry.sourceUpload,
      })

      const nextResult = await processInvoiceFile({
        file: activeFile,
        mode: activeMode,
        selectedClient: activeClient,
      })
      const completedEntry = await markInvoiceHistoryCompleted({
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
      updateVisibleHistory(activeClient.id, (current) =>
        replaceHistoryEntry(current, [optimisticEntry.id, persistedEntryId], completedEntry),
      )
    } catch (error) {
      const message = error.message || 'Unable to process the invoice PDF.'

      setProcessError(message)

      if (persistedEntryId) {
        try {
          const failedEntry = await markInvoiceHistoryFailed({
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

  const processingEnabled = Boolean(selectedClient && file && !isProcessing)
  const statusTone = getStatusTone({
    file,
    isProcessing,
    processError,
    result,
    selectedClient,
  })
  const statusTitle = processError
    ? 'Processing needs attention'
    : isProcessing
      ? 'Processing invoice'
      : result
        ? 'Processing complete'
        : processingEnabled
          ? 'Ready to process'
          : selectedClient
            ? 'No PDF attached'
            : 'Choose a client first'
  const statusMessage = processError
    ? processError
    : isProcessing
      ? 'A processing entry has been created. The history row will stay yellow until OCR and storage finish.'
      : result?.message ||
      (selectedClient
        ? file
          ? `${file.name} is ready for ${formatModeLabel(mode).toLowerCase()} processing.`
          : 'Upload a PDF to continue.'
        : 'Select a client to enable upload and processing.')
  const modeDescription =
    mode === 'combined'
      ? 'All extracted line items are merged into one combined entry for summary-level bookkeeping.'
      : 'Each extracted line item stays on its own row for granular review before export.'
  const historyEmptyState = getHistoryEmptyState({
    historyError,
    historyStatus,
    selectedClient,
  })

  return (
    <div className={joinClasses(workspaceStyles.page, styles.toolPage, styles.invoicePage)}>
      <section className={styles.invoiceTopbar}>
        <div className={styles.invoiceTopbarLeft}>
          <h1 className={styles.invoicePageTitle}>Invoice Processing</h1>
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
            <span className={styles.invoiceSectionLabel}>Invoice file</span>
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
              <h2>{file ? file.name : 'Drag and drop invoice PDF'}</h2>
              <p>
                {selectedClient
                  ? file
                    ? 'Use Browse PDF to replace the current file or process this one now.'
                    : 'Or browse to choose a file for the selected client.'
                  : 'Select a client first to unlock upload.'}
              </p>
              <div className={styles.invoiceUploadTags}>
                <span className={styles.invoiceTag}>PDF only</span>
                <span className={styles.invoiceTag}>Scanned supported</span>
              </div>
              <input
                accept=".pdf,application/pdf"
                onChange={(event) => handleFilesSelected(event.target.files)}
                ref={inputRef}
                style={{ display: 'none' }}
                type="file"
              />
            </div>
          </section>

          <aside className={styles.invoiceControlsPanel}>
            <div>
              <span className={styles.invoiceSectionLabel}>Processing mode</span>
              <div className={styles.invoiceModeToggle}>
                <button
                  className={joinClasses(
                    styles.invoiceModeButton,
                    mode === 'separate' && styles.invoiceModeButtonActive,
                  )}
                  onClick={() => setMode('separate')}
                  type="button"
                >
                  Separate
                </button>
                <button
                  className={joinClasses(
                    styles.invoiceModeButton,
                    mode === 'combined' && styles.invoiceModeButtonActive,
                  )}
                  onClick={() => setMode('combined')}
                  type="button"
                >
                  Combined
                </button>
              </div>
              <p className={styles.invoiceModeDescription}>{modeDescription}</p>
            </div>

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
              <button className={styles.invoicePrimaryButton} disabled={!processingEnabled} onClick={handleProcess} type="button">
                <WorkspaceIcon name="spark" size={16} />
                <span>{isProcessing ? 'Processing...' : 'Process invoice'}</span>
              </button>
              {file ? (
                <button
                  className={styles.invoiceSecondaryButton}
                  disabled={isProcessing}
                  onClick={handleClearFile}
                  type="button"
                >
                  Clear file
                </button>
              ) : null}
            </div>
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
                  <th>Mode</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Output</th>
                  <th>Processing time</th>
                </tr>
              </thead>
              <tbody>
                {history.length > 0 ? (
                  history.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.downloadHref ? (
                          <a
                            className={styles.tallyHistoryFileLink}
                            href={item.downloadHref}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {item.fileName}
                          </a>
                        ) : (
                          item.fileName
                        )}
                      </td>
                      <td>{item.clientName}</td>
                      <td>{formatModeLabel(item.mode)}</td>
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
                          <a className={styles.tallyHistoryFileLink} href={item.downloadHref} rel="noreferrer" target="_blank">
                            {item.resultFileName || 'invoice-processed.xlsx'}
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>{formatProcessingTime(item.processingTimeSec)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className={styles.invoiceHistoryEmpty} colSpan={7}>
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
