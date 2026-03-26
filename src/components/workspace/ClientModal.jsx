import { useEffect, useState } from 'react'
import styles from './ClientManagement.module.css'
import {
  buildClientFormDraft,
  mapClientFormErrorMessage,
  validateClientFormDraft,
} from './clientFormHelpers'
import WorkspaceIcon from './WorkspaceIcon'

const PHONE_DIGIT_LIMIT = 10
const PINCODE_DIGIT_LIMIT = 6
const CLIENT_FORM_AUTOCOMPLETE = 'off'
const CLIENT_FIELD_AUTOCOMPLETE = 'new-password'

const emptyClientForm = {
  name: '',
  tradeName: '',
  gst: '',
  pan: '',
  addressLine: '',
  city: '',
  state: '',
  pincode: '',
  phone: '',
  email: '',
}

function buildUserHeaders(currentUser) {
  return {
    'Content-Type': 'application/json',
    'x-user-id': currentUser?.id ?? '',
    'x-user-email': currentUser?.email ?? '',
  }
}

function extractLegacyAddressParts(address = '') {
  const rawAddress = String(address || '').trim()

  if (!rawAddress) {
    return {
      addressLine: '',
      city: '',
      state: '',
      pincode: '',
    }
  }

  const parts = rawAddress.split(',').map((part) => part.trim()).filter(Boolean)
  const pincodeMatch = rawAddress.match(/\b\d{6}\b/)
  const pincode = pincodeMatch?.[0] || ''

  if (parts.length >= 4) {
    return {
      addressLine: parts.slice(0, -3).join(', ') || parts[0] || rawAddress,
      city: parts[parts.length - 3] || '',
      state: parts[parts.length - 2] || '',
      pincode,
    }
  }

  if (parts.length >= 3) {
    const lastPart = parts[parts.length - 1].replace(pincode, '').trim()

    return {
      addressLine: parts.slice(0, -2).join(', ') || parts[0] || rawAddress,
      city: parts[parts.length - 2] || '',
      state: lastPart,
      pincode,
    }
  }

  return {
    addressLine: rawAddress.replace(pincode, '').replace(/,\s*$/, '').trim(),
    city: '',
    state: '',
    pincode,
  }
}

function buildInitialForm(client) {
  if (!client) {
    return emptyClientForm
  }

  const legacyAddressParts = extractLegacyAddressParts(client.address)

  return {
    name: client.name || '',
    tradeName: client.tradeName || '',
    gst: client.gst || '',
    pan: client.pan || '',
    addressLine: client.addressLine || legacyAddressParts.addressLine,
    city: client.city || legacyAddressParts.city,
    state: client.state || legacyAddressParts.state,
    pincode: client.pincode || legacyAddressParts.pincode,
    phone: String(client.phone || '').replace('+91 ', ''),
    email: client.email || '',
  }
}

function normalizeFieldValue(name, value) {
  if (name === 'phone') {
    return value.replace(/\D/g, '').slice(0, PHONE_DIGIT_LIMIT)
  }

  if (name === 'pincode') {
    return value.replace(/\D/g, '').slice(0, PINCODE_DIGIT_LIMIT)
  }

  if (name === 'gst' || name === 'pan') {
    return value.toUpperCase().replace(/\s+/g, '')
  }

  return value
}

/**
 * Renders the create and edit modal for client records.
 *
 * @param {object} props - The component props.
 * @param {object|null} props.client - The client being edited, when present.
 * @param {object|null} props.currentUser - The current authenticated user.
 * @param {'create'|'edit'} props.mode - The modal operating mode.
 * @param {() => void} props.onClose - Invoked when the modal should close.
 * @param {(client: object) => void} props.onSaved - Invoked after a successful save.
 * @param {boolean} props.open - Whether the modal is visible.
 * @returns {JSX.Element|null} The rendered modal, or `null` when closed.
 */
