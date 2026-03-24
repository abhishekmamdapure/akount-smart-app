import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import WorkspaceIcon from '../../WorkspaceIcon'
import workspaceStyles from '../../Workspace.module.css'
import ClientSelectionDropdown from '../shared/ClientSelectionDropdown'
import styles from '../shared/Tools.module.css'
import { useWorkspaceToolClient } from '../shared/toolClientState'
import {
  createGstHistoryEntry,
  fetchGstHistory,
  markGstHistoryCompleted,
  markGstHistoryFailed,
  processGstFiles,
  uploadGstSourceFiles,
} from './gstReconciliationService'

const DEFAULT_TYPE = 'gst_2b'
const DEFAULT_TOLERANCE = 10
const SUPPORTED_EXTENSIONS = ['.xlsx', '.xls']
const SUPPORTED_MIME_TYPES = new Set([
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

const GST_TYPE_CONTENT = Object.freeze({
  gst_2b: {
    description: 'Match purchase register against GSTR-2B.',
    gstFieldLabel: 'GSTR-2B (Excel)',
    optionCopy: 'Supplier ITC matching and mismatch review.',
    optionLabel: '2B',
  },
  gst_4a: {
    description: 'Match purchase register against GSTR-4A.',
    gstFieldLabel: 'GSTR-4A (Excel)',
    optionCopy: 'Composition credit review and filing support.',
    optionLabel: '4A',
  },
})

function joinClasses(...values) {
  return values.filter(Boolean).join(' ')
}

function InfoTooltip({ text }) {
  function handlePointerEvent(event) {
    event.preventDefault()
    event.stopPropagation()
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
    }
  }

  return (
    <span className={styles.gstMinimalInfoWrap}>
      <span
        aria-label={text}
        className={styles.gstMinimalInfoDot}
        onClick={handlePointerEvent}
        onKeyDown={handleKeyDown}
        onMouseDown={handlePointerEvent}
        role="button"
        tabIndex={0}
      >
        i
      </span>
      <span className={styles.gstMinimalInfoPopup} role="tooltip">
        {text}
      </span>
    </span>
  )
}

function buildEmptyDraft() {
  return {
    gstFile: null,
    ignoreDecimal: false,
    processError: '',
    purchaseFile: null,
    result: null,
    tolerance: DEFAULT_TOLERANCE,
  }
}

function buildDraftMap() {
  return {
    gst_2b: buildEmptyDraft(),
    gst_4a: buildEmptyDraft(),
  }
}

function getTypeFromSearch(search) {
  const params = new URLSearchParams(search)
  const rawType = String(params.get('type') || '').trim().toLowerCase()

  if (rawType === '4a' || rawType === 'gst_4a') {
    return 'gst_4a'
  }

  return DEFAULT_TYPE
}

function getTypeQueryValue(type) {
  return type === 'gst_4a' ? '4a' : '2b'
}

function formatTypeLabel(type) {
  return type === 'gst_4a' ? '4A' : '2B'
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

function formatHistoryStatusLabel(status) {
  if (status === 'completed') {
    return 'Completed'
  }

  if (status === 'failed') {
    return 'Failed'
  }

  return 'Processing'
}

function normalizeTolerance(value) {
  const cleaned = String(value || '').replace(/[^\d.]/g, '')
  const numericValue = Number(cleaned)

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0
  }

  return numericValue
}

function formatToleranceValue(value) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return '0.00'
  }

  return numericValue.toFixed(2)
}

function clampTolerance(value) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return DEFAULT_TOLERANCE
  }

  return Math.min(999999, Math.max(0, numericValue))
}

