import { useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import styles from './Workspace.module.css'
import WorkspaceIcon from './WorkspaceIcon'

function getInitials(firstName, lastName) {
  const value = `${firstName} ${lastName}`.trim()

  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'AS'
}

function splitName(fullName) {
  const cleaned = String(fullName || '').trim()

  if (!cleaned) {
    return { firstName: 'AkountSmart', lastName: 'User' }
  }

  const parts = cleaned.split(/\s+/)
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' }
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  }
}

function buildUserHeaders(currentUser) {
  return {
    'Content-Type': 'application/json',
    'x-user-id': currentUser?.id ?? '',
    'x-user-email': currentUser?.email ?? '',
  }
}

export default function AccountSettingsPage() {
  const outletContext = useOutletContext() ?? {}
  const authReady = outletContext.authReady ?? false
  const currentUser = outletContext.currentUser ?? null
  const refreshUserProfile = outletContext.refreshUserProfile ?? (() => {})
  const userProfile = outletContext.userProfile ?? null

  const fileInputRef = useRef(null)

  const [status, setStatus] = useState('idle')
  const [saveMessage, setSaveMessage] = useState('')
  const [saveError, setSaveError] = useState('')

  const fallbackProfile = useMemo(() => {
    const fullName = currentUser?.user_metadata?.full_name || 'AkountSmart User'
    const email = currentUser?.email || 'user@akountsmart.com'
    const { firstName, lastName } = splitName(fullName)

    return {
      firstName,
      lastName,
      email,
      phone: '',
      gst: '',
      pan: '',
      address: '',
      photoUrl: '',
    }
  }, [currentUser?.email, currentUser?.user_metadata?.full_name])

  const [profile, setProfile] = useState(fallbackProfile)

  useEffect(() => {
    if (userProfile?.profile) {
      setProfile({
        firstName: userProfile.profile.firstName || '',
        lastName: userProfile.profile.lastName || '',
        email: userProfile.owner?.email || fallbackProfile.email,
        phone: String(userProfile.profile.phone || '').replace('+91 ', ''),
        gst: userProfile.profile.gst || '',
        pan: userProfile.profile.pan || '',
        address: userProfile.profile.address || '',
        photoUrl: userProfile.profile.photoUrl || '',
      })
      return
    }

    setProfile(fallbackProfile)
  }, [fallbackProfile, userProfile])

  useEffect(() => {
    if (!authReady || userProfile || !currentUser?.id || !currentUser?.email) {
      return
    }

    refreshUserProfile(currentUser)
  }, [authReady, currentUser?.email, currentUser?.id, refreshUserProfile, userProfile])

  function handleInputChange(event) {
    const { name, value } = event.target
    setProfile((current) => ({ ...current, [name]: value }))
    setSaveMessage('')
    setSaveError('')
  }

  function handleChangePhotoClick() {
    fileInputRef.current?.click()
  }

  function handlePhotoFileChange(event) {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) {
      return
    }

    if (!selectedFile.type.startsWith('image/')) {
      setSaveError('Please choose an image file for profile picture.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const imageUrl = String(reader.result || '')
      setProfile((current) => ({ ...current, photoUrl: imageUrl }))
      setSaveError('')
      setSaveMessage('Profile photo selected. Save changes to update.')
    }
    reader.readAsDataURL(selectedFile)
  }

  async function handleSaveChanges() {
    if (!currentUser?.id || !currentUser?.email) {
      setSaveError('Unable to identify signed-in user.')
      return
    }

    setStatus('saving')
    setSaveMessage('')
    setSaveError('')

    try {
      const response = await fetch('/api/user-settings', {
        method: 'PUT',
        headers: buildUserHeaders(currentUser),
        body: JSON.stringify({
          firstName: profile.firstName,
          lastName: profile.lastName,
          phone: profile.phone,
          gst: profile.gst,
          pan: profile.pan,
          address: profile.address,
          photoUrl: profile.photoUrl,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        setSaveError(data.error || 'Unable to save settings.')
        setStatus('idle')
        return
      }

      setSaveMessage('Settings saved successfully.')
      setStatus('idle')
      await refreshUserProfile(currentUser)
    } catch (error) {
      setSaveError('Unable to save settings. Please try again.')
      setStatus('idle')
    }
  }

  const displayName = `${profile.firstName} ${profile.lastName}`.trim() || 'AkountSmart User'
  const planName = userProfile?.plan?.name || 'Basic Plan'
  const clientLimit = userProfile?.plan?.clientLimit || 10
  const clientsUsed = userProfile?.usage?.clientsUsed ?? 0
  const usagePercent = Math.min(100, Math.round((clientsUsed / clientLimit) * 100))

  return (
    <div className={`${styles.page} ${styles.accountPageTight}`}>
      <section className={`${styles.panel} ${styles.accountCard}`}>
        <div className={styles.accountCardHeader}>
          <div className={styles.accountHeaderActions}>
            {saveMessage ? (
              <span className={styles.accountSavedBadge}>
                <WorkspaceIcon name="check" size={14} />
                <span>{saveMessage}</span>
              </span>
            ) : null}
            {saveError ? <span className={styles.inlineError}>{saveError}</span> : null}
            <button className={styles.gradientButton} disabled={status === 'saving'} onClick={handleSaveChanges} type="button">
              <WorkspaceIcon name="check" size={14} />
              <span>{status === 'saving' ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>

        <div className={styles.accountIdentityRow}>
          <div className={styles.accountAvatarBlock}>
            {profile.photoUrl ? (
              <img alt="Profile" className={styles.accountAvatarImage} src={profile.photoUrl} />
            ) : (
              <span className={styles.accountAvatar}>{getInitials(profile.firstName, profile.lastName)}</span>
            )}
            <input
              accept="image/*"
              className={styles.accountFileInput}
              onChange={handlePhotoFileChange}
              ref={fileInputRef}
              type="file"
            />
          </div>

          <div className={styles.accountIdentityText}>
            <h2>{displayName}</h2>
            <p>{profile.email}</p>
            <div className={styles.accountPhotoActions}>
              <button className={styles.accountPillButton} onClick={handleChangePhotoClick} type="button">Change Photo</button>
            </div>
          </div>
        </div>

        <div className={styles.accountFormGrid}>
          <label className={styles.accountField}>
            <span>First Name</span>
            <input
              className={styles.accountInput}
              name="firstName"
              onChange={handleInputChange}
              type="text"
              value={profile.firstName}
            />
          </label>

          <label className={styles.accountField}>
            <span>Last Name</span>
            <input
              className={styles.accountInput}
              name="lastName"
              onChange={handleInputChange}
              type="text"
              value={profile.lastName}
            />
          </label>

          <label className={styles.accountField}>
            <span>Email Address</span>
            <input
              className={`${styles.accountInput} ${styles.accountInputReadOnly}`}
              disabled
              readOnly
              type="email"
              value={profile.email}
            />
          </label>

          <label className={styles.accountField}>
            <span>Mobile Number</span>
            <div className={styles.accountPhoneRow}>
              <span className={styles.accountCountryCode}>+91</span>
              <input
                className={styles.accountInput}
                name="phone"
                onChange={handleInputChange}
                type="tel"
                value={profile.phone}
              />
            </div>
          </label>

          <label className={styles.accountField}>
            <span>GST Number (Optional)</span>
            <input
              className={styles.accountInput}
              name="gst"
              onChange={handleInputChange}
              placeholder="Enter GST number if available"
              type="text"
              value={profile.gst}
            />
          </label>

          <label className={styles.accountField}>
            <span>PAN (Optional)</span>
            <input
              className={styles.accountInput}
              name="pan"
              onChange={handleInputChange}
              placeholder="Enter PAN details if available"
              type="text"
              value={profile.pan}
            />
          </label>

          <label className={`${styles.accountField} ${styles.accountFieldWide}`}>
            <span>Address</span>
            <textarea
              className={styles.accountInput}
              name="address"
              onChange={handleInputChange}
              placeholder="Street, city, state, postal code"
              rows="3"
              value={profile.address}
            />
          </label>
        </div>
      </section>

      <section className={`${styles.panel} ${styles.accountPlanPanel}`}>
        <div className={styles.accountPlanTop}>
          <div className={styles.accountPlanIdentity}>
            <span className={styles.accountPlanIcon}>
              <WorkspaceIcon name="spark" size={18} />
            </span>
            <div>
              <h2>{planName}</h2>
              <p>Plan usage and limits are sourced from MongoDB for this user.</p>
            </div>
            <span className={styles.accountPlanBadge}>Active</span>
          </div>

          <button className={styles.gradientButton} type="button">
            <WorkspaceIcon name="arrowRight" size={14} />
            <span>Upgrade Plan</span>
          </button>
        </div>

        <div className={styles.accountPlanStats}>
          <article>
            <p className={styles.eyebrow}>Usage</p>
            <strong>{clientsUsed} / {clientLimit} Clients</strong>
            <span className={styles.accountUsageTrack}>
              <span className={styles.accountUsageFill} style={{ width: `${usagePercent}%` }} />
            </span>
          </article>

          <article>
            <p className={styles.eyebrow}>Billing</p>
            <strong>None Active</strong>
          </article>

          <article className={styles.accountPlanLinkWrap}>
            <button className={styles.linkButtonInline} type="button">View all features</button>
          </article>
        </div>
      </section>
    </div>
  )
}