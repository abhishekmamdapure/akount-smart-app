import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import shared from './auth.module.css'
import s from './OtpPage.module.css'

function OtpBoxes({ value, onChange }) {
  const inputs = useRef([])

  function handleChange(idx, e) {
    const val = e.target.value.replace(/\D/g, '').slice(-1)
    const next = value.split('')
    next[idx] = val
    onChange(next.join(''))
    if (val && idx < 5) inputs.current[idx + 1]?.focus()
  }

  function handleKeyDown(idx, e) {
    if (e.key === 'Backspace' && !value[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus()
    }
  }

  function handlePaste(e) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onChange(pasted.padEnd(6, ''))
    inputs.current[Math.min(pasted.length, 5)]?.focus()
    e.preventDefault()
  }

  return (
    <div className={s.otpBoxes}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={el => inputs.current[i] = el}
          className={s.otpInput}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ''}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
        />
      ))}
    </div>
  )
}

export default function OtpPage() {
  const navigate = useNavigate()
  const email = sessionStorage.getItem('signup_email') || ''
  const [emailOtp, setEmailOtp] = useState('')
  const [status, setStatus] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleVerify(e) {
    e.preventDefault()
    if (emailOtp.length < 6) {
      setErrorMsg('Please enter the complete 6-digit code.')
      return
    }
    setStatus('loading')
    setErrorMsg('')

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: emailOtp,
      type: 'signup',
    })

    if (error) {
      setStatus('error')
      setErrorMsg(error.message)
    } else {
      navigate('/create-password')
    }
  }

  async function handleResend() {
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    if (!error) setErrorMsg('') // clear any old errors
  }

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
          <div className={s.shieldWrap}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
          </div>

          <h1 className={s.title}>Two-Step Verification</h1>
          <p className={s.subtitle}>
            We've sent a 6-digit code to your email{email ? ` (${email})` : ''}. Please enter it below to proceed.
          </p>

          <form onSubmit={handleVerify}>
            <div className={s.otpSection}>
              <div className={s.otpLabel}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                Email OTP
              </div>
              <OtpBoxes value={emailOtp} onChange={setEmailOtp} />
            </div>

            {/* Note: Mobile OTP requires Twilio/SMS setup in Supabase */}
            <div className={s.otpSection} style={{ opacity: 0.4 }}>
              <div className={s.otpLabel}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                  <line x1="12" y1="18" x2="12.01" y2="18" />
                </svg>
                Mobile OTP
                <span style={{ fontSize: '10px', color: '#94a3b8', marginLeft: 4 }}>(requires SMS setup)</span>
              </div>
              <OtpBoxes value="" onChange={() => {}} />
            </div>

            {errorMsg && <p className={shared.errorMsg} style={{ textAlign: 'center' }}>{errorMsg}</p>}

            <button type="submit" className={shared.primaryBtn} disabled={status === 'loading'} style={{ marginTop: '8px' }}>
              {status === 'loading' ? 'Verifying...' : 'Verify and Continue'}
            </button>
          </form>

          <p className={s.resendRow}>
            Didn't receive the codes?{' '}
            <button className={s.resendLink} onClick={handleResend} type="button">
              Resend codes
            </button>
          </p>

          <div className={s.trustRow}>
            <span className={s.trustItem}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              End-to-end encrypted
            </span>
            <span className={s.trustItem}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              Secure verification
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
