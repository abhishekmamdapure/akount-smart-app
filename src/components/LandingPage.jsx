import { useState } from 'react'
import styles from './LandingPage.module.css'

const EARLY_ACCESS_PERK_MESSAGE = 'Early Access Perk: First month FREE for waitlist members'

/**
 * Renders the AkountSmart landing page waitlist experience.
 *
 * @returns {JSX.Element} The landing page interface.
 */
export default function LandingPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !email.includes('@')) {
      setStatus('error')
      setMessage('Please enter a valid email.')
      return
    }
    setStatus('loading')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus('success')
        setMessage("You're on the list! We'll reach out when we launch.")
        setEmail('')
      } else {
        setStatus('error')
        setMessage(data.error || 'Something went wrong. Please try again.')
      }
    } catch {
      setStatus('error')
      setMessage('Network error. Please try again.')
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.gradientBg} />
      <div className={styles.gradientOverlay} />
      <div className={styles.noiseMask} />

      {/* Navbar */}
      <nav className={styles.nav}>
        <div className={styles.logo}>
          <img src="/images/logo.png" alt="AkountSmart" className={styles.logoImg} />
        </div>
        <button className={styles.launchBadge}>
          Launching in May
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="7" y1="17" x2="17" y2="7" />
            <polyline points="7 7 17 7 17 17" />
          </svg>
        </button>
      </nav>

      {/* Hero */}
      <main className={styles.hero}>
        <div className={styles.badge}>
          <span className={styles.badgeDot} />
          Built for Tax and Accounting Professionals
        </div>

        <h1 className={styles.heading}>
          Your AI-powered Toolkit For<br />
          Smarter Accounting is<br />
          Coming Soon
        </h1>

        <p className={styles.subheading}>
          Simplify daily operations, automate repetitive work, and scale your tax & accounting
          practice without increasing manual workload.
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputWrap}>
            <input
              type="email"
              placeholder="Enter your Email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setStatus('idle') }}
              className={styles.emailInput}
              disabled={status === 'loading' || status === 'success'}
            />
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={status === 'loading' || status === 'success'}
            >
              {status === 'loading' ? 'Joining...' : status === 'success' ? 'Joined ✓' : 'Join the waitlist'}
            </button>
          </div>
          {message && (
            <p className={`${styles.formMsg} ${status === 'error' ? styles.errorMsg : styles.successMsg}`}>
              {message}
            </p>
          )}
        </form>
      </main>

      <section className={styles.perkSection} aria-label="Waitlist member perk">
        <div className={styles.perkBanner} role="note">
          <span className={styles.perkIcon} aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="5" y="12" width="12" height="13" rx="2.5" fill="#F59E0B" />
              <rect x="14" y="12" width="4" height="13" fill="#EF4444" />
              <path d="M5 16.5h22" stroke="#EF4444" strokeWidth="2.2" />
              <path d="M15.5 12V7.8c0-1.5-1.1-2.6-2.5-2.6-2 0-3.8 1.9-3.8 4.4 0 1.6 1.2 2.4 3.1 2.4h3.2Z" fill="#FBBF24" />
              <path d="M16.5 12V7.8c0-1.5 1.1-2.6 2.5-2.6 2 0 3.8 1.9 3.8 4.4 0 1.6-1.2 2.4-3.1 2.4h-3.2Z" fill="#FCD34D" />
              <rect x="5" y="10" width="22" height="4.5" rx="2.25" fill="#EF4444" />
            </svg>
          </span>
          <p className={styles.perkText}>{EARLY_ACCESS_PERK_MESSAGE}</p>
        </div>
      </section>

      {/* Features Grid */}
      <section className={styles.featuresSection}>
        <div className={styles.featuresGrid}>

          {/* Password Management */}
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <svg width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
                <ellipse cx="19" cy="16" rx="7" ry="9" stroke="#4F6EF7" strokeWidth="2" fill="none" />
                <path d="M14 16c0-2.761 2.239-5 5-5" stroke="#4F6EF7" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="19" cy="16" r="2" fill="#4F6EF7" />
                <path d="M10 26.5c0-1.5.8-2.8 2-3.6M28 26.5c0-1.5-.8-2.8-2-3.6" stroke="#4F6EF7" strokeWidth="1.8" strokeLinecap="round" opacity="0.45" />
                <path d="M13 30c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="#4F6EF7" strokeWidth="2" strokeLinecap="round" />
                <circle cx="19" cy="7" r="1.2" fill="#4F6EF7" opacity="0.5" />
                <circle cx="12.5" cy="10" r="1.2" fill="#4F6EF7" opacity="0.4" />
                <circle cx="25.5" cy="10" r="1.2" fill="#4F6EF7" opacity="0.4" />
              </svg>
            </div>
            <h3 className={styles.featureTitle}>Password Management</h3>
            <p className={styles.featureDesc}>Store and access sensitive credentials securely.</p>
          </div>

          {/* Clients Management */}
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <svg width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="19" cy="12" r="4.5" fill="#4F6EF7" opacity="0.9" />
                <circle cx="10" cy="14" r="3.2" fill="#4F6EF7" opacity="0.5" />
                <circle cx="28" cy="14" r="3.2" fill="#4F6EF7" opacity="0.5" />
                <path d="M9 29c0-3.866 4.477-7 10-7s10 3.134 10 7" stroke="#4F6EF7" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                <path d="M4.5 29c0-2.761 2.462-5 5.5-5" stroke="#4F6EF7" strokeWidth="1.8" strokeLinecap="round" opacity="0.45" />
                <path d="M33.5 29c0-2.761-2.462-5-5.5-5" stroke="#4F6EF7" strokeWidth="1.8" strokeLinecap="round" opacity="0.45" />
              </svg>
            </div>
            <h3 className={styles.featureTitle}>Clients Management</h3>
            <p className={styles.featureDesc}>Manage client data, documents, and workflows in one place.</p>
          </div>

          {/* Invoice Processing */}
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <svg width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="7" y="4" width="20" height="26" rx="3" stroke="#4F6EF7" strokeWidth="2" fill="none" />
                <path d="M13 13H25" stroke="#4F6EF7" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M13 18H25" stroke="#4F6EF7" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M13 23H19" stroke="#4F6EF7" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="25" cy="28" r="5" fill="#4F6EF7" opacity="0.12" stroke="#4F6EF7" strokeWidth="1.8" />
                <path d="M23 28l1.5 1.5 2.5-3" stroke="#4F6EF7" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className={styles.featureTitle}>Invoice Processing</h3>
            <p className={styles.featureDesc}>Automate invoice capture, validation, and data extraction in seconds.</p>
          </div>

          {/* Tally XML Converter */}
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <svg width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 5h14l9 9v19a2 2 0 01-2 2H8a2 2 0 01-2-2V7a2 2 0 012-2z" stroke="#4F6EF7" strokeWidth="2" fill="none" />
                <path d="M22 5v9h9" stroke="#4F6EF7" strokeWidth="1.8" strokeLinejoin="round" fill="none" />
                <rect x="9" y="22" width="20" height="10" rx="2" fill="#4F6EF7" />
                <text x="19" y="30" textAnchor="middle" fill="white" fontSize="6.5" fontWeight="700" fontFamily="monospace">XML</text>
              </svg>
            </div>
            <h3 className={styles.featureTitle}>Tally XML Converter</h3>
            <p className={styles.featureDesc}>Seamlessly convert and integrate data with Tally-compatible formats.</p>
          </div>

          {/* GST Reconciliation */}
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <div className={styles.gstBadge}>
                <span className={styles.gstLabel}>GST</span>
              </div>
            </div>
            <h3 className={styles.featureTitle}>GST Reconciliation</h3>
            <p className={styles.featureDesc}>Match purchase data with GSTR-2B to identify mismatches instantly.</p>
          </div>

          {/* PDF Tools */}
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <svg width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 5h14l9 9v19a2 2 0 01-2 2H8a2 2 0 01-2-2V7a2 2 0 012-2z" stroke="#4F6EF7" strokeWidth="2" fill="none" />
                <path d="M22 5v9h9" stroke="#4F6EF7" strokeWidth="1.8" strokeLinejoin="round" fill="none" />
                <rect x="9" y="22" width="20" height="10" rx="2" fill="#E53E3E" />
                <text x="19" y="30" textAnchor="middle" fill="white" fontSize="6.5" fontWeight="700" fontFamily="monospace">PDF</text>
              </svg>
            </div>
            <h3 className={styles.featureTitle}>PDF Tools</h3>
            <p className={styles.featureDesc}>Extract, merge, and process PDF documents for accounting workflows.</p>
          </div>

        </div>
      </section>

      <footer className={styles.footer}>
        <span>©AkountSmart. 2026.</span>
        <span>All Rights Reserved</span>
      </footer>
    </div>
  )
}
