import { useEffect, useState } from 'react'
import { Recycle } from 'lucide-react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom'
import DashboardPage from './DashboardPage'
import AuthPage from './AuthPage'
import './App.css'
import { ApiError, apiRequest } from './services/api'
import {
  logout,
  type AuthenticatedUser,
} from './services/auth'

type AuthStatus = 'restoring' | 'authenticated' | 'unauthenticated' | 'error'

function AuthRoute({
  onAuthenticated,
}: {
  onAuthenticated: (user: AuthenticatedUser) => void
}) {
  const navigate = useNavigate()

  function handleLogin(user: AuthenticatedUser) {
    onAuthenticated(user)
    navigate('/dashboard', { replace: true })
  }

  return <AuthPage onLogin={handleLogin} />
}

function SessionLoading() {
  return (
    <main className="auth-page auth-session-message" aria-live="polite">
      <div className="auth-brand">
        <div className="auth-logo"><Recycle size={27} /></div>
        <div>
          <strong>UrbanNova</strong>
          <span>SMART CITY OPERATIONS</span>
        </div>
      </div>
      <p>Restoring your secure session…</p>
    </main>
  )
}

function SessionRestoreError({
  message,
  onRetry,
  onSignIn,
}: {
  message: string
  onRetry: () => void
  onSignIn: () => void
}) {
  return (
    <main className="auth-page auth-session-message">
      <div className="auth-brand">
        <div className="auth-logo"><Recycle size={27} /></div>
        <div>
          <strong>UrbanNova</strong>
          <span>SMART CITY OPERATIONS</span>
        </div>
      </div>
      <section className="auth-session-card" role="alert">
        <h1>Could not restore your session.</h1>
        <p>{message}</p>
        <div>
          <button className="auth-submit" onClick={onRetry}>Try again</button>
          <button className="auth-session-signin" onClick={onSignIn}>
            Return to sign in
          </button>
        </div>
      </section>
    </main>
  )
}

function App() {
  const [user, setUser] = useState<AuthenticatedUser | null>(null)
  const [authStatus, setAuthStatus] = useState<AuthStatus>(() =>
    sessionStorage.getItem('urbannova-token')
      ? 'restoring'
      : 'unauthenticated',
  )
  const [restoreError, setRestoreError] = useState('')
  const [restoreAttempt, setRestoreAttempt] = useState(0)

  useEffect(() => {
    let active = true
    const token = sessionStorage.getItem('urbannova-token')

    if (!token) {
      setUser(null)
      setAuthStatus('unauthenticated')
      return () => {
        active = false
      }
    }

    setAuthStatus('restoring')
    setRestoreError('')

    apiRequest<AuthenticatedUser>('/api/auth/me')
      .then((authenticatedUser) => {
        if (active) {
          setUser(authenticatedUser)
          setAuthStatus('authenticated')
        }
      })
      .catch((error: unknown) => {
        if (!active) return

        if (error instanceof ApiError && error.status === 401) {
          logout()
          setUser(null)
          setAuthStatus('unauthenticated')
          return
        }

        setRestoreError(
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred while checking your session.',
        )
        setAuthStatus('error')
      })

    return () => {
      active = false
    }
  }, [restoreAttempt])

  function handleAuthenticated(authenticatedUser: AuthenticatedUser) {
    setUser(authenticatedUser)
    setAuthStatus('authenticated')
    setRestoreError('')
  }

  function handleSignedOut() {
    logout()
    setUser(null)
    setAuthStatus('unauthenticated')
  }

  function retrySessionRestore() {
    setAuthStatus('restoring')
    setRestoreAttempt((attempt) => attempt + 1)
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            authStatus === 'restoring' ? (
              <SessionLoading />
            ) : authStatus === 'error' ? (
              <SessionRestoreError
                message={restoreError}
                onRetry={retrySessionRestore}
                onSignIn={handleSignedOut}
              />
            ) : authStatus === 'authenticated' ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <AuthRoute onAuthenticated={handleAuthenticated} />
            )
          }
        />
        <Route
          path="*"
          element={
            authStatus === 'restoring' ? (
              <SessionLoading />
            ) : authStatus === 'error' ? (
              <SessionRestoreError
                message={restoreError}
                onRetry={retrySessionRestore}
                onSignIn={handleSignedOut}
              />
            ) : authStatus === 'authenticated' && user ? (
              <DashboardPage user={user} onLogout={handleSignedOut} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
