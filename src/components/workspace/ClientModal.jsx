import { useEffect, useState } from 'react'
import styles from './Workspace.module.css'
import WorkspaceIcon from './WorkspaceIcon'

const emptyClientForm = {
  name: '',
  tradeName: '',
  gst: '',
  pan: '',
  address: '',
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

function buildInitialForm(client) {
  if (!client) {
    return emptyClientForm
  }

  return {
    name: client.name || '',
    tradeName: client.tradeName || '',
    gst: client.gst || '',
    pan: client.pan || '',
    address: client.address || '',
    phone: String(client.phone || '').replace('+91 ', ''),
    email: client.email || '',
  }
}

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
    setFormState((current) => ({ ...current, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!currentUser?.id || !currentUser?.email) {
      setStatus('error')
      setErrorMessage('No signed-in user was found. Please sign in again.')
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
          ...formState,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setStatus('error')
        setErrorMessage(data.error || 'Unable to save the client.')
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

  return (
    <div className={styles.modalScrim} onClick={onClose} role="presentation">
      <div className={styles.modal} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className={styles.modalHeader}>
          <div>
            <p className={styles.eyebrow}>Client onboarding</p>
            <h2 className={styles.modalTitle}>{isEditing ? 'Edit Client' : 'Add New Client'}</h2>
            <p className={styles.modalText}>
              Enter technical and contact details to {isEditing ? 'update this entity.' : 'register a new entity.'}
            </p>
          </div>

          <button aria-label="Close client form" className={styles.utilityButton} onClick={onClose} type="button">
            <WorkspaceIcon name="close" size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.modalGrid}>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span>Client Name *</span>
              <input
                className={styles.fieldInput}
                name="name"
                onChange={handleChange}
                placeholder="e.g. Reliance Industries Ltd"
                required
                type="text"
                value={formState.name}
              />
            </label>

            <label className={styles.field}>
              <span>Trade Name</span>
              <input
                className={styles.fieldInput}
                name="tradeName"
                onChange={handleChange}
                placeholder="e.g. Retail Division"
                type="text"
                value={formState.tradeName}
              />
            </label>

            <label className={styles.field}>
              <span>GST Number</span>
              <input
                className={styles.fieldInput}
                name="gst"
                onChange={handleChange}
                placeholder="22AAAAA0000A1Z5"
                type="text"
                value={formState.gst}
              />
              <small className={styles.fieldHint}>
                Format: 15 digit alpha-numeric (state code + PAN + checksum)
              </small>
            </label>

            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span>Registered Address *</span>
              <textarea
                className={styles.fieldTextarea}
                name="address"
                onChange={handleChange}
                placeholder="Street, Building, Area, City, Pin Code"
                required
                rows="3"
                value={formState.address}
              />
            </label>

            <label className={styles.field}>
              <span>PAN Number</span>
              <input
                className={styles.fieldInput}
                name="pan"
                onChange={handleChange}
                placeholder="ABCDE1234F"
                type="text"
                value={formState.pan}
              />
            </label>

            <label className={styles.field}>
              <span>Mobile Number *</span>
              <div className={styles.phoneField}>
                <span className={styles.phonePrefix}>+91</span>
                <input
                  className={styles.fieldInput}
                  name="phone"
                  onChange={handleChange}
                  placeholder="9876543210"
                  required
                  type="tel"
                  value={formState.phone}
                />
              </div>
            </label>

            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span>Email Address *</span>
              <input
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
            <button className={styles.textButton} onClick={onClose} type="button">
              Cancel
            </button>
            <button className={styles.gradientButton} disabled={status === 'submitting'} type="submit">
              <WorkspaceIcon name="clients" size={16} />
              <span>
                {status === 'submitting'
                  ? isEditing ? 'Saving Changes...' : 'Saving Client...'
                  : isEditing ? 'Save Changes' : 'Add Client'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
