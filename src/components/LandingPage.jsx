import { useState } from 'react'
import styles from './LandingPage.module.css'

// Inline SVG logo icon — matches the reference design
// function LogoIcon() {
//   return (
//     <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
//       <rect width="28" height="28" rx="7" fill="rgba(255,255,255,0.2)" />
//       <path d="M9 19L13 9L17 15L19.5 11L22 19" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
//       <circle cx="9" cy="19" r="1.5" fill="white" />
//     </svg>
//   )
// }

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
          {/* <LogoIcon /> */}
          <span className={styles.logoText}>AkountSmart</span>
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

        {/* Dashboard Preview */}
        <div className={styles.previewWrap}>
          <div className={styles.previewCard}>
            <img
              src="/images/dashboard-preview.png"
              alt="AkountSmart Dashboard Preview"
              className={styles.previewImg}
              onError={(e) => {
                e.target.style.display = 'none'
                e.target.nextSibling.style.display = 'flex'
              }}
            />
            <div className={styles.previewPlaceholder}>
              <div className={styles.previewPlaceholderInner}>
                <div className={styles.placeholderNav}>
                  <div className={styles.placeholderLogo}>AkountSmart</div>
                  <div className={styles.placeholderNavItems}><span>Home</span></div>
                </div>
                <div className={styles.placeholderBody}>
                  <div className={styles.placeholderSidebar}>
                    <div className={styles.sidebarGroup}>
                      <div className={styles.sidebarLabel}>Accounting</div>
                      <div className={styles.sidebarItem}>Invoice Processing</div>
                      <div className={styles.sidebarItem}>Tally XML Converter</div>
                    </div>
                    <div className={styles.sidebarGroup}>
                      <div className={styles.sidebarLabel}>GST Reconciliation</div>
                      <div className={styles.sidebarItem}>2B Matching</div>
                      <div className={styles.sidebarItem}>4A Reconciliation</div>
                    </div>
                  </div>
                  <div className={styles.placeholderContent}>
                    <h3>Welcome back, Priyanka 👋</h3>
                    <div className={styles.statsRow}>
                      <div className={`${styles.statCard} ${styles.statBlue}`}>
                        <div className={styles.statLabel}>Clients Managed</div>
                        <div className={styles.statValue}>142</div>
                        <div className={styles.statSub}>+5 this week</div>
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statLabel}>Returns Pending</div>
                        <div className={styles.statValue}>34</div>
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statLabel}>GST Mismatches</div>
                        <div className={styles.statValue}>6</div>
                      </div>
                      <div className={styles.statCard}>
                        <div className={styles.statLabel}>Notices Received</div>
                        <div className={styles.statValue}>2</div>
                      </div>
                    </div>
                    <div className={styles.aiAssistant}>
                      <div className={styles.aiTitle}>🤖 AI Tax Assistant</div>
                      <div className={styles.aiSubtitle}>Ask anything about GST, notices, reconciliation, or filings.</div>
                      <div className={styles.aiInput}>Ask something like: Why is GSTR-2B mismatch happening?</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <footer className={styles.footer}>
        <span>©AkountSmart. 2026.</span>
        <span>All Rights Reserved</span>
      </footer>
    </div>
  )
}
