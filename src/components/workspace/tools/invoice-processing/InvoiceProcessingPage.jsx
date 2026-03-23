import { useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import WorkspaceIcon from '../../WorkspaceIcon'
import workspaceStyles from '../../Workspace.module.css'
import ToolClientPanel from '../shared/ToolClientPanel'
import styles from '../shared/Tools.module.css'
import { useToolClients } from '../shared/toolClientState'
import { processInvoiceFile } from './invoiceProcessingService'

function joinClasses(...values) {
  return values.filter(Boolean).join(' ')
}

function formatFileSize(sizeInBytes) {
  if (!sizeInBytes) {
    return '0 KB'
  }

  const sizeInMb = sizeInBytes / (1024 * 1024)
  if (sizeInMb >= 1) {
    return `${sizeInMb.toFixed(1)} MB`
  }

  return `${Math.max(1, Math.round(sizeInBytes / 1024))} KB`
}

function formatSearchableText(client) {
  return [client.name, client.tradeName, client.gst, client.pan, client.email]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function getStatusTone(result, processError, file, selectedClient) {
  if (processError) {
    return 'warning'
  }

  if (result) {
    return result.mode === 'connected' ? 'success' : 'warning'
  }

  if (file && selectedClient) {
    return 'ready'
  }

  return 'idle'
}

export default function InvoiceProcessingPage() {
  const outletContext = useOutletContext() ?? {}
  const authReady = outletContext.authReady ?? false
  const clientRefreshKey = outletContext.clientRefreshKey ?? 0
  const currentUser = outletContext.currentUser ?? null
  const openClientModal = outletContext.openClientModal ?? (() => {})
  const userProfile = outletContext.userProfile ?? null

  const { clientLookup, clients, errorMessage, reloadClients, status } = useToolClients({
    authReady,
    currentUser,
    refreshKey: clientRefreshKey,
  })

  const inputRef = useRef(null)

  const [query, setQuery] = useState('')
  const [selectedClientId, setSelectedClientId] = useState('')
  const [mode, setMode] = useState('separate')
  const [file, setFile] = useState(null)
  const [isDragActive, setIsDragActive] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processError, setProcessError] = useState('')
  const [result, setResult] = useState(null)

  const filteredClients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return clients
    }

    return clients.filter((client) => formatSearchableText(client).includes(normalizedQuery))
  }, [clients, query])

  const selectedClient = selectedClientId ? clientLookup.get(String(selectedClientId)) || null : null

  const planName = userProfile?.plan?.name || 'Basic Plan'
  const clientLimit = userProfile?.plan?.clientLimit || 10
  const clientsUsed = userProfile?.usage?.clientsUsed ?? clients.length

  function handleSelectClient(clientId) {
    setSelectedClientId(clientId)
    setProcessError('')
    setResult(null)
  }

  function handleFilesSelected(fileList) {
    const selectedFile = fileList?.[0]

    if (!selectedFile) {
      return
    }

    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setProcessError('Only PDF files are supported for invoice processing.')
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
    setFile(null)
    setProcessError('')
    setResult(null)

    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  async function handleProcess() {
    if (!selectedClient) {
      setProcessError('Choose a client before starting invoice processing.')
      return
    }

    if (!file) {
      setProcessError('Upload a PDF file before starting invoice processing.')
      return
    }

    setIsProcessing(true)
    setProcessError('')
    setResult(null)

    try {
      const nextResult = await processInvoiceFile({
        file,
        mode,
        selectedClient,
      })

      setResult(nextResult)
    } catch (error) {
      setProcessError(error.message || 'Unable to process the invoice PDF.')
    } finally {
      setIsProcessing(false)
    }
  }

  const processingEnabled = Boolean(selectedClient && file && !isProcessing)
  const statusTone = getStatusTone(result, processError, file, selectedClient)
  const statusTitle = processError
    ? 'Processing needs attention'
    : result
      ? result.mode === 'connected'
        ? 'Processing complete'
        : 'UI ready, backend pending'
      : processingEnabled
        ? 'Ready to process'
        : selectedClient
          ? 'Choose a PDF file'
          : 'Choose a client first'
  const statusMessage = processError
    ? processError
    : result?.message ||
      (selectedClient
        ? file
          ? 'The selected PDF is ready to be processed for the chosen client.'
          : 'Upload an invoice PDF to continue with OCR and export preparation.'
        : 'All invoice actions stay locked until a client is selected from the workspace list.')

  return (
    <div className={joinClasses(workspaceStyles.page, styles.toolPage)}>
      <section className={workspaceStyles.pageIntro}>
        <div>
          <p className={workspaceStyles.eyebrow}>Accounting tool</p>
          <h1 className={workspaceStyles.pageTitle}>Invoice Processing</h1>
          <p className={workspaceStyles.pageText}>
            The first step is always client selection. Once the entity is locked, the team can upload invoice PDFs, choose a processing mode, and push the document into the OCR-to-Excel workflow.
          </p>
        </div>

        <div className={styles.heroStats}>
          <article className={styles.heroStat}>
            <span className={styles.heroStatLabel}>Client required</span>
            <strong>{selectedClient ? selectedClient.name : 'Not selected'}</strong>
            <span>Every invoice run stays attached to one client entity.</span>
          </article>
          <article className={styles.heroStat}>
            <span className={styles.heroStatLabel}>Processing mode</span>
            <strong>{mode === 'combined' ? 'Combined' : 'Separate'}</strong>
            <span>Switch how line items should be grouped before export.</span>
          </article>
          <article className={styles.heroStat}>
            <span className={styles.heroStatLabel}>File status</span>
            <strong>{file ? file.name : 'No PDF attached'}</strong>
            <span>{file ? `${formatFileSize(file.size)} ready for upload` : 'Supports invoice PDFs only'}</span>
          </article>
        </div>
      </section>

      <ToolClientPanel
        clients={clients}
        clientsUsed={clientsUsed}
        clientLimit={clientLimit}
        errorMessage={errorMessage}
        filteredClients={filteredClients}
        onCreateClient={openClientModal}
        onQueryChange={setQuery}
        onRetry={reloadClients}
        onSelectClient={handleSelectClient}
        planName={planName}
        query={query}
        selectedClient={selectedClient}
        status={status}
      />

      <section className={styles.toolGrid}>
        <div className={styles.toolMain}>
          <article className={styles.uploadCard}>
            <div className={styles.uploadHeader}>
              <div className={styles.uploadCardHeader}>
                <p className={workspaceStyles.eyebrow}>Step 1</p>
                <h2>Prepare the invoice file</h2>
                <p className={styles.uploadHint}>
                  Keep the current app color and typography system, but move the invoice workflow into a clearer two-step flow: select client first, then upload and process.
                </p>
              </div>

              <span className={styles.uploadIcon}>
                <WorkspaceIcon name="upload" size={22} />
              </span>
            </div>

            <div className={styles.uploadMeta}>
              <span className={styles.modeTag}>{selectedClient ? `Client: ${selectedClient.name}` : 'Client not selected'}</span>
              <span className={joinClasses(styles.modeTag, styles.modeTagMuted)}>{file ? 'PDF attached' : 'Awaiting PDF'}</span>
            </div>

            <div className={styles.modeGrid}>
              <button
                className={joinClasses(styles.modeButton, mode === 'combined' && styles.modeButtonActive)}
                onClick={() => setMode('combined')}
                type="button"
              >
                <div className={styles.modeChoice}>
                  <WorkspaceIcon name="spark" size={18} />
                  <span className={styles.modeTag}>Combined</span>
                </div>
                <h3>Merge line items into one export-ready entry</h3>
                <p>Use this when multiple particulars should be grouped into a single row for the same seller and GSTIN.</p>
              </button>

              <button
                className={joinClasses(styles.modeButton, mode === 'separate' && styles.modeButtonActive)}
                onClick={() => setMode('separate')}
                type="button"
              >
                <div className={styles.modeChoice}>
                  <WorkspaceIcon name="switch" size={18} />
                  <span className={styles.modeTag}>Separate</span>
                </div>
                <h3>Keep each extracted particular in its own line</h3>
                <p>Use this when reviewers need a more granular export before posting into downstream accounting tools.</p>
              </button>
            </div>

            <div
              className={joinClasses(
                styles.dropzone,
                isDragActive && styles.dropzoneActive,
                !selectedClient && styles.dropzoneDisabled,
              )}
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
              <span className={styles.summaryCardIcon}>
                <WorkspaceIcon name="invoice" size={24} />
              </span>
              <strong>{file ? file.name : 'Drag and drop invoice PDF here'}</strong>
              <p>
                {selectedClient
                  ? 'Upload the invoice document for the selected client. Once the processing API is configured, this screen can post the file directly into the OCR workflow.'
                  : 'Client selection comes first. Pick a client above to unlock drag-and-drop and browse actions.'}
              </p>
              <div className={styles.dropzoneMeta}>
                <span>PDF only</span>
                <span>Best for scanned invoices and vendor PDFs</span>
                <span>Client-linked run</span>
              </div>
              <input
                accept=".pdf,application/pdf"
                onChange={(event) => handleFilesSelected(event.target.files)}
                ref={inputRef}
                style={{ display: 'none' }}
                type="file"
              />
            </div>

            {file ? (
              <div className={styles.selectedFileCard}>
                <strong>{file.name}</strong>
                <p className={styles.uploadHint}>
                  Ready to process for {selectedClient?.name || 'the selected client'} in {mode} mode.
                </p>
                <div className={styles.selectedFileMeta}>
                  <span>{formatFileSize(file.size)}</span>
                  <span>{file.type || 'application/pdf'}</span>
                  <span>{mode === 'combined' ? 'Combined export' : 'Separate export'}</span>
                </div>
              </div>
            ) : null}

            <div className={styles.uploadActions}>
              <button
                className={joinClasses(styles.uploadAction, styles.uploadActionSecondary)}
                disabled={!selectedClient || isProcessing}
                onClick={handleBrowseClick}
                type="button"
              >
                <WorkspaceIcon name="upload" size={16} />
                <span>Browse PDF</span>
              </button>
              <button className={styles.uploadAction} disabled={!processingEnabled} onClick={handleProcess} type="button">
                <WorkspaceIcon name="spark" size={16} />
                <span>{isProcessing ? 'Processing...' : 'Process Invoice'}</span>
              </button>
              <button
                className={joinClasses(styles.uploadAction, styles.uploadActionSecondary)}
                disabled={!file || isProcessing}
                onClick={handleClearFile}
                type="button"
              >
                <WorkspaceIcon name="close" size={16} />
                <span>Clear File</span>
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
                    statusTone === 'ready' && styles.statusIndicatorReady,
                    statusTone === 'success' && styles.statusIndicatorSuccess,
                  )}
                />
                <div>
                  <strong>{statusTitle}</strong>
                  <p className={styles.statusMessage}>{statusMessage}</p>
                </div>
              </div>
            </div>
          </article>

          <article className={styles.resultCard}>
            <div className={styles.resultHeader}>
              <div>
                <p className={workspaceStyles.eyebrow}>Step 2</p>
                <h2>Review the run outcome</h2>
                <p className={styles.resultMeta}>
                  This section stays stable after each run so the user can verify client context, processing mode, and output readiness without hunting through the page.
                </p>
              </div>
              <span className={styles.resultTag}>{result ? 'Latest run' : 'Awaiting first run'}</span>
            </div>

            {result ? (
              <>
                <div className={styles.resultList}>
                  <div className={styles.resultItem}>
                    <div>
                      <span className={styles.resultLabel}>Client</span>
                      <strong className={styles.resultValue}>{result.clientName}</strong>
                    </div>
                    <span className={styles.modeTag}>{mode === 'combined' ? 'Combined' : 'Separate'}</span>
                  </div>
                  <div className={styles.resultItem}>
                    <div>
                      <span className={styles.resultLabel}>File</span>
                      <strong className={styles.resultValue}>{result.fileName}</strong>
                    </div>
                    <span className={styles.modeTag}>{result.pages ? `${result.pages} pages` : 'Pages pending'}</span>
                  </div>
                  <div className={styles.resultItem}>
                    <div>
                      <span className={styles.resultLabel}>Run mode</span>
                      <strong className={styles.resultValue}>{result.mode === 'connected' ? 'Connected API run' : 'Preview-only UI run'}</strong>
                    </div>
                    <span className={styles.modeTag}>{result.fileId || 'No file id yet'}</span>
                  </div>
                </div>

                <div className={styles.resultFooter}>
                  <p className={styles.resultMeta}>{result.message}</p>
                  <div className={styles.resultActions}>
                    {result.downloadHref ? (
                      <a className={styles.resultAction} href={result.downloadHref} rel="noreferrer" target="_blank">
                        <WorkspaceIcon name="download" size={16} />
                        <span>Download Excel</span>
                      </a>
                    ) : null}
                    <button
                      className={joinClasses(styles.resultAction, styles.resultActionSecondary)}
                      onClick={handleClearFile}
                      type="button"
                    >
                      <WorkspaceIcon name="close" size={16} />
                      <span>Start New Run</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.emptyQueue}>
                <span className={styles.summaryCardIcon}>
                  <WorkspaceIcon name="download" size={20} />
                </span>
                <h3>No run output yet</h3>
                <p>
                  After the first invoice-processing action, this panel will show the client-linked result, run mode, and download action in one place.
                </p>
              </div>
            )}
          </article>
        </div>

        <aside className={styles.toolAside}>
          <article className={styles.helperCard}>
            <div className={styles.helperCardHeader}>
              <div>
                <p className={workspaceStyles.eyebrow}>Workflow notes</p>
                <h3 className={styles.helperCardTitle}>Why this layout works better</h3>
              </div>
              <span className={styles.helperCardIcon}>
                <WorkspaceIcon name="check" size={18} />
              </span>
            </div>

            <div className={styles.helperCardList}>
              <div className={styles.helperRow}>
                <span className={styles.queueCardIcon}>
                  <WorkspaceIcon name="clients" size={16} />
                </span>
                <div>
                  <strong>Client-first access pattern</strong>
                  <p>The tool starts with the client filter so billing context and entity context are established before any file action.</p>
                </div>
              </div>
              <div className={styles.helperRow}>
                <span className={styles.queueCardIcon}>
                  <WorkspaceIcon name="switch" size={16} />
                </span>
                <div>
                  <strong>Clear mode decision</strong>
                  <p>Combined and separate processing are shown as distinct choices with direct explanations instead of hidden config.</p>
                </div>
              </div>
              <div className={styles.helperRow}>
                <span className={styles.queueCardIcon}>
                  <WorkspaceIcon name="dashboard" size={16} />
                </span>
                <div>
                  <strong>Stable outcome area</strong>
                  <p>The result card always lives in the same spot, which reduces layout jumps and makes repeated use faster for operators.</p>
                </div>
              </div>
            </div>
          </article>

          <article className={styles.helperCard}>
            <div className={styles.helperCardHeader}>
              <div>
                <p className={workspaceStyles.eyebrow}>Queue snapshot</p>
                <h3 className={styles.helperCardTitle}>Processing checklist</h3>
              </div>
              <span className={styles.helperCardIcon}>
                <WorkspaceIcon name="invoice" size={18} />
              </span>
            </div>

            <div className={styles.queueCards}>
              <div className={styles.queueCard}>
                <strong>1. Client locked</strong>
                <p>{selectedClient ? `${selectedClient.name} selected for this run.` : 'Waiting for client selection.'}</p>
              </div>
              <div className={styles.queueCard}>
                <strong>2. Source PDF attached</strong>
                <p>{file ? `${file.name} is ready for upload.` : 'Waiting for invoice PDF.'}</p>
              </div>
              <div className={styles.queueCard}>
                <strong>3. API handoff</strong>
                <p>{result?.mode === 'connected' ? 'Connected run completed.' : 'Will activate when the processing endpoint is configured.'}</p>
              </div>
            </div>
          </article>

          <article className={styles.guidanceCard}>
            <div className={styles.guidanceHeader}>
              <span className={styles.summaryCardIcon}>
                <WorkspaceIcon name="spark" size={18} />
              </span>
              <div>
                <p className={workspaceStyles.eyebrow}>Next integration</p>
                <h2>Backend handoff</h2>
              </div>
            </div>

            <div className={styles.guidanceList}>
              <div className={styles.guidanceItem}>
                <div>
                  <strong>Environment switch</strong>
                  <p>Set `VITE_INVOICE_PROCESS_API_BASE_URL` to connect this UI to the live invoice-processing API.</p>
                </div>
              </div>
              <div className={styles.guidanceItem}>
                <div>
                  <strong>Client payload</strong>
                  <p>The selected client id and name are already included in the request structure so downstream services can tag the run correctly.</p>
                </div>
              </div>
              <div className={styles.guidanceItem}>
                <div>
                  <strong>Reuse for other tools</strong>
                  <p>The new `tools` folder now contains the client-first scaffold that can be reused for GST reconciliation, PDF tools, and future workflows.</p>
                </div>
              </div>
            </div>
          </article>
        </aside>
      </section>
    </div>
  )
}
