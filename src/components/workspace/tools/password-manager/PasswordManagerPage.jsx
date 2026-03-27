import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import WorkspaceIcon from '../../WorkspaceIcon'
import workspaceStyles from '../../Workspace.module.css'
import { getClientAvatarTone, getClientInitials } from '../../clientManagementHelpers'
import sharedStyles from '../shared/Tools.module.css'
import ToolClientSelector from '../shared/ToolClientSelector'
import { useWorkspaceToolClient } from '../shared/toolClientState'
import { workspaceRoutes } from '../../../../workspaceRoutes'
import CustomSectionTitleEditor from './CustomSectionTitleEditor'
import styles from './PasswordManagerPage.module.css'
import {
  GST_PORTAL_WEBSITE,
  INCOME_TAX_WEBSITE,
  MAX_CUSTOM_SECTIONS,
  REVEAL_TTL_MS,
} from './passwordManagerConstants'
import {
  addCustomSection,
  buildSectionOrder,
  buildVaultPayload,
  buildVaultTabs,
  createVaultFormState,
  removeOptionalSection,
  updateCustomSection,
} from './passwordManagerHelpers'
import {
  createPasswordVault,
  deletePasswordVault,
  fetchPasswordVault,
  getCachedPasswordVault,
  revealPasswordField,
  updatePasswordVault,
} from './passwordManagerService'

function joinClasses(...values) {
  return values.filter(Boolean).join(' ')
}

