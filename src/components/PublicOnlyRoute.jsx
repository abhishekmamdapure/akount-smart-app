import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { workspaceRoutes } from '../workspaceRoutes'

/**
 * A route guard for public-only pages (login, signup, etc.).
 *
 * If the user already has an active Supabase session they are redirected
 * straight to the dashboard instead of showing the auth form again.
 */
export default function PublicOnlyRoute({ children }) {
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

  // Still resolving – show nothing (or a quick flash)
  if (session === undefined) {
    return null
  }

  // Already logged in → send them to dashboard
  if (session) {
    return <Navigate to={workspaceRoutes.home} replace />
  }

  return children
}