export default function ClientModal({ client, currentUser, mode, onClose, onSaved, open }) {
  const [formState, setFormState] = useState(emptyClientForm)
  const [status, setStatus] = useState('idle')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!open) {
      return
    }

    setFormState(buildInitialForm(client))
    setStatus('idle')
    setErrorMessage('')
  }, [client, open])

  function handleChange(event) {
    const { name, value } = event.target
    const nextValue = normalizeFieldValue(name, value)

    setFormState((currentFormState) => ({ ...currentFormState, [name]: nextValue }))
  }

  function handleDismiss() {
    if (status === 'submitting') {
      return
    }

    onClose()
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!currentUser?.id || !currentUser?.email) {
      setStatus('error')
      setErrorMessage('No signed-in user was found. Please sign in again.')
      return
    }

    const nextDraft = buildClientFormDraft(new FormData(event.currentTarget).entries(), formState)
    const validationError = validateClientFormDraft(nextDraft)

    setFormState(nextDraft)

    if (validationError) {
      setStatus('error')
      setErrorMessage(validationError)
      return
    }

    setStatus('submitting')
    setErrorMessage('')

    try {
      const response = await fetch('/api/clients', {
        method: mode === 'edit' ? 'PUT' : 'POST',
        headers: buildUserHeaders(currentUser),
        body: JSON.stringify({
          clientId: client?.id,
          ...nextDraft,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setStatus('error')
        setErrorMessage(mapClientFormErrorMessage(data.error) || 'Unable to save the client.')
        return
      }

      setStatus('success')
      onSaved(data.client)
    } catch (error) {
      setStatus('error')
      setErrorMessage('Unable to save the client. Please try again.')
    }
  }

  if (!open) {
    return null
  }

  const isEditing = mode === 'edit'
  const submitLabel =
    status === 'submitting'
      ? isEditing ? 'Saving Changes...' : 'Saving Client...'
      : isEditing ? 'Save Changes' : 'Add Client'

  return (
    <div className={styles.modalScrim} onClick={handleDismiss} role="presentation">
      <div aria-modal="true" className={styles.clientModal} onClick={(event) => event.stopPropagation()} role="dialog">
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderContent}>
            <div className={styles.modalHeaderText}>
              <span className={styles.modalBadge}>Client onboarding</span>
              <h2 className={styles.modalTitle}>{isEditing ? 'Edit Client' : 'Add New Client'}</h2>
              <p className={styles.modalText}>
                {isEditing
                  ? 'Update registration and contact details without breaking the existing client workspace.'
                  : 'Create a new client record with the registration and contact details your tools rely on.'}
              </p>
            </div>
          </div>

          <button
            aria-label="Close client form"
            className={styles.modalCloseButton}
            disabled={status === 'submitting'}
            onClick={handleDismiss}
            type="button"
          >
            <WorkspaceIcon name="close" size={18} />
          </button>
        </div>

        <form autoComplete={CLIENT_FORM_AUTOCOMPLETE} className={styles.clientForm} onSubmit={handleSubmit}>
          <div className={styles.formGrid}>
            <label className={`${styles.fieldGroup} ${styles.fieldWide}`}>
              <span className={styles.fieldLabel}>Client name *</span>
              <input
                autoComplete={CLIENT_FIELD_AUTOCOMPLETE}
                className={styles.fieldInput}
                name="name"
                onChange={handleChange}
                placeholder="e.g. Neeta Ambani"
                required
                type="text"
                value={formState.name}
              />
            </label>

            <label className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>Trade name</span>
              <input
                autoComplete={CLIENT_FIELD_AUTOCOMPLETE}
                className={styles.fieldInput}
                name="tradeName"
                onChange={handleChange}
                placeholder="e.g. Reliance Industries"
                type="text"
                value={formState.tradeName}
              />
            </label>

            <label className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>GST number</span>
              <input
                autoComplete={CLIENT_FIELD_AUTOCOMPLETE}
                className={styles.fieldInput}
                maxLength={15}
                name="gst"
                onChange={handleChange}
                placeholder="22AAAAA0000A1Z5"
                type="text"
                value={formState.gst}
              />
              <small className={styles.fieldHint}>Leave blank when the client is not GST registered.</small>
            </label>

            <div className={`${styles.fieldGroup} ${styles.fieldWide}`}>
              <span className={styles.fieldLabel}>Registered address *</span>
              <div className={styles.addressGrid}>
                <label className={`${styles.fieldGroup} ${styles.addressLineField}`}>
                  <span className={styles.fieldLabel}>Address</span>
                  <input
                    autoComplete={CLIENT_FIELD_AUTOCOMPLETE}
                    className={styles.fieldInput}
                    name="addressLine"
                    onChange={handleChange}
                    placeholder="Street, building, area"
                    required
                    type="text"
                    value={formState.addressLine}
                  />
                </label>

                <label className={`${styles.fieldGroup} ${styles.addressMetaField}`}>
                  <span className={styles.fieldLabel}>City</span>
                  <input
                    autoComplete={CLIENT_FIELD_AUTOCOMPLETE}
                    className={styles.fieldInput}
                    name="city"
                    onChange={handleChange}
                    placeholder="Mumbai"
                    required
                    type="text"
                    value={formState.city}
                  />
                </label>

                <label className={`${styles.fieldGroup} ${styles.addressMetaField}`}>
                  <span className={styles.fieldLabel}>State</span>
                  <input
                    autoComplete={CLIENT_FIELD_AUTOCOMPLETE}
                    className={styles.fieldInput}
                    name="state"
                    onChange={handleChange}
                    placeholder="Maharashtra"
                    required
                    type="text"
                    value={formState.state}
                  />
                </label>

                <label className={`${styles.fieldGroup} ${styles.addressMetaField}`}>
                  <span className={styles.fieldLabel}>Pincode</span>
                  <input
                    autoComplete={CLIENT_FIELD_AUTOCOMPLETE}
                    className={styles.fieldInput}
                    inputMode="numeric"
                    maxLength={6}
                    name="pincode"
                    onChange={handleChange}
                    pattern="[0-9]{6}"
                    placeholder="400001"
                    required
                    type="text"
                    value={formState.pincode}
                  />
                </label>
              </div>
            </div>

            <label className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>PAN number</span>
              <input
                autoComplete={CLIENT_FIELD_AUTOCOMPLETE}
                className={styles.fieldInput}
                maxLength={10}
                name="pan"
                onChange={handleChange}
                placeholder="ABCDE1234F"
                type="text"
                value={formState.pan}
              />
            </label>

            <label className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>Mobile number *</span>
              <div className={styles.phoneField}>
                <span className={styles.phonePrefix}>+91</span>
                <input
                  autoComplete={CLIENT_FIELD_AUTOCOMPLETE}
                  className={styles.fieldInput}
                  inputMode="numeric"
                  name="phone"
                  onChange={handleChange}
                  placeholder="9876543210"
                  required
                  type="tel"
                  value={formState.phone}
                />
              </div>
            </label>

            <label className={`${styles.fieldGroup} ${styles.fieldWide}`}>
              <span className={styles.fieldLabel}>Email address *</span>
              <input
                autoComplete={CLIENT_FIELD_AUTOCOMPLETE}
                className={styles.fieldInput}
                name="email"
                onChange={handleChange}
                placeholder="finance@client.com"
                required
                type="email"
                value={formState.email}
              />
            </label>
          </div>

          {errorMessage ? <p className={styles.modalError}>{errorMessage}</p> : null}

          <div className={styles.modalFooter}>
            <button className={styles.ghostButton} disabled={status === 'submitting'} onClick={handleDismiss} type="button">
              Cancel
            </button>
            <button className={styles.primaryButton} disabled={status === 'submitting'} type="submit">
              <WorkspaceIcon name="clients" size={16} />
              <span>{submitLabel}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
