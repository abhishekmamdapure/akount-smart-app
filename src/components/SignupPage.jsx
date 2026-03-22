import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import shared from './auth.module.css'
import s from './SignupPage.module.css'

const INDIAN_STATES = [
  'Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal',
]

const ROLES = [
  'Chartered Accountant (CA)',
  'Tax Consultant',
  'Accountant',
  'Auditor',
  'Finance Manager',
  'CFO / Finance Director',
  'Student',
  'Other',
]

export default function SignupPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    fullName: '', email: '', role: '', phone: '', state: '', city: '', agreed: false,
  })
  const [status, setStatus] = useState('idle')
  const [errorMsg, setErrorMsg] = useState('')

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.agreed) {
      setErrorMsg('Please agree to the Terms of Service and Privacy Policy.')
      return
    }
    setStatus('loading')
    setErrorMsg('')

    // Sign up with Supabase — this triggers email OTP confirmation
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: crypto.randomUUID(), // temporary password — user sets it on create-password page
      options: {
        data: {
          full_name: form.fullName,
          role: form.role,
          phone: form.phone,
          state: form.state,
          city: form.city,
        },
        emailRedirectTo: `${window.location.origin}/verify-otp`,
      },
    })

    if (error) {
      setStatus('error')
      setErrorMsg(error.message)
    } else {
      // Pass email to OTP page via sessionStorage so user can verify
      sessionStorage.setItem('signup_email', form.email)
      navigate('/verify-otp')
    }
  }

  return (
    <div className={shared.authPage}>
      {/* Navbar */}
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
          <h1 className={s.title}>Create your account</h1>
          <p className={s.subtitle}>
            Already have an account?{' '}
            <Link to="/login" className={s.signInLink}>Sign in</Link>
          </p>

          <form onSubmit={handleSubmit}>
            <div className={s.fieldGroup}>
              <label className={shared.label}>Full Name</label>
              <input
                className={shared.input}
                type="text"
                placeholder="Johnathan Doe"
                value={form.fullName}
                onChange={e => update('fullName', e.target.value)}
                required
              />
            </div>

            <div className={s.fieldGroup}>
              <label className={shared.label}>Email Address</label>
              <input
                className={shared.input}
                type="email"
                placeholder="j.doe@company.com"
                value={form.email}
                onChange={e => update('email', e.target.value)}
                required
              />
            </div>

            <div className={s.row}>
              <div>
                <label className={shared.label}>Professional Role</label>
                <select
                  className={s.select}
                  value={form.role}
                  onChange={e => update('role', e.target.value)}
                  required
                >
                  <option value="">Select Role</option>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className={shared.label}>Mobile Number</label>
                <div className={s.phoneWrap}>
                  <span className={s.phonePrefix}>+91</span>
                  <input
                    className={s.phoneInput}
                    type="tel"
                    placeholder="9876543210"
                    value={form.phone}
                    onChange={e => update('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                  />
                </div>
              </div>
            </div>

            <div className={s.row}>
              <div>
                <label className={shared.label}>State</label>
                <select
                  className={s.select}
                  value={form.state}
                  onChange={e => update('state', e.target.value)}
                >
                  <option value="">Select State</option>
                  {INDIAN_STATES.map(st => <option key={st} value={st}>{st}</option>)}
                </select>
              </div>
              <div>
                <label className={shared.label}>City</label>
                <input
                  className={shared.input}
                  type="text"
                  placeholder="e.g. Mumbai"
                  value={form.city}
                  onChange={e => update('city', e.target.value)}
                />
              </div>
            </div>

            <div className={s.checkRow}>
              <input
                type="checkbox"
                className={s.checkbox}
                id="terms"
                checked={form.agreed}
                onChange={e => update('agreed', e.target.checked)}
              />
              <label htmlFor="terms" className={s.checkLabel}>
                I agree to the <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
              </label>
            </div>

            {errorMsg && <p className={shared.errorMsg}>{errorMsg}</p>}

            <button type="submit" className={shared.primaryBtn} disabled={status === 'loading'}>
              {status === 'loading' ? 'Please wait...' : 'Continue to Verification'}
            </button>
          </form>

          <p className={s.disclaimer}>
            By continuing, you agree to receive automated SMS messages for identity verification
            and account security.
          </p>

          <div className={s.trustBadges}>
            <div className={s.trustBadge} />
            <div className={s.trustBadge} />
            <div className={s.trustBadge} />
          </div>
        </div>
      </div>

      <footer className={shared.footer}>
        <span className={shared.footerCopy}>© 2024 AkountSmart Financial. All rights reserved.</span>
        <div className={shared.footerLinks}>
          <a href="#" className={shared.footerLink}>Privacy Policy</a>
          <a href="#" className={shared.footerLink}>Terms of Service</a>
          <a href="#" className={shared.footerLink}>Cookie Settings</a>
        </div>
      </footer>
    </div>
  )
}
