import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../supabase'

/**
 * A route guard that requires an active Supabase session.
 *
 * - While the session is being resolved it shows a minimal loading indicator.
 * - If no session exists the user is redirected to /login with the intended
 *   destination preserved in `state.from` so the LoginPage can redirect back
 *   after a successful sign-in.
 * - Once authenticated it renders its children.
 */
export default function ProtectedRoute({ children }) {
  const location = useLocation()
  const [session, setSession] = useState(undefined) // undefined = loading

  useEffect(() => {
    let isMounted = true

    async function checkSession() {
      const { data } = await supabase.auth.getSession()

      if (isMounted) {
        setSession(data.session)
      }
    }

    checkSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (isMounted) {
        setSession(newSession)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Still resolving the session – show a subtle full-page loader
  if (session === undefined) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          width: '100vw',
          background: '#0f1117',
          color: '#888',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '14px',
          letterSpacing: '0.02em',
        }}
      >
        Verifying session…
      </div>
    )
  }

  // No active session → redirect to /login preserving the intended URL
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}
