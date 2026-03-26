import { useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { trackAuthEvent } from '../lib/authAnalytics'
import { supabase } from '../supabase'
import { workspaceRoutes } from '../workspaceRoutes'
import shared from './auth.module.css'
import s from './LoginPage.module.css'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DEFAULT_RATE_LIMIT_SECONDS = 30
const RECAPTCHA_ESCALATION_THRESHOLD = 3

function createFormToken() {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function isValidEmail(value) {
  return EMAIL_PATTERN.test(value.trim())
}

function parseRetryAfterSeconds(error) {
  const message = String(error?.message ?? '')
  const secondsMatch = message.match(/(\d+)\s*seconds?/i)

  if (secondsMatch?.[1]) {
    return Number(secondsMatch[1])
  }

  return DEFAULT_RATE_LIMIT_SECONDS
}

function classifyAuthError(error) {
  const message = String(error?.message ?? '').toLowerCase()
  const status = Number(error?.status ?? 0)

  if (!navigator.onLine || message.includes('failed to fetch') || message.includes('network')) {
    return 'network'
  }

  if (status === 429 || message.includes('too many')) {
    return 'rate_limit'
  }

  if (message.includes('locked') || message.includes('suspended') || message.includes('disabled')) {
    return 'account_locked'
  }

  if (message.includes('session') && message.includes('expired')) {
    return 'session_expired'
  }

  return 'invalid_credentials'
}

function getErrorPresentation(type, retryInSeconds = DEFAULT_RATE_LIMIT_SECONDS) {
  if (type === 'rate_limit') {
    return {
      title: 'Too many attempts',
      message: `Too many attempts. Try again in ${retryInSeconds} seconds.`,
      reasonCode: 'rate_limited',
      tone: 'warning',
    }
  }

  if (type === 'account_locked') {
    return {
      title: 'Account temporarily locked',
      message: 'Your account is temporarily locked. Contact support or try again later.',
      reasonCode: 'account_locked',
      tone: 'warning',
    }
  }

  if (type === 'network') {
    return {
      title: 'Connection issue',
      message: 'Network error. Check your connection and try again.',
      reasonCode: 'network_failure',
      tone: 'info',
    }
  }

  if (type === 'session_expired') {
    return {
      title: 'Session expired',
      message: 'Your session has expired. Please sign in again.',
      reasonCode: 'session_expired',
      tone: 'info',
    }
  }

  return {
    title: 'Sign-in failed',
    message: 'Invalid email or password.',
    reasonCode: 'invalid_credentials',
    tone: 'error',
  }
}

function getAlertClassName(tone) {
  if (tone === 'warning') return s.alertWarning
  if (tone === 'info') return s.alertInfo
  return s.alertError
}

function getPasswordStrength(password) {
  if (!password) {
    return { score: 0, label: 'Enter a password', tone: 'weak' }
  }

  let score = 0
  if (password.length >= 8) score += 1
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1

  if (score <= 1) return { score, label: 'Weak', tone: 'weak' }
  if (score <= 3) return { score, label: 'Medium', tone: 'medium' }
  return { score, label: 'Strong', tone: 'strong' }
}

async function getRecaptchaToken(failedAttempts) {
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY

  if (!siteKey || failedAttempts < RECAPTCHA_ESCALATION_THRESHOLD) {
    return null
  }

  const execute = window.grecaptcha?.execute
  if (typeof execute !== 'function') {
    return null
  }

  try {
    const token = await execute(siteKey, { action: 'login' })
    return token || null
  } catch {
    return null
  }
}

function AtIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
    </svg>
  )
}

function EyeIcon({ open }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {open ? (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </>
      )}
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  )
}