function formatDateTime(value) {
  if (!value) {
    return 'Not created yet'
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function getInitials(name) {
  return getClientInitials(name)
}

function getTabAccentColor(tabKey) {
  if (tabKey.startsWith('custom:')) {
    return '#6f8097'
  }

  return (
    {
      basic: '#4a90d9',
      einvoice: '#e53e94',
      epf: '#1ea88a',
      eway: '#e67e22',
      gst: '#8e44ad',
      it: '#2f855a',
    }[tabKey] || '#4a90d9'
  )
}

function copyText(value) {
  if (!navigator.clipboard?.writeText) {
    return Promise.resolve()
  }

  return navigator.clipboard.writeText(value).catch(() => { })
}

function buildWebsiteHref(value) {
  const normalizedValue = String(value || '').trim()

  if (!normalizedValue || normalizedValue === 'Not set') {
    return ''
  }

  if (/^https?:\/\//i.test(normalizedValue)) {
    return normalizedValue
  }

  return `https://${normalizedValue}`
}

function getOptionalSectionCount(vault) {
  if (!vault) {
    return 0
  }

  return buildSectionOrder(vault.sectionOrder, vault.customSections, vault).length
}

function StatePanel({ actions = null, description, title }) {
  return (
    <section className={joinClasses(workspaceStyles.panel, styles.statePanel)}>
      <span className={styles.stateIcon}>
        <WorkspaceIcon name="password" size={18} />
      </span>
      <div className={styles.stateCopy}>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {actions ? <div className={styles.stateActions}>{actions}</div> : null}
    </section>
  )
}

function InfoChip({ label, value }) {
  return (
    <div className={styles.infoChip}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function EmptyVaultPanel({ onCreate, selectedClient }) {
  return (
    <section className={joinClasses(workspaceStyles.panel, styles.emptyPanel)}>
      <div className={styles.emptyPanelCopy}>
        <p className={workspaceStyles.eyebrow}>Selected client</p>
        <h2>{selectedClient.name}</h2>
        <p>
          No credential vault exists yet for this client. Create the first vault to capture Income Tax,
          GST, optional portals, and custom access tabs in one place.
        </p>
      </div>

      <div className={styles.emptyMetaGrid}>
        <InfoChip label="GST" value={selectedClient.gst || 'Not set'} />
        <InfoChip label="PAN" value={selectedClient.pan || 'Not set'} />
        <InfoChip label="Email" value={selectedClient.email || 'Not set'} />
        <InfoChip label="Phone" value={selectedClient.phone || 'Not set'} />
      </div>

      <div className={styles.emptyActions}>
        <button className={workspaceStyles.gradientButton} onClick={onCreate} type="button">
          <WorkspaceIcon name="plus" size={16} />
          <span>Create Vault</span>
        </button>
      </div>
    </section>
  )
}

function SectionHeader({ description, title }) {
  return (
    <div className={styles.sectionHeader}>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  )
}

function FieldGrid({ children }) {
  return <div className={styles.fieldStack}>{children}</div>
}

function ValueField({ copyable = false, href = '', label, mono = false, value }) {
  const [copied, setCopied] = useState(false)
  const canCopy = copyable && value && value !== 'Not set'
  const canOpenHref = Boolean(href)

  async function handleCopy() {
    if (!canCopy) {
      return
    }

    await copyText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  function handleOpenHref() {
    if (!canOpenHref) {
      return
    }

    window.open(href, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className={styles.fieldRow}>
      <div className={styles.fieldLabel}>{label}</div>
      <div className={styles.fieldValueRow}>
        {canCopy ? (
          <button
            className={joinClasses(styles.fieldValue, styles.fieldValueButton, mono && styles.fieldValueMono)}
            onClick={handleCopy}
            title="Click to copy"
            type="button"
          >
            <span className={styles.fieldValueText}>{value}</span>
            {copied ? <span className={styles.fieldCopiedHint}>Copied</span> : null}
          </button>
        ) : (
          <div className={joinClasses(styles.fieldValue, mono && styles.fieldValueMono)}>{value}</div>
        )}
        {canOpenHref ? (
          <button
            aria-label={`Open ${label}`}
            className={styles.fieldLinkButton}
            onClick={handleOpenHref}
            title="Open in new tab"
            type="button"
          >
            <WorkspaceIcon name="arrowUpRight" size={16} />
          </button>
        ) : null}
      </div>
    </div>
  )
}

function SecretField({ loading, onCopy, onToggleReveal, revealed, value }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    if (!revealed) {
      return
    }

    await onCopy()
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className={styles.fieldRow}>
      <div className={styles.fieldLabel}>Password</div>
      <div className={styles.fieldValueRow}>
        {revealed ? (
          <button
            className={joinClasses(styles.fieldValue, styles.fieldValueButton, styles.fieldValueMono)}
            onClick={handleCopy}
            title="Click to copy"
            type="button"
          >
            <span className={styles.fieldValueText}>{value}</span>
            {copied ? <span className={styles.fieldCopiedHint}>Copied</span> : null}
          </button>
        ) : (
          <div className={joinClasses(styles.fieldValue, styles.fieldValueMono)}>**********</div>
        )}
        <button
          aria-label={revealed ? 'Hide password' : 'Reveal password'}
          className={styles.secretToggleButton}
          disabled={loading}
          onClick={onToggleReveal}
          type="button"
        >
          <WorkspaceIcon name={revealed ? 'eyeOff' : 'eye'} size={18} />
        </button>
      </div>
    </div>
  )
}

function VaultDetail({
  activeTab,
  onDelete,
  onEdit,
  onReveal,
  onTabChange,
  revealLoadingKey,
  revealedSecret,
  selectedClient,
  tabs,
  vault,
}) {
  const customSections = Array.isArray(vault.customSections) ? vault.customSections : []
  const customSectionMap = new Map(customSections.map((section) => [section.id, section]))

  function renderActiveSection() {
    if (activeTab === 'basic') {
      return (
        <>
          <SectionHeader
            title="Client Info"
          />
          <div className={styles.clientInfoGrid}>
            <div className={styles.clientInfoColumn}>
              <ValueField copyable label="Client name" value={selectedClient.name || 'Not set'} />
              <ValueField copyable label="PAN number" mono value={selectedClient.pan || 'Not set'} />
              <ValueField copyable label="GST number" mono value={selectedClient.gst || 'Not set'} />
            </div>
            <div className={styles.clientInfoColumn}>
              <ValueField copyable label="Trade name" value={selectedClient.tradeName || 'Not set'} />
              <ValueField copyable label="Email" value={selectedClient.email || 'Not set'} />
              <ValueField copyable label="Phone" mono value={selectedClient.phone || 'Not set'} />
            </div>
          </div>
        </>
      )
    }

    if (activeTab === 'it') {
      return (
        <>
          <SectionHeader title="Income Tax" />
          <FieldGrid>
            <ValueField
              copyable
              href={buildWebsiteHref(vault.it.website || INCOME_TAX_WEBSITE)}
              label="Website"
              value={vault.it.website || INCOME_TAX_WEBSITE}
            />
            <ValueField copyable label="Income Tax login ID" mono value={vault.it.loginId || 'Not set'} />
            <SecretField
              loading={revealLoadingKey === 'it'}
              onCopy={() => copyText(revealedSecret.value)}
              onToggleReveal={() => onReveal('it')}
              revealed={revealedSecret.key === 'it'}
              value={revealedSecret.key === 'it' ? revealedSecret.value : ''}
            />
          </FieldGrid>
        </>
      )
    }

    if (activeTab === 'gst') {
      return (
        <>
          <SectionHeader title="GST Portal" />
          <FieldGrid>
            <ValueField
              copyable
              href={buildWebsiteHref(vault.gst.website || GST_PORTAL_WEBSITE)}
              label="Website"
              value={vault.gst.website || GST_PORTAL_WEBSITE}
            />
            <ValueField copyable label="GST login ID" mono value={vault.gst.loginId || 'Not set'} />
            <SecretField
              loading={revealLoadingKey === 'gst'}
              onCopy={() => copyText(revealedSecret.value)}
              onToggleReveal={() => onReveal('gst')}
              revealed={revealedSecret.key === 'gst'}
              value={revealedSecret.key === 'gst' ? revealedSecret.value : ''}
            />
          </FieldGrid>
        </>
      )
    }

    const [, customSectionId] = activeTab.split(':')
    const customSection = customSectionMap.get(customSectionId)

    if (!customSection) {
      return null
    }

    const customRevealKey = `custom:${customSection.id}`

      return (
        <>
          <SectionHeader title={customSection.label} />
          <FieldGrid>
            <ValueField
              copyable
              href={buildWebsiteHref(customSection.website)}
              label="Website"
            value={customSection.website || 'Not set'}
          />
          <ValueField copyable label="Username" mono value={customSection.username || 'Not set'} />
          <SecretField
            loading={revealLoadingKey === customRevealKey}
            onCopy={() => copyText(revealedSecret.value)}
            onToggleReveal={() => onReveal('custom', customSection.id)}
            revealed={revealedSecret.key === customRevealKey}
            value={revealedSecret.key === customRevealKey ? revealedSecret.value : ''}
          />
        </FieldGrid>
      </>
    )
  }

  return (
    <section className={joinClasses(workspaceStyles.panel, styles.detailShell)}>

      <div className={styles.detailFrame}>
        <aside className={styles.tabRail}>
          {tabs.map((tab) => (
            <button
              className={joinClasses(styles.tabButton, activeTab === tab.key && styles.tabButtonActive)}
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              type="button"
            >
              <span className={styles.tabButtonContent}>
                <span
                  className={styles.tabDot}
                  style={{ backgroundColor: getTabAccentColor(tab.key) }}
                />
                <span>{tab.label}</span>
              </span>
            </button>
          ))}
        </aside>

        <div className={styles.detailContent}>
          <article className={styles.sectionCard}>{renderActiveSection()}</article>
        </div>
      </div>
    </section>
  )
}

function EditorInputField({
  label,
  mono = false,
  onChange,
  placeholder = '',
  readOnly = false,
  type = 'text',
  value,
  wide = false,
}) {
  return (
    <div className={joinClasses(styles.editorFormField, wide && styles.editorFieldWide)}>
      <span className={styles.editorFormLabel}>{label}</span>
      <input
        className={joinClasses(
          workspaceStyles.fieldInput,
          styles.editorInput,
          mono && styles.editorInputMono,
          readOnly && styles.editorInputReadonly,
        )}
        onChange={onChange}
        placeholder={placeholder}
        readOnly={readOnly}
        type={type}
        value={value}
      />
    </div>
  )
}

function EditorPasswordField({ label, onChange, placeholder, value, visible, onToggle }) {
  return (
    <div className={joinClasses(styles.editorFormField, styles.editorFieldWide)}>
      <span className={styles.editorFormLabel}>{label}</span>
      <div className={styles.editorPasswordShell}>
        <input
          className={joinClasses(
            workspaceStyles.fieldInput,
            styles.editorInput,
            styles.editorInputMono,
            styles.editorPasswordInput,
          )}
          onChange={onChange}
          placeholder={placeholder}
          type={visible ? 'text' : 'password'}
          value={value}
        />
        <button
          aria-label={visible ? 'Hide password input' : 'Show password input'}
          className={styles.editorPasswordToggle}
          onClick={onToggle}
          type="button"
        >
          <WorkspaceIcon name={visible ? 'eyeOff' : 'eye'} size={18} />
        </button>
      </div>
    </div>
  )
}

function getEditorSectionMeta(activeSection, customSection) {
  if (activeSection === 'basic') {
    return {
      title: 'Vault Configuration',
    }
  }

  if (activeSection === 'it') {
    return {
      title: 'Income Tax Credentials',
    }
  }

  if (activeSection === 'gst') {
    return {
      title: 'GST Portal Credentials',
    }
  }

  return {
    title: customSection?.label || 'Custom Section',
  }
}

function VaultEditorModal({ onClose, onSave, saving, selectedClient, submitError, vault }) {
  const [activeSection, setActiveSection] = useState('basic')
  const [draft, setDraft] = useState(() => createVaultFormState(vault))
  const [editorPasswordVisible, setEditorPasswordVisible] = useState(false)
  const [isEditingCustomSectionTitle, setIsEditingCustomSectionTitle] = useState(false)
  const [newCustomLabel, setNewCustomLabel] = useState('')
  const [showAddPanel, setShowAddPanel] = useState(false)

  useEffect(() => {
    setDraft(createVaultFormState(vault))
    setActiveSection('basic')
    setEditorPasswordVisible(false)
    setIsEditingCustomSectionTitle(false)
    setNewCustomLabel('')
    setShowAddPanel(false)
  }, [vault])

  useEffect(() => {
    setEditorPasswordVisible(false)
    setIsEditingCustomSectionTitle(false)
  }, [activeSection])

  const tabs = useMemo(() => buildVaultTabs(draft), [draft])
  const canAddCustomSection = draft.customSections.length < MAX_CUSTOM_SECTIONS
  const activeCustomSection = useMemo(() => {
    if (!activeSection.startsWith('custom:')) {
      return null
    }

    const [, customSectionId] = activeSection.split(':')
    return draft.customSections.find((section) => section.id === customSectionId) || null
  }, [activeSection, draft.customSections])
  const editorSectionMeta = useMemo(
    () => getEditorSectionMeta(activeSection, activeCustomSection),
    [activeCustomSection, activeSection],
  )

  function handleRemoveSection(sectionKey) {
    setDraft((current) => removeOptionalSection(current, sectionKey))

    if (activeSection === sectionKey) {
      setActiveSection('basic')
    }
  }

  function handleAddCustomSection() {
    const nextDraft = addCustomSection(draft, newCustomLabel)
    const nextCustomSection = nextDraft.customSections[nextDraft.customSections.length - 1]

    setDraft(nextDraft)
    setNewCustomLabel('')
    setShowAddPanel(false)

    if (nextCustomSection && nextDraft.customSections.length > draft.customSections.length) {
      setActiveSection(`custom:${nextCustomSection.id}`)
    }
  }

  function renderEditorSection() {
    if (activeSection === 'basic') {
      return (
        <div className={styles.editorGrid}>
          <EditorInputField label="Client name" readOnly value={selectedClient?.name || 'Not set'} wide />
          <EditorInputField label="Trade name" readOnly value={selectedClient?.tradeName || 'Not set'} wide />
          <EditorInputField label="GST number" mono readOnly value={selectedClient?.gst || 'Not set'} />
          <EditorInputField label="PAN number" mono readOnly value={selectedClient?.pan || 'Not set'} />
          <EditorInputField label="Email ID" readOnly value={selectedClient?.email || 'Not set'} />
          <EditorInputField label="Phone number" mono readOnly value={selectedClient?.phone || 'Not set'} />
        </div>
      )
    }

    if (activeSection === 'it' || activeSection === 'gst') {
      const sectionLabel = activeSection === 'it' ? 'Income Tax' : 'GST Portal'
      const sectionState = draft[activeSection]

      return (
        <div className={styles.editorGrid}>
          <EditorInputField label="Section title" readOnly value={sectionLabel} />
          <EditorInputField
            label="Website"
            readOnly
            value={sectionState.website || (activeSection === 'it' ? INCOME_TAX_WEBSITE : GST_PORTAL_WEBSITE)}
          />
          <EditorInputField
            label={activeSection === 'it' ? 'Income Tax login ID' : 'GST login ID'}
            mono
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                [activeSection]: {
                  ...current[activeSection],
                  loginId: event.target.value,
                },
              }))
            }
            value={sectionState.loginId}
            wide
          />
          <EditorPasswordField
            label={vault ? `${sectionLabel} password (leave blank to keep)` : `${sectionLabel} password`}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                [activeSection]: {
                  ...current[activeSection],
                  password: event.target.value,
                },
              }))
            }
            placeholder={vault ? 'Leave blank to keep the current password' : 'Enter password'}
            value={sectionState.password}
            visible={editorPasswordVisible}
            onToggle={() => setEditorPasswordVisible((current) => !current)}
          />
        </div>
      )
    }

    const customSection = activeCustomSection

    if (!customSection) {
      return null
    }

    return (
      <div className={styles.editorGrid}>
        <EditorInputField
          label="Website"
          onChange={(event) =>
            setDraft((current) =>
              updateCustomSection(current, customSection.id, { website: event.target.value }),
            )
          }
          value={customSection.website || ''}
          wide
        />
        <EditorInputField
          label="Username"
          mono
          onChange={(event) =>
            setDraft((current) =>
              updateCustomSection(current, customSection.id, { username: event.target.value }),
            )
          }
          value={customSection.username}
          wide
        />
        <EditorPasswordField
          label={vault ? 'Password (leave blank to keep)' : 'Password'}
          onChange={(event) =>
            setDraft((current) =>
              updateCustomSection(current, customSection.id, { password: event.target.value }),
            )
          }
          placeholder={vault ? 'Leave blank to keep the current password' : 'Enter password'}
          value={customSection.password}
          visible={editorPasswordVisible}
          onToggle={() => setEditorPasswordVisible((current) => !current)}
        />
      </div>
    )
  }

  return (
    <div className={workspaceStyles.modalScrim} onClick={onClose} role="presentation">
      <div
        aria-modal="true"
        className={joinClasses(workspaceStyles.modal, styles.editorModal)}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className={styles.editorHeader}>
          <div className={styles.editorHeaderMain}>
            <span className={styles.editorHeaderIcon}>
              <WorkspaceIcon name="password" size={20} />
            </span>
            <div>
              <h2 className={styles.editorHeaderTitle}>{vault ? 'Edit Vault' : 'Create Vault'}</h2>
              <p className={styles.editorHeaderSubtitle}>Password Manager</p>
            </div>
          </div>

          <button
            aria-label="Close password vault editor"
            className={joinClasses(workspaceStyles.utilityButton, styles.editorCloseButton)}
            onClick={onClose}
            type="button"
          >
            <WorkspaceIcon name="close" size={18} />
          </button>
        </div>

        <div className={styles.editorLayout}>
          <aside className={styles.editorSidebar}>
            <p className={styles.editorSidebarLabel}>Categories</p>
            <div className={styles.editorSidebarTabs}>
              {tabs.map((tab) => {
                return (
                  <div className={styles.editorNavItem} key={tab.key}>
                    <button
                      className={joinClasses(
                        styles.editorNavButton,
                        activeSection === tab.key && styles.editorNavButtonActive,
                      )}
                      onClick={() => setActiveSection(tab.key)}
                      type="button"
                    >
                      <span
                        className={styles.editorNavDot}
                        style={{ backgroundColor: getTabAccentColor(tab.key) }}
                      />
                      <span className={styles.editorNavLabel}>{tab.label}</span>
                    </button>
                  </div>
                )
              })}
            </div>

            <div className={styles.editorSidebarFooter}>
              {canAddCustomSection ? (
                <button
                  className={styles.editorAddButton}
                  onClick={() => setShowAddPanel((current) => !current)}
                  type="button"
                >
                  <WorkspaceIcon name="plus" size={16} />
                  <span>{showAddPanel ? 'Close Section' : 'Add Section'}</span>
                </button>
              ) : (
                <p className={styles.editorSidebarHint}>
                  You can keep up to {MAX_CUSTOM_SECTIONS} custom sections in one vault.
                </p>
              )}

              {showAddPanel ? (
                <div className={styles.editorAddPanel}>
                  <input
                    className={joinClasses(workspaceStyles.fieldInput, styles.editorInput)}
                    onChange={(event) => setNewCustomLabel(event.target.value)}
                    placeholder="Section title"
                    type="text"
                    value={newCustomLabel}
                  />
                  <button className={workspaceStyles.gradientButton} onClick={handleAddCustomSection} type="button">
                    <span>Create Section</span>
                  </button>
                </div>
              ) : null}
            </div>
          </aside>

          <div className={styles.editorMain}>
            <div className={styles.editorMainHeader}>
              {activeCustomSection ? (
                <CustomSectionTitleEditor
                  editing={isEditingCustomSectionTitle}
                  onChange={(event) =>
                    setDraft((current) =>
                      updateCustomSection(current, activeCustomSection.id, { label: event.target.value }),
                    )
                  }
                  onEditEnd={() => setIsEditingCustomSectionTitle(false)}
                  onEditStart={() => setIsEditingCustomSectionTitle(true)}
                  title={activeCustomSection.label}
                />
              ) : (
                <h3>{editorSectionMeta.title}</h3>
              )}
              {activeCustomSection ? (
                <button
                  aria-label={`Delete ${activeCustomSection.label || 'custom section'}`}
                  className={styles.editorSectionDeleteButton}
                  onClick={() => handleRemoveSection(`custom:${activeCustomSection.id}`)}
                  type="button"
                >
                  <WorkspaceIcon name="trash" size={14} />
                  <span>Delete Section</span>
                </button>
              ) : null}
            </div>

            <div className={styles.editorBody}>{renderEditorSection()}</div>

            {submitError ? <p className={workspaceStyles.modalError}>{submitError}</p> : null}
          </div>
        </div>

        <div className={joinClasses(workspaceStyles.modalFooter, styles.editorFooter)}>
          <button className={workspaceStyles.textButton} onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className={workspaceStyles.gradientButton}
            disabled={saving}
            onClick={() => onSave(draft)}
            type="button"
          >
            <WorkspaceIcon name="check" size={16} />
            <span>{saving ? 'Saving...' : vault ? 'Save Vault' : 'Create Vault'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function VaultDeleteModal({ deleting, onClose, onConfirm, selectedClient }) {
  return (
    <div className={workspaceStyles.modalScrim} onClick={onClose} role="presentation">
      <div
        aria-modal="true"
        className={joinClasses(workspaceStyles.modal, styles.deleteModal)}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className={workspaceStyles.modalHeader}>
          <div>
            <p className={workspaceStyles.eyebrow}>Delete vault</p>
            <h2 className={workspaceStyles.modalTitle}>Delete Password Vault</h2>
            <p className={workspaceStyles.modalText}>
              This removes the stored credential bundle for {selectedClient?.name || 'the selected client'}.
            </p>
          </div>
        </div>

        <div className={styles.deleteCopy}>
          <p>
            Deleting the vault permanently removes Income Tax, GST, optional portal, and custom-tab credentials for this client.
          </p>
        </div>

        <div className={workspaceStyles.modalFooter}>
          <button className={workspaceStyles.textButton} disabled={deleting} onClick={onClose} type="button">
            Cancel
          </button>
          <button className={workspaceStyles.gradientButton} disabled={deleting} onClick={onConfirm} type="button">
            <WorkspaceIcon name="trash" size={16} />
            <span>{deleting ? 'Deleting...' : 'Delete Vault'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Renders the Password Manager workspace page.
 *
 * @returns {JSX.Element} Password Manager tool page.
 */
export default function PasswordManagerPage() {
  const outletContext = useOutletContext() ?? {}
  const authReady = outletContext.authReady ?? false
  const currentUser = outletContext.currentUser ?? null
  const openClientModal = outletContext.openClientModal ?? (() => { })
  const {
    clients,
    errorMessage: clientErrorMessage,
    filteredClients,
    handleSelectClient,
    query,
    reloadClients,
    selectedClient,
    setQuery,
    status: clientStatus,
  } = useWorkspaceToolClient(outletContext)

  const [activeTab, setActiveTab] = useState('basic')
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [revealLoadingKey, setRevealLoadingKey] = useState('')
  const [revealedSecret, setRevealedSecret] = useState({ key: '', value: '' })
  const [vault, setVault] = useState(null)
  const [vaultStatus, setVaultStatus] = useState('idle')
  const vaultRequestRef = useRef(0)
  const revealTimerRef = useRef(0)

  const detailTabs = useMemo(() => buildVaultTabs(vault || {}), [vault])

  const clearReveal = useCallback(() => {
    if (revealTimerRef.current) {
      window.clearTimeout(revealTimerRef.current)
      revealTimerRef.current = 0
    }

    setRevealLoadingKey('')
    setRevealedSecret({ key: '', value: '' })
  }, [])

  const loadVault = useCallback(async () => {
    if (!authReady) {
      return
    }

    if (!currentUser?.id || !currentUser?.email) {
      setVault(null)
      setVaultStatus('error')
      setErrorMessage('No signed-in user was found. Please sign in again.')
      return
    }

    if (!selectedClient?.id) {
      setVault(null)
      setVaultStatus('idle')
      setErrorMessage('')
      return
    }

    const requestId = vaultRequestRef.current + 1
    vaultRequestRef.current = requestId
    const cachedVaultState = getCachedPasswordVault(selectedClient.id)

    if (cachedVaultState.hasValue) {
      setVault(cachedVaultState.vault)
      setVaultStatus(cachedVaultState.vault ? 'ready' : 'empty')
    } else {
      setVault(null)
      setVaultStatus('loading')
    }

    setErrorMessage('')

    try {
      const nextVault = await fetchPasswordVault(selectedClient.id, currentUser, selectedClient)

      if (vaultRequestRef.current !== requestId) {
        return
      }

      setVault(nextVault)
      setVaultStatus(nextVault ? 'ready' : 'empty')
    } catch (error) {
      if (vaultRequestRef.current !== requestId) {
        return
      }

      if (cachedVaultState.hasValue) {
        setVaultStatus(cachedVaultState.vault ? 'ready' : 'empty')
        return
      }

      setVault(null)
      setVaultStatus('error')
      setErrorMessage(error.message || 'Unable to load the password vault.')
    }
  }, [authReady, currentUser, selectedClient?.id])

  useEffect(() => {
    loadVault()
  }, [loadVault])

  useEffect(() => {
    clearReveal()
    setActiveTab('basic')
    setDeleteModalOpen(false)
    setEditorOpen(false)
    setErrorMessage('')

    if (!selectedClient?.id) {
      setVault(null)
      setVaultStatus('idle')
      return
    }

    const cachedVaultState = getCachedPasswordVault(selectedClient.id)

    if (cachedVaultState.hasValue) {
      setVault(cachedVaultState.vault)
      setVaultStatus(cachedVaultState.vault ? 'ready' : 'empty')
      return
    }

    setVault(null)
    setVaultStatus('loading')
  }, [clearReveal, selectedClient?.id])

  useEffect(() => {
    if (!vault) {
      setActiveTab('basic')
      return
    }

    const validKeys = new Set(detailTabs.map((tab) => tab.key))

    if (!validKeys.has(activeTab)) {
      setActiveTab('basic')
    }
  }, [activeTab, detailTabs, vault])

  useEffect(() => () => clearReveal(), [clearReveal])

  async function handleSaveDraft(formState) {
    if (!selectedClient?.id) {
      setErrorMessage('Select a client before saving the password vault.')
      return
    }

    setIsSaving(true)
    setErrorMessage('')

    try {
      const payload = buildVaultPayload(formState, {
        clientId: selectedClient.id,
        vaultId: vault?.id || '',
      })
      const nextVault = vault
        ? await updatePasswordVault(vault.id, payload, currentUser, selectedClient)
        : await createPasswordVault(selectedClient.id, payload, currentUser, selectedClient)

      setVault(nextVault)
      setVaultStatus('ready')
      setEditorOpen(false)
      setActiveTab('basic')
    } catch (error) {
      setErrorMessage(error.message || 'Unable to save the password vault.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteVault() {
    if (!vault?.id || !selectedClient?.id) {
      return
    }

    setIsDeleting(true)
    setErrorMessage('')

    try {
      await deletePasswordVault(vault.id, selectedClient.id, currentUser)
      clearReveal()
      setVault(null)
      setVaultStatus('empty')
      setDeleteModalOpen(false)
      setActiveTab('basic')
    } catch (error) {
      setErrorMessage(error.message || 'Unable to delete the password vault.')
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleRevealSecret(field, customSectionId = '') {
    if (!vault?.id || !selectedClient?.id) {
      return
    }

    const secretKey = customSectionId ? `custom:${customSectionId}` : field

    if (revealedSecret.key === secretKey) {
      clearReveal()
      return
    }

    setRevealLoadingKey(secretKey)
    setErrorMessage('')

    try {
      const plaintextSecret = await revealPasswordField(
        vault.id,
        customSectionId ? 'custom' : field,
        customSectionId,
        selectedClient.id,
        currentUser,
      )

      clearReveal()
      setRevealedSecret({ key: secretKey, value: plaintextSecret })
      revealTimerRef.current = window.setTimeout(() => {
        setRevealedSecret({ key: '', value: '' })
        revealTimerRef.current = 0
      }, REVEAL_TTL_MS)
    } catch (error) {
      setErrorMessage(error.message || 'Unable to reveal the requested password.')
    } finally {
      setRevealLoadingKey('')
    }
  }

  const avatarTone = selectedClient ? getClientAvatarTone(selectedClient.id || selectedClient.name) : null

  return (
    <div className={joinClasses(workspaceStyles.page, sharedStyles.toolPage, styles.page)}>
      {/* Unified Header */}
      <section className={styles.unifiedHeader}>
        <div className={styles.unifiedHeaderLeft}>
          {selectedClient ? (
            <>
              <span
                className={styles.unifiedAvatar}
                style={{
                  '--client-avatar-background': avatarTone?.background,
                  '--client-avatar-foreground': avatarTone?.foreground,
                }}
              >
                {getInitials(selectedClient.name)}
              </span>
              <div className={styles.unifiedIdentity}>
                <h2 className={styles.unifiedName}>{selectedClient.name}</h2>
                <div className={styles.unifiedChips}>
                  <span className={styles.clientChip}>{selectedClient.gst || 'GST not set'}</span>
                  <span className={styles.clientChip}>{selectedClient.pan || 'PAN not set'}</span>
                  {vault?.updatedAt ? (
                    <span className={styles.updatedChip}>Updated {formatDateTime(vault.updatedAt)}</span>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <div className={styles.unifiedIdentity}>
              <h2 className={styles.unifiedName}>Password Manager</h2>
              <p className={styles.unifiedSubtext}>Select a client to open their credential vault</p>
            </div>
          )}
        </div>

        <div className={styles.unifiedHeaderRight}>
          {selectedClient && vaultStatus === 'ready' && vault ? (
            <div className={styles.unifiedActions}>
              <button
                aria-label="Edit vault"
                className={styles.iconActionButton}
                onClick={() => setEditorOpen(true)}
                type="button"
              >
                <WorkspaceIcon name="edit" size={16} />
              </button>
              <button
                aria-label="Delete vault"
                className={styles.iconActionButton}
                onClick={() => setDeleteModalOpen(true)}
                type="button"
              >
                <WorkspaceIcon name="trash" size={16} />
              </button>
            </div>
          ) : null}
          <ToolClientSelector
            className={styles.selectorSlot}
            clients={clients}
            errorMessage={clientErrorMessage}
            filteredClients={filteredClients}
            onCreateClient={openClientModal}
            onQueryChange={setQuery}
            onRetry={reloadClients}
            onSelectClient={handleSelectClient}
            query={query}
            selectedClient={selectedClient}
            status={clientStatus}
          />
        </div>
      </section>

      {errorMessage ? (
        <section className={joinClasses(workspaceStyles.panel, styles.feedbackPanel)}>
          <WorkspaceIcon name="help" size={18} />
          <p>{errorMessage}</p>
        </section>
      ) : null}

      {!selectedClient ? (
        <StatePanel
          actions={
            <>
              <button className={workspaceStyles.gradientButton} onClick={openClientModal} type="button">
                <WorkspaceIcon name="plus" size={16} />
                <span>Add Client</span>
              </button>
              <Link className={workspaceStyles.ghostButton} to={workspaceRoutes.clients}>
                <WorkspaceIcon name="clients" size={16} />
                <span>View Clients</span>
              </Link>
            </>
          }
          description="The Password Manager is tied to one client at a time so Basic Info stays synced with the CRM record."
          title="Choose a client to load or create a vault"
        />
      ) : null}

      {selectedClient && vaultStatus === 'loading' && !vault ? (
        <StatePanel
          description="Fetching the encrypted vault and matching it to the selected client record."
          title="Loading password vault"
        />
      ) : null}

      {selectedClient && vaultStatus === 'error' ? (
        <StatePanel
          actions={
            <button className={workspaceStyles.gradientButton} onClick={loadVault} type="button">
              <WorkspaceIcon name="check" size={16} />
              <span>Retry</span>
            </button>
          }
          description="The API returned an error while loading this client's vault. Retry after checking the server connection or encryption configuration."
          title="Vault could not be loaded"
        />
      ) : null}

      {selectedClient && vaultStatus === 'empty' ? (
        <EmptyVaultPanel onCreate={() => setEditorOpen(true)} selectedClient={selectedClient} />
      ) : null}

      {selectedClient && vaultStatus === 'ready' && vault ? (
        <VaultDetail
          activeTab={activeTab}
          onDelete={() => setDeleteModalOpen(true)}
          onEdit={() => setEditorOpen(true)}
          onReveal={handleRevealSecret}
          onTabChange={setActiveTab}
          revealLoadingKey={revealLoadingKey}
          revealedSecret={revealedSecret}
          selectedClient={selectedClient}
          tabs={detailTabs}
          vault={vault}
        />
      ) : null}

      {editorOpen ? (
        <VaultEditorModal
          onClose={() => {
            if (!isSaving) {
              setEditorOpen(false)
            }
          }}
          onSave={handleSaveDraft}
          saving={isSaving}
          selectedClient={selectedClient}
          submitError={errorMessage}
          vault={vault}
        />
      ) : null}

      {deleteModalOpen && vault ? (
        <VaultDeleteModal
          deleting={isDeleting}
          onClose={() => {
            if (!isDeleting) {
              setDeleteModalOpen(false)
            }
          }}
          onConfirm={handleDeleteVault}
          selectedClient={selectedClient}
        />
      ) : null}
    </div>
  )
}
