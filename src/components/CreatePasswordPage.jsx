import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import shared from './auth.module.css'
import s from './CreatePasswordPage.module.css'

function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function checkRules(password) {
  return {
    length: password.length >= 8,
    letter: /[a-zA-Z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[!@#$%^&*]/.test(password),
  }
}

export default function CreatePasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [status, setStatus] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const rules = checkRules(password)
  const allRulesPassed = Object.values(rules).every(Boolean)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!allRulesPassed) {
      setErrorMsg('Password does not meet the requirements.')
      return
    }
    if (password !== confirm) {
      setErrorMsg('Passwords do not match.')
      return
    }
    setStatus('loading')
    setErrorMsg('')

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setStatus('error')
      setErrorMsg(error.message)
    } else {
      // Clear signup session data
      sessionStorage.removeItem('signup_email')
      navigate('/dashboard') // change to your post-registration route
    }
  }

  const RULES = [
    { key: 'length', label: 'At least 8 characters long' },
    { key: 'letter', label: 'At least one letter (A-Z)' },
    { key: 'number', label: 'At least one number (0-9)' },
    { key: 'symbol', label: 'At least one symbol (!@#$%^&*)' },
  ]

  return (
    <div className={shared.authPage}>
      <nav className={shared.navbar}>
        <Link to="/" className={shared.navLogo}>AkountSmart</Link>
        <div className={shared.navCenter}>
          <a href="#" className={shared.navLink}>Support</a>
          <a href="#" className={shared.navLink}>Security</a>
        </div>
        <div className={shared.navRight}>
          <Link to="/" className={shared.navBackLink}>Back to Home</Link>
          <Link to="/login" className={shared.navBtn}>Login</Link>
        </div>
      </nav>

      <div className={s.body}>
        <div className={s.card}>
          {/* Progress bar — 3 steps: signup, verify, password */}
          <div className={s.progressBar}>
            <div className={`${s.progressStep} ${s.active}`} />
            <div className={`${s.progressStep} ${s.active}`} />
            <div className={`${s.progressStep} ${s.active}`} />
          </div>

          <h1 className={s.title}>Secure Your Account</h1>
          <p className={s.subtitle}>
            Please set a strong password to complete your professional registration.
          </p>

          <form onSubmit={handleSubmit}>
            <div className={s.fieldGroup}>
              <label className={shared.label}>New Password</label>
              <div className={shared.inputWrap}>
                <input
                  className={shared.input}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{ paddingRight: '44px' }}
                />
                <span className={shared.inputIcon} onClick={() => setShowPassword(v => !v)}>
                  <EyeIcon open={showPassword} />
                </span>
              </div>
            </div>

            <div className={s.fieldGroup}>
              <label className={shared.label}>Confirm Password</label>
              <div className={shared.inputWrap}>
                <input
                  className={shared.input}
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  style={{ paddingRight: '44px' }}
                />
                <span className={shared.inputIcon} onClick={() => setShowConfirm(v => !v)}>
                  <EyeIcon open={showConfirm} />
                </span>
              </div>
            </div>

            <div className={s.rulesBox}>
              <div className={s.rulesTitle}>Password must include:</div>
              {RULES.map(rule => (
                <div key={rule.key} className={s.ruleItem}>
                  <div className={`${s.ruleIcon} ${rules[rule.key] ? s.pass : ''}`}>
                    {rules[rule.key] && <CheckIcon />}
                  </div>
                  {rule.label}
                </div>
              ))}
            </div>

            {errorMsg && <p className={shared.errorMsg}>{errorMsg}</p>}

            <button
              type="submit"
              className={shared.primaryBtn}
              disabled={status === 'loading'}
            >
              {status === 'loading' ? 'Completing registration...' : 'Complete Registration'}
            </button>
          </form>

          <p className={s.disclaimer}>
            By completing registration, you agree to our <a href="#">Terms of Use</a>
          </p>

          <div className={s.trustRow}>
            <span className={s.trustItem}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              256-bit Encryption
            </span>
            <span className={s.trustItem}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              Secured by AkountSmart
            </span>
          </div>
        </div>
      </div>

      <footer className={shared.footer}>
        <span className={shared.footerLogo}>AkountSmart</span>
        <div className={shared.footerLinks}>
          <a href="#" className={shared.footerLink}>Privacy Policy</a>
          <a href="#" className={shared.footerLink}>Terms of Service</a>
          <a href="#" className={shared.footerLink}>Cookie Settings</a>
        </div>
        <span className={shared.footerCopy}>© 2024 AkountSmart Financial. All rights reserved.</span>
      </footer>
    </div>
  )
}