function BlobIllustration() {
  return (
    <svg className={s.blobSvg} viewBox="0 0 640 640" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="loginBlobGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#bfdbfe" />
          <stop offset="100%" stopColor="#93c5fd" />
        </linearGradient>
      </defs>
      <path
        fill="url(#loginBlobGradient)"
        d="M500 142c59 54 96 136 89 215-6 80-55 158-127 208-71 49-165 71-242 47-78-24-139-94-170-176-30-82-30-175 8-249s113-128 195-142c82-14 181 14 247 97z"
      />
    </svg>
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const emailInputRef = useRef(null)
  const forgotEmailInputRef = useRef(null)

  const emailInputId = useId()
  const emailErrorId = useId()
  const passwordInputId = useId()
  const passwordHintId = useId()
  const authAlertId = useId()
  const forgotEmailInputId = useId()
  const forgotTitleId = useId()
  const forgotDescId = useId()
  const forgotErrorId = useId()
  const securityTooltipId = useId()
  const leftHeadingId = useId()
  const leftDescId = useId()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState('idle')
  const [emailTouched, setEmailTouched] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [rateLimitUntil, setRateLimitUntil] = useState(null)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)
  const [csrfToken, setCsrfToken] = useState(() => createFormToken())
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotStatus, setForgotStatus] = useState('idle')
  const [forgotError, setForgotError] = useState('')
  const [securityTooltipOpen, setSecurityTooltipOpen] = useState(false)
  const [authAlert, setAuthAlert] = useState(() => {
    const reason = new URLSearchParams(location.search).get('reason')

    if (reason === 'session_expired') {
      return getErrorPresentation('session_expired')
    }

    return null
  })

  const showPasswordStrength = new URLSearchParams(location.search).get('flow') === 'signup'
  const passwordStrength = getPasswordStrength(password)
  const emailDescribedBy = [emailError ? emailErrorId : '', authAlert ? authAlertId : ''].filter(Boolean).join(' ')
  const passwordDescribedBy = [passwordHintId, authAlert ? authAlertId : ''].filter(Boolean).join(' ')
  const canAttemptLogin = status !== 'loading' && cooldownSeconds === 0

  useEffect(() => {
    emailInputRef.current?.focus()
    trackAuthEvent('login_page_viewed', {
      path: `${window.location.pathname}${window.location.search}`,
    })
  }, [])

  useEffect(() => {
    const reason = new URLSearchParams(location.search).get('reason')

    if (reason === 'session_expired') {
      setAuthAlert(getErrorPresentation('session_expired'))
    }
  }, [location.search])

  useEffect(() => {
    if (!rateLimitUntil) {
      setCooldownSeconds(0)
      return
    }

    const syncCountdown = () => {
      const remaining = Math.max(0, Math.ceil((rateLimitUntil - Date.now()) / 1000))
      setCooldownSeconds(remaining)

      if (remaining === 0) {
        setRateLimitUntil(null)
      }
    }

    syncCountdown()
    const timer = window.setInterval(syncCountdown, 1000)

    return () => window.clearInterval(timer)
  }, [rateLimitUntil])

  useEffect(() => {
    if (!forgotOpen) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    window.setTimeout(() => {
      forgotEmailInputRef.current?.focus()
    }, 0)

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setForgotOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [forgotOpen])

  function validateEmailOnBlur(value) {
    const normalized = value.trim()

    if (!normalized) {
      setEmailError('')
      return true
    }

    if (!isValidEmail(normalized)) {
      setEmailError('Enter a valid email address.')
      return false
    }

    setEmailError('')
    return true
  }

  function handleEmailInvalid(event) {
    if (event.currentTarget.validity.valueMissing) {
      setEmailError('Email is required.')
    } else if (event.currentTarget.validity.typeMismatch) {
      setEmailError('Enter a valid email address.')
    }

    setEmailTouched(true)
    event.preventDefault()
  }

  function handleEmailChange(event) {
    const nextEmail = event.target.value
    setEmail(nextEmail)

    if (emailTouched) {
      validateEmailOnBlur(nextEmail)
    }
  }

  function handleEmailBlur() {
    setEmailTouched(true)
    validateEmailOnBlur(email)
  }

  function handleForgotOpen() {
    setForgotEmail(email.trim())
    setForgotStatus('idle')
    setForgotError('')
    setForgotOpen(true)
    trackAuthEvent('forgot_password_clicked', {
      source: 'login_form',
    })
  }

  function handleForgotClose() {
    setForgotOpen(false)
    setForgotStatus('idle')
    setForgotError('')
  }

  async function handleForgotSubmit(event) {
    event.preventDefault()

    const targetEmail = forgotEmail.trim()
    if (!isValidEmail(targetEmail)) {
      setForgotError('Enter a valid work email address.')
      return
    }

    setForgotStatus('loading')
    setForgotError('')

    const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
      redirectTo: `${window.location.origin}/create-password`,
    })

    if (error) {
      setForgotStatus('error')
      setForgotError('Unable to send reset link right now. Please try again.')
      return
    }

    setForgotStatus('sent')
  }

  async function handleLogin(event) {
    event.preventDefault()

    if (!canAttemptLogin) {
      return
    }

    if (emailTouched && emailError) {
      return
    }

    const normalizedEmail = email.trim()

    setStatus('loading')
    setAuthAlert(null)

    const recaptchaToken = await getRecaptchaToken(failedAttempts)

    trackAuthEvent('login_attempted', {
      csrf_token_present: Boolean(csrfToken),
      recaptcha_token_present: Boolean(recaptchaToken),
      email_domain: normalizedEmail.includes('@') ? normalizedEmail.split('@')[1] : '',
      failure_count_before_attempt: failedAttempts,
    })

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })

    if (error) {
      const classification = classifyAuthError(error)
      const retryInSeconds = parseRetryAfterSeconds(error)
      const presentation = getErrorPresentation(classification, retryInSeconds)

      if (classification === 'rate_limit') {
        setRateLimitUntil(Date.now() + retryInSeconds * 1000)
      }

      setFailedAttempts((value) => value + 1)
      setStatus('error')
      setAuthAlert(presentation)
      setCsrfToken(createFormToken())

      trackAuthEvent('login_failed', {
        reason_code: presentation.reasonCode,
        supabase_status: error.status ?? '',
        recaptcha_token_present: Boolean(recaptchaToken),
      })
      return
    }

    setStatus('idle')
    setFailedAttempts(0)
    setCsrfToken(createFormToken())
    localStorage.setItem('last_login_at', new Date().toISOString())

    trackAuthEvent('login_succeeded', {
      recaptcha_token_present: Boolean(recaptchaToken),
    })

    // Redirect to the page the user originally intended to visit, or default
    // to the dashboard if they navigated to /login directly.
    const intendedPath = location.state?.from?.pathname || workspaceRoutes.home
    navigate(intendedPath, { replace: true })
  }

  return (
    <div className={shared.authPage}>
      <nav className={shared.navbar}>
        <Link to="/" className={shared.navLogo}>AkountSmart</Link>
        <div className={shared.navRight}>
          <Link to="/" className={shared.navBackLink}>Back to Home</Link>
        </div>
      </nav>

      <div className={s.body}>
        <div className={s.card}>
          <div className={s.leftPanel} aria-labelledby={leftHeadingId} aria-describedby={leftDescId}>
            <div className={s.blob} aria-hidden="true">
              <BlobIllustration />
            </div>

            <div className={s.leftContent}>
              <span className={s.securityTag} aria-hidden="true">Security First</span>
              <h2 className={s.leftHeading} id={leftHeadingId}>
                Precision in<br />
                <span className={s.leftHeadingAccent}>Every Ledger.</span>
              </h2>
              <p className={s.leftDesc} id={leftDescId}>
                Access your architectural dashboard and manage complex financial
                data with clinical accuracy and AI-driven insights.
              </p>
            </div>

            <div className={s.securityBadgeWrap}>
              <button
                type="button"
                className={s.securityBadge}
                aria-expanded={securityTooltipOpen}
                aria-controls={securityTooltipId}
                onClick={() => setSecurityTooltipOpen((value) => !value)}
              >
                <div className={s.badgeIcon} aria-hidden="true">
                  <ShieldIcon />
                </div>
                <div>
                  <div className={s.badgeTitle}>Bank-Level Security</div>
                  <div className={s.badgeSubtitle}>256-bit AES Encryption Enabled</div>
                </div>
              </button>
              <p
                className={`${s.securityTooltip} ${securityTooltipOpen ? s.securityTooltipOpen : ''}`}
                id={securityTooltipId}
                role="status"
              >
                Security controls include AES-256 encryption in transit and at rest, strict key rotation, and audited access policies.
              </p>
            </div>
          </div>

          <div className={s.rightPanel}>
            <h1 className={s.formTitle}>Welcome Back</h1>
            <p className={s.formSubtitle}>Enter your credentials to manage your smart ledger.</p>

            <form onSubmit={handleLogin}>
              <input type="hidden" name="csrf_token" value={csrfToken} />

              <div className={s.fieldGroup}>
                <label className={shared.label} htmlFor={emailInputId}>Email</label>
                <div className={shared.inputWrap}>
                  <input
                    ref={emailInputRef}
                    id={emailInputId}
                    className={shared.input}
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={handleEmailChange}
                    onBlur={handleEmailBlur}
                    onInvalid={handleEmailInvalid}
                    required
                    autoComplete="email"
                    aria-label="Email"
                    aria-invalid={Boolean(emailError)}
                    aria-describedby={emailDescribedBy}
                    style={{ paddingRight: '44px' }}
                  />
                  <span className={shared.inputIcon} aria-hidden="true"><AtIcon /></span>
                </div>
                {emailError ? (
                  <p className={s.fieldError} id={emailErrorId} role="alert">
                    {emailError}
                  </p>
                ) : null}
              </div>

              <div className={s.fieldGroup}>
                <div className={s.forgotRow}>
                  <label className={shared.label} htmlFor={passwordInputId} style={{ margin: 0 }}>Password</label>
                  <button type="button" className={s.forgotLink} onClick={handleForgotOpen}>
                    Forgot Password?
                  </button>
                </div>
                <div className={shared.inputWrap}>
                  <input
                    id={passwordInputId}
                    className={shared.input}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="********"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    autoComplete="current-password"
                    aria-label="Password"
                    aria-describedby={passwordDescribedBy}
                    style={{ paddingRight: '52px' }}
                  />
                  <button
                    type="button"
                    className={shared.inputIconButton}
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
                <p className={s.fieldHint} id={passwordHintId}>
                  Use your AkountSmart account password.
                </p>

                {showPasswordStrength ? (
                  <div className={s.passwordStrength} aria-live="polite">
                    <div className={s.passwordStrengthBar}>
                      <span
                        className={`${s.passwordStrengthFill} ${s[`passwordStrength${passwordStrength.tone}`]}`}
                        style={{ width: `${Math.max(20, passwordStrength.score * 25)}%` }}
                      />
                    </div>
                    <p className={s.passwordStrengthText}>
                      Password strength: {passwordStrength.label}
                    </p>
                  </div>
                ) : null}
              </div>

              {authAlert ? (
                <div id={authAlertId} className={`${s.alert} ${getAlertClassName(authAlert.tone)}`} role="alert">
                  <p className={s.alertTitle}>{authAlert.title}</p>
                  <p className={s.alertBody}>{authAlert.message}</p>
                </div>
              ) : null}

              {failedAttempts >= RECAPTCHA_ESCALATION_THRESHOLD ? (
                <p className={s.securityInfo} aria-live="polite">
                  Additional bot protection is enabled for repeated sign-in attempts.
                </p>
              ) : null}

              <button
                type="submit"
                className={shared.primaryBtn}
                disabled={!canAttemptLogin}
                aria-busy={status === 'loading'}
                style={{ marginTop: '24px' }}
              >
                {status === 'loading' ? (
                  <>
                    <span className={s.spinner} aria-hidden="true" />
                    Signing in...
                  </>
                ) : cooldownSeconds > 0 ? (
                  `Try again in ${cooldownSeconds}s`
                ) : (
                  'Sign into AkountSmart ->'
                )}
              </button>
            </form>

            <p className={s.signupRow}>
              Don't have an account?
              <Link to="/signup" className={s.signupLink}>Create an account</Link>
            </p>
          </div>
        </div>
      </div>

      {forgotOpen ? (
        <>
          <div
            className={`${s.forgotBackdrop} ${s.forgotBackdropOpen}`}
            onClick={handleForgotClose}
            aria-hidden="true"
          />

          <aside
            className={`${s.forgotModal} ${s.forgotModalOpen}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={forgotTitleId}
            aria-describedby={forgotDescId}
          >
            <div className={s.forgotHeader}>
              <h2 id={forgotTitleId}>Reset your password</h2>
              <button type="button" className={s.forgotClose} onClick={handleForgotClose} aria-label="Close forgot password panel">
                <span aria-hidden="true">x</span>
              </button>
            </div>
            <p className={s.forgotText} id={forgotDescId}>
              Enter your work email and we will send a secure reset link without leaving this login flow.
            </p>

            {forgotStatus === 'sent' ? (
              <div className={`${s.alert} ${s.alertInfo}`} role="status">
                <p className={s.alertTitle}>Reset email sent</p>
                <p className={s.alertBody}>Check your inbox for the password reset link.</p>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className={s.forgotForm}>
                <label className={shared.label} htmlFor={forgotEmailInputId}>Email</label>
                <input
                  ref={forgotEmailInputRef}
                  id={forgotEmailInputId}
                  type="email"
                  className={shared.input}
                  placeholder="name@company.com"
                  value={forgotEmail}
                  onChange={(event) => setForgotEmail(event.target.value)}
                  required
                  autoComplete="email"
                  aria-label="Email for password reset"
                  aria-describedby={forgotError ? forgotErrorId : undefined}
                />

                {forgotError ? (
                  <p className={s.fieldError} id={forgotErrorId} role="alert">
                    {forgotError}
                  </p>
                ) : null}

                <button type="submit" className={shared.primaryBtn} disabled={forgotStatus === 'loading'} aria-busy={forgotStatus === 'loading'}>
                  {forgotStatus === 'loading' ? (
                    <>
                      <span className={s.spinner} aria-hidden="true" />
                      Sending...
                    </>
                  ) : (
                    'Send reset link'
                  )}
                </button>
              </form>
            )}
          </aside>
        </>
      ) : null}

      <footer className={shared.footer}>
        <div className={shared.footerLeft}>
          <span className={shared.footerLogo}>AkountSmart</span>
          <span className={shared.footerCopy}>© 2024 AkountSmart. Precision in every ledger.</span>
          <span className={shared.footerTagline}>High-end financial toolkit for modern auditors.</span>
        </div>
        <div className={shared.footerLinks}>
          <a href="#" className={shared.footerLink}>Privacy Policy</a>
          <a href="#" className={shared.footerLink}>Terms of Service</a>
          <a href="#" className={shared.footerLink}>Security</a>
          <a href="#" className={shared.footerLink}>Support</a>
        </div>
      </footer>
    </div>
  )
}
