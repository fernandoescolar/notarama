import { useEffect, useState } from 'react'
import { api, setCsrfToken, UnauthorizedError } from '../../lib/api'
import type { Me } from '../../lib/types'
import { startSyncLoop } from '../../lib/sync'

type AuthState = { status: 'loading' } | { status: 'authenticated'; me: Me } | { status: 'redirecting' }

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    api
      .me()
      .then((me) => {
        if (cancelled) return
        setCsrfToken(me.csrfToken)
        startSyncLoop()
        setState({ status: 'authenticated', me })
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof UnauthorizedError) {
          setState({ status: 'redirecting' })
          window.location.href = '/auth/login'
          return
        }
        // Offline on first load with no session cookie info available yet —
        // treat the same as needing to log in once connectivity returns.
        setState({ status: 'redirecting' })
        window.location.href = '/auth/login'
      })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