function buildOptimisticHistoryEntry({ clientName, gstFileName, purchaseFileName, type }) {
  return {
    clientName,
    createdAt: new Date().toISOString(),
    downloadHref: '',
    errorMessage: '',
    gstFileDownloadHref: '',
    gstFileName,
    id: `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ignoreDecimal: false,
    processingTimeSec: null,
    purchaseDownloadHref: '',
    purchaseFileName,
    resultFileName: '',
    status: 'processing',
    tolerance: DEFAULT_TOLERANCE,
    type,
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

function getHistoryEmptyState({ historyError, historyStatus, selectedClient }) {
  if (!selectedClient) {
    return 'Select a client to check history for GST reconciliation runs.'
  }

  if (historyStatus === 'loading') {
    return 'Loading GST reconciliation history...'
  }

  if (historyError) {
    return historyError
  }

  return 'No GST reconciliation runs yet for this client.'
}

function isSpreadsheetFile(file) {
  if (!file) {
    return false
  }

  const fileName = String(file.name || '').toLowerCase()
  const hasSupportedExtension = SUPPORTED_EXTENSIONS.some((extension) => fileName.endsWith(extension))

  if (hasSupportedExtension) {
    return true
  }

  return SUPPORTED_MIME_TYPES.has(String(file.type || '').toLowerCase())
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

function renderHistoryFileCell({ href, name }) {
  const fileName = String(name || '-')
  const content = (
    <span className={styles.gstMinimalHistoryFileText} title={fileName}>
      {fileName}
    </span>
  )

  if (!href) {
    return content
  }

  return (
    <a
      className={joinClasses(styles.tallyHistoryFileLink, styles.gstMinimalHistoryFileLink)}
      href={href}
      rel="noreferrer"
      target="_blank"
      title={fileName}
    >
      {content}
    </a>
  )
}

export default function GstReconciliationPage() {
  const location = useLocation()
  const navigate = useNavigate()
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

  const purchaseInputRef = useRef(null)
  const gstInputRef = useRef(null)
  const historyRequestRef = useRef(0)
  const selectedClientIdRef = useRef(String(selectedClient?.id || ''))

  const [drafts, setDrafts] = useState(buildDraftMap)
  const [history, setHistory] = useState([])
  const [historyError, setHistoryError] = useState('')
  const [historyStatus, setHistoryStatus] = useState('idle')
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeDropzone, setActiveDropzone] = useState('')

  const activeType = getTypeFromSearch(location.search)
  const activeDraft = drafts[activeType] || buildEmptyDraft()
  const activeTypeContent = GST_TYPE_CONTENT[activeType]

  useEffect(() => {
    selectedClientIdRef.current = String(selectedClient?.id || '')
  }, [selectedClient?.id])

  useEffect(() => {
    setActiveDropzone('')
  }, [activeType])

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

    fetchGstHistory({
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
        setHistoryError(error.message || 'Unable to load GST reconciliation history.')
        setHistoryStatus('error')
      })
  }, [authReady, currentUser?.email, currentUser?.id, selectedClient?.id])

  function resetDraftState() {
    setDrafts(buildDraftMap())
    setActiveDropzone('')

    if (purchaseInputRef.current) {
      purchaseInputRef.current.value = ''
    }

    if (gstInputRef.current) {
      gstInputRef.current.value = ''
    }
  }

  function updateVisibleHistory(targetClientId, updater) {
    if (selectedClientIdRef.current !== String(targetClientId)) {
      return
    }

    setHistory(updater)
  }

  function updateDraft(type, updater) {
    setDrafts((current) => ({
      ...current,
      [type]: updater(current[type] || buildEmptyDraft()),
    }))
  }

  function handleClientChange(clientId) {
    const nextClientId = String(clientId)
    const currentClientId = String(selectedClient?.id || '')

    if (nextClientId !== currentClientId) {
      resetDraftState()
    }

    handleSelectClient(clientId)
  }

  function handleTypeChange(nextType) {
    if (isProcessing || nextType === activeType) {
      return
    }

    const params = new URLSearchParams(location.search)
    params.set('type', getTypeQueryValue(nextType))

    navigate(
      {
        pathname: location.pathname,
        search: `?${params.toString()}`,
      },
      { replace: true },
    )
  }

  function handleFilesSelected(fileList, target) {
    const selectedFile = fileList?.[0]

    if (!selectedFile) {
      return
    }

    if (!isSpreadsheetFile(selectedFile)) {
      updateDraft(activeType, (current) => ({
        ...current,
        processError: 'Only XLSX and XLS files are supported for GST reconciliation.',
        result: null,
      }))
      return
    }

    updateDraft(activeType, (current) => ({
      ...current,
      [target]: selectedFile,
      processError: '',
      result: null,
    }))
  }

  function handleDrop(event, target) {
    event.preventDefault()
    event.stopPropagation()
    setActiveDropzone('')

    if (!selectedClient || isProcessing) {
      return
    }

    handleFilesSelected(event.dataTransfer?.files, target)
  }

  function handleBrowseClick(target) {
    if (!selectedClient || isProcessing) {
      return
    }

    if (target === 'purchaseFile') {
      purchaseInputRef.current?.click()
      return
    }

    gstInputRef.current?.click()
  }

  function handleClearFile(target) {
    updateDraft(activeType, (current) => ({
      ...current,
      [target]: null,
      processError: '',
      result: null,
    }))

    if (target === 'purchaseFile' && purchaseInputRef.current) {
      purchaseInputRef.current.value = ''
    }

    if (target === 'gstFile' && gstInputRef.current) {
      gstInputRef.current.value = ''
    }
  }

  function handleToleranceChange(value) {
    updateDraft(activeType, (current) => ({
      ...current,
      processError: '',
      result: null,
      tolerance: clampTolerance(normalizeTolerance(value)),
    }))
  }

  async function handleProcess() {
    if (!currentUser?.id || !currentUser?.email) {
      updateDraft(activeType, (current) => ({
        ...current,
        processError: 'No signed-in user was found. Please sign in again.',
      }))
      return
    }

    if (!selectedClient) {
      updateDraft(activeType, (current) => ({
        ...current,
        processError: 'Choose a client before starting GST reconciliation.',
      }))
      return
    }

    if (!activeDraft.purchaseFile || !activeDraft.gstFile) {
      updateDraft(activeType, (current) => ({
        ...current,
        processError: 'Upload both Excel files before running GST reconciliation.',
      }))
      return
    }

    const currentType = activeType
    const activeClient = selectedClient
    const draftSnapshot = {
      gstFile: activeDraft.gstFile,
      ignoreDecimal: activeDraft.ignoreDecimal,
      purchaseFile: activeDraft.purchaseFile,
      tolerance: activeDraft.tolerance,
    }
    const optimisticEntry = buildOptimisticHistoryEntry({
      clientName: activeClient.name,
      gstFileName: draftSnapshot.gstFile.name,
      purchaseFileName: draftSnapshot.purchaseFile.name,
      type: currentType,
    })
    let persistedEntryId = ''

    historyRequestRef.current += 1
    setIsProcessing(true)
    setHistoryError('')
    setHistoryStatus('ready')
    updateDraft(currentType, (current) => ({
      ...current,
      processError: '',
      result: null,
    }))
    updateVisibleHistory(activeClient.id, (current) => [optimisticEntry, ...current])

    try {
      const createdEntry = await createGstHistoryEntry({
        currentUser,
        draft: draftSnapshot,
        selectedClient: activeClient,
        type: currentType,
      })

      persistedEntryId = createdEntry.entry.id
      updateVisibleHistory(activeClient.id, (current) =>
        replaceHistoryEntry(current, [optimisticEntry.id], createdEntry.entry),
      )

      await uploadGstSourceFiles({
        draft: draftSnapshot,
        gstUpload: createdEntry.gstUpload,
        purchaseUpload: createdEntry.purchaseUpload,
      })

      const nextResult = await processGstFiles({
        draft: draftSnapshot,
        selectedClient: activeClient,
        type: currentType,
      })
      const completedEntry = await markGstHistoryCompleted({
        currentUser,
        entryId: persistedEntryId,
        result: nextResult,
      })

      updateDraft(currentType, (current) => ({
        ...current,
        gstFile: null,
        purchaseFile: null,
        processError: '',
        result: {
          ...nextResult,
          downloadHref: completedEntry.downloadHref || nextResult.downloadHref || '',
          processingTimeSec: completedEntry.processingTimeSec ?? nextResult.processingTimeSec ?? null,
        },
      }))
      setActiveDropzone('')
      if (purchaseInputRef.current) {
        purchaseInputRef.current.value = ''
      }
      if (gstInputRef.current) {
        gstInputRef.current.value = ''
      }
      updateVisibleHistory(activeClient.id, (current) =>
        replaceHistoryEntry(current, [optimisticEntry.id, persistedEntryId], completedEntry),
      )
    } catch (error) {
      const message = error.message || 'Unable to complete GST reconciliation.'

      updateDraft(currentType, (current) => ({
        ...current,
        processError: message,
      }))

      if (persistedEntryId) {
        try {
          const failedEntry = await markGstHistoryFailed({
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

  function handleDownloadCurrentResult() {
    if (!activeDraft.result?.downloadHref) {
      return
    }

    triggerDownload(activeDraft.result.downloadHref)
  }

  const hasBothFiles = Boolean(activeDraft.purchaseFile && activeDraft.gstFile)
  const processingEnabled = Boolean(selectedClient && hasBothFiles && !isProcessing)
  const statusTone = activeDraft.processError
    ? 'warning'
    : isProcessing
      ? 'processing'
      : activeDraft.result
        ? 'success'
        : selectedClient && hasBothFiles
          ? 'ready'
          : 'idle'
  const statusTitle = activeDraft.processError
    ? 'Reconciliation needs attention'
    : isProcessing
      ? `Running ${formatTypeLabel(activeType)} reconciliation`
      : activeDraft.result
        ? 'Reconciliation complete'
        : processingEnabled
          ? 'Ready to reconcile'
          : selectedClient
            ? 'Attach both Excel files'
            : 'Choose a client first'
  const statusMessage = activeDraft.processError
    ? activeDraft.processError
    : isProcessing
      ? `A ${formatTypeLabel(activeType)} history entry has been created. The table row will update when matching and storage complete.`
      : activeDraft.result?.message ||
      (selectedClient
        ? hasBothFiles
          ? `${activeDraft.purchaseFile.name} and ${activeDraft.gstFile.name} are ready for ${formatTypeLabel(activeType)} reconciliation.`
          : `Upload the purchase register and ${activeTypeContent.gstFieldLabel.toLowerCase()} to continue.`
        : 'Select a client to enable upload and processing.')
  const historyEmptyState = getHistoryEmptyState({
    historyError,
    historyStatus,
    selectedClient,
  })

  return (
    <div className={joinClasses(workspaceStyles.page, styles.toolPage, styles.invoicePage, styles.gstMinimalPage)}>
      <section className={joinClasses(styles.invoiceTopbar, styles.gstMinimalHeader)}>
        <h1 className={joinClasses(styles.invoicePageTitle, styles.gstMinimalTitle)}>GST Reconciliation</h1>

        <div className={joinClasses(styles.invoiceClientSlot, styles.gstMinimalClientSlot)}>
          <ClientSelectionDropdown
            clients={clients}
            compact
            errorMessage={errorMessage}
            filteredClients={filteredClients}
            menuAlign="end"
            onCreateClient={openClientModal}
            onQueryChange={setQuery}
            onRetry={reloadClients}
            onSelectClient={handleClientChange}
            query={query}
            selectedClient={selectedClient}
            status={status}
          />
        </div>
      </section>

      <div className={styles.gstMinimalCanvas}>
        <section className={styles.gstMinimalControlsCard}>
          <div className={joinClasses(styles.invoiceSectionLabel, styles.gstMinimalSectionLabel)}>
            Reconciliation Type & Matching Controls
          </div>

          <div className={styles.gstMinimalControlsRow}>
            <div className={joinClasses(styles.gstMinimalControlsSegment, styles.gstMinimalControlsSegmentType)}>
              <div className={styles.gstMinimalRadioGroup}>
                {Object.entries(GST_TYPE_CONTENT).map(([type, content]) => {
                  const isActive = activeType === type

                  return (
                    <label
                      className={joinClasses(
                        styles.gstMinimalRadioOption,
                        isActive && styles.gstMinimalRadioOptionActive,
                      )}
                      key={type}
                    >
                      <input
                        checked={isActive}
                        className={styles.gstMinimalRadioInput}
                        disabled={isProcessing}
                        name="gst-reconciliation-type"
                        onChange={() => handleTypeChange(type)}
                        type="radio"
                      />
                      <span
                        className={joinClasses(
                          styles.gstMinimalRadioIndicator,
                          isActive && styles.gstMinimalRadioIndicatorActive,
                        )}
                      >
                        <span className={styles.gstMinimalRadioIndicatorInner} />
                      </span>
                      <span className={styles.gstMinimalRadioText}>{content.gstFieldLabel.replace(' (Excel)', '')}</span>
                      <InfoTooltip text={content.optionCopy} />
                    </label>
                  )
                })}
              </div>
            </div>

            <div className={styles.gstMinimalControlsSegment}>
              <div className={styles.gstMinimalControlItem}>
                <div className={styles.gstMinimalControlLabel}>
                  <span>Ignore Decimal</span>
                  <InfoTooltip text="Toggle decimal-insensitive matching for tighter invoice grouping." />
                </div>
                <button
                  aria-pressed={activeDraft.ignoreDecimal}
                  className={joinClasses(
                    styles.gstMinimalSwitch,
                    activeDraft.ignoreDecimal && styles.gstMinimalSwitchActive,
                  )}
                  disabled={isProcessing}
                  onClick={() =>
                    updateDraft(activeType, (current) => ({
                      ...current,
                      ignoreDecimal: !current.ignoreDecimal,
                      processError: '',
                      result: null,
                    }))
                  }
                  type="button"
                >
                  <span className={styles.gstMinimalSwitchTrack}>
                    <span className={styles.gstMinimalSwitchThumb} />
                  </span>
                </button>
              </div>
            </div>

            <div className={styles.gstMinimalControlsSegment}>
              <div className={styles.gstMinimalControlItem}>
                <div className={styles.gstMinimalControlLabel}>
                  <span>Amount Tolerance</span>
                  <InfoTooltip text="Keep this small for cleaner matches. Default is 10." />
                </div>
                <div className={styles.gstMinimalStepperWrap}>
                  <button
                    aria-label="Decrease amount tolerance"
                    className={styles.gstMinimalStepperButton}
                    disabled={isProcessing}
                    onClick={() => handleToleranceChange(Number(activeDraft.tolerance || 0) - 1)}
                    type="button"
                  >
                    -
                  </button>
                  <input
                    className={styles.gstMinimalToleranceInput}
                    disabled={isProcessing}
                    onChange={(event) => handleToleranceChange(event.target.value)}
                    type="text"
                    value={formatToleranceValue(activeDraft.tolerance)}
                  />
                  <button
                    aria-label="Increase amount tolerance"
                    className={styles.gstMinimalStepperButton}
                    disabled={isProcessing}
                    onClick={() => handleToleranceChange(Number(activeDraft.tolerance || 0) + 1)}
                    type="button"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.gstMinimalSourceGrid}>
          <div
            className={joinClasses(
              styles.gstMinimalUploadCard,
              activeDropzone === 'purchaseFile' && styles.gstMinimalUploadCardActive,
              !selectedClient && styles.gstMinimalUploadCardDisabled,
            )}
            onClick={() => handleBrowseClick('purchaseFile')}
            onDragEnter={(event) => {
              event.preventDefault()
              if (selectedClient && !isProcessing) {
                setActiveDropzone('purchaseFile')
              }
            }}
            onDragLeave={(event) => {
              event.preventDefault()
              if (activeDropzone === 'purchaseFile') {
                setActiveDropzone('')
              }
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleDrop(event, 'purchaseFile')}
            role="presentation"
          >
            <span className={styles.gstMinimalUploadIcon}>
              <WorkspaceIcon name="upload" size={24} />
            </span>
            {activeDraft.purchaseFile ? (
              <button
                aria-label="Clear purchase register"
                className={styles.tallyUploadClearButton}
                disabled={isProcessing}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  handleClearFile('purchaseFile')
                }}
                type="button"
              >
                <WorkspaceIcon name="close" size={14} />
              </button>
            ) : null}
            <div className={styles.gstMinimalUploadTitle}>Purchase Register (Excel)</div>
            <p className={styles.gstMinimalUploadCopy}>
              {selectedClient
                ? activeDraft.purchaseFile
                  ? activeDraft.purchaseFile.name
                  : 'Drag and drop or browse to attach the purchase register.'
                : 'Select a client first to unlock upload.'}
            </p>
            <div className={styles.gstMinimalUploadMeta}>XLSX / XLS</div>
            <input
              accept=".xlsx,.xls"
              key={`${activeType}-purchase`}
              onChange={(event) => handleFilesSelected(event.target.files, 'purchaseFile')}
              ref={purchaseInputRef}
              style={{ display: 'none' }}
              type="file"
            />
          </div>

          <div
            className={joinClasses(
              styles.gstMinimalUploadCard,
              activeDropzone === 'gstFile' && styles.gstMinimalUploadCardActive,
              !selectedClient && styles.gstMinimalUploadCardDisabled,
            )}
            onClick={() => handleBrowseClick('gstFile')}
            onDragEnter={(event) => {
              event.preventDefault()
              if (selectedClient && !isProcessing) {
                setActiveDropzone('gstFile')
              }
            }}
            onDragLeave={(event) => {
              event.preventDefault()
              if (activeDropzone === 'gstFile') {
                setActiveDropzone('')
              }
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleDrop(event, 'gstFile')}
            role="presentation"
          >
            <span className={styles.gstMinimalUploadIcon}>
              <WorkspaceIcon name="upload" size={24} />
            </span>
            {activeDraft.gstFile ? (
              <button
                aria-label="Clear GST file"
                className={styles.tallyUploadClearButton}
                disabled={isProcessing}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  handleClearFile('gstFile')
                }}
                type="button"
              >
                <WorkspaceIcon name="close" size={14} />
              </button>
            ) : null}
            <div className={styles.gstMinimalUploadTitle}>{activeTypeContent.gstFieldLabel}</div>
            <p className={styles.gstMinimalUploadCopy}>
              {selectedClient
                ? activeDraft.gstFile
                  ? activeDraft.gstFile.name
                  : `Drag and drop or browse to attach the ${activeTypeContent.gstFieldLabel.replace(' (Excel)', '')} file.`
                : 'Select a client first to unlock upload.'}
            </p>
            <div className={styles.gstMinimalUploadMeta}>XLSX / XLS</div>
            <input
              accept=".xlsx,.xls"
              key={`${activeType}-gst`}
              onChange={(event) => handleFilesSelected(event.target.files, 'gstFile')}
              ref={gstInputRef}
              style={{ display: 'none' }}
              type="file"
            />
          </div>

          <aside className={styles.gstMinimalStatusCard}>
            <div className={joinClasses(styles.invoiceSectionLabel, styles.gstMinimalSectionLabel)}>File Status</div>
            <div className={styles.gstMinimalStatusBlock}>
              <span
                className={joinClasses(
                  styles.invoiceStatusDot,
                  statusTone === 'processing' && styles.invoiceStatusDotProcessing,
                  statusTone === 'success' && styles.invoiceStatusDotSuccess,
                  statusTone === 'warning' && styles.invoiceStatusDotWarning,
                  statusTone === 'ready' && styles.invoiceStatusDotReady,
                )}
              />
              <div className={styles.gstMinimalStatusCopy}>
                <strong>{statusTitle}</strong>
                <span>{statusMessage}</span>
              </div>
            </div>
            <div className={styles.gstMinimalActionStack}>
              <button
                className={joinClasses(styles.invoicePrimaryButton, styles.gstMinimalPrimaryButton)}
                disabled={!processingEnabled}
                onClick={handleProcess}
                type="button"
              >
                {isProcessing ? 'Running reconciliation...' : 'Run reconciliation'}
              </button>
              {activeDraft.result?.downloadHref ? (
                <button
                  className={joinClasses(styles.invoiceSecondaryButton, styles.gstMinimalSecondaryButton)}
                  disabled={isProcessing}
                  onClick={handleDownloadCurrentResult}
                  type="button"
                >
                  Download result
                </button>
              ) : null}
            </div>
          </aside>
        </section>

        <section className={styles.gstMinimalUnmatchedCard}>
          <div className={styles.invoiceHistoryHeader}>
            <h2 className={styles.gstMinimalHistoryHeader}>Unmatched rows</h2>
          </div>
          <div className={styles.gstMinimalUnmatchedBody} />
        </section>

        <section className={styles.gstMinimalHistoryCard}>
          <div className={styles.invoiceHistoryHeader}>
            <h2 className={styles.gstMinimalHistoryHeader}>File history</h2>
          </div>

          <div className={styles.invoiceHistoryTableWrap}>
            <table className={styles.invoiceHistoryTable}>
              <thead>
                <tr>
                  <th>Purchase file</th>
                  <th>GST file</th>
                  <th>Client</th>
                  <th>Type</th>
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
                      <td className={styles.gstMinimalHistoryFileCell}>
                        {renderHistoryFileCell({
                          href: item.purchaseDownloadHref,
                          name: item.purchaseFileName,
                        })}
                      </td>
                      <td className={styles.gstMinimalHistoryFileCell}>
                        {renderHistoryFileCell({
                          href: item.gstFileDownloadHref,
                          name: item.gstFileName,
                        })}
                      </td>
                      <td>{item.clientName}</td>
                      <td>{formatTypeLabel(item.type)}</td>
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
                      <td className={styles.gstMinimalHistoryFileCell}>
                        {item.downloadHref
                          ? renderHistoryFileCell({
                            href: item.downloadHref,
                            name: item.resultFileName || 'gst-reconciliation.xlsx',
                          })
                          : '-'}
                      </td>
                      <td>{formatProcessingTime(item.processingTimeSec)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className={styles.invoiceHistoryEmpty} colSpan={8}>
                      {historyEmptyState}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
