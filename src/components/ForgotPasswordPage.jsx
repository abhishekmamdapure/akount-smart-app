import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import shared from './auth.module.css'
import s from './ForgotPasswordPage.module.css'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | sent | error
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/create-password`,
    })

    if (error) {
      setStatus('error')
      setErrorMsg(error.message)
    } else {
      setStatus('sent')
    }
  }

  return (
    <div className={shared.authPage}>
      <div className={s.body}>
        <div className={s.logoWrap}>
          <div className={s.logoIcon}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6" />
              <path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
              <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
            </svg>
          </div>
          <span className={s.logoText}>AkountSmart</span>
        </div>

        <div className={s.card}>
          {status === 'sent' ? (
            <>
              <h1 className={s.title}>Check your email</h1>
              <p className={s.subtitle}>
                We've sent a password reset link to <strong>{email}</strong>. Check your inbox and click the link to continue.
              </p>
              <Link to="/login" className={s.backLink}>
                ← Back to Login
              </Link>
            </>
          ) : (
            <>
              <h1 className={s.title}>Reset your password</h1>
              <p className={s.subtitle}>
                Enter your work email and we'll send you a link to reset your password.
              </p>

              <form onSubmit={handleSubmit}>
                <div className={s.fieldGroup}>
                  <label className={shared.label}>Work Email</label>
                  <input
                    className={shared.input}
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>

                {errorMsg && <p className={shared.errorMsg}>{errorMsg}</p>}

                <button
                  type="submit"
                  className={shared.primaryBtn}
                  disabled={status === 'loading'}
                  style={{ marginTop: '8px' }}
                >
                  {status === 'loading' ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>

              <Link to="/login" className={s.backLink}>← Back to Login</Link>
            </>
          )}
        </div>

        <div className={s.trustRow}>
          <span className={s.trustItem}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            Bank-Grade Security
          </span>
          <span className={s.trustItem}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            SOC2 Compliant
          </span>
        </div>
      </div>

      <footer className={shared.footer}>
        <span className={shared.footerCopy}>© 2024 AkountSmart Financial Systems. All rights reserved.</span>
        <div className={shared.footerLinks}>
          <a href="#" className={shared.footerLink}>Privacy Policy</a>
          <a href="#" className={shared.footerLink}>Terms of Service</a>
          <a href="#" className={shared.footerLink}>Compliance</a>
          <a href="#" className={shared.footerLink}>Support</a>
        </div>
      </footer>
    </div>
  )
}
