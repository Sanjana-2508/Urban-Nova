import { useState } from 'react'
import { ArrowRight, Recycle, ShieldCheck } from 'lucide-react'
import { login, register } from './services/auth'
import type { AuthenticatedUser } from './services/auth'
import './AuthPage.css'

type AuthPageProps = {
  onLogin: (user: AuthenticatedUser) => void
}

export default function AuthPage({ onLogin }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'signup') {
        await register(name.trim(), email.trim(), password)
      }

      const user = await login(email.trim(), password)
      onLogin(user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-glow auth-glow-one" />
      <div className="auth-glow auth-glow-two" />

      <header className="auth-brand">
        <div className="auth-logo">
          <Recycle size={27} />
        </div>
        <div>
          <strong>UrbanNova</strong>
          <span>SMART CITY OPERATIONS</span>
        </div>
      </header>

      <section className="auth-layout">
        <div className="auth-intro">
          <div className="auth-orbit">
            <div className="auth-orbit-ring" />
            <div className="auth-orbit-ring auth-orbit-ring-two" />
            <div className="auth-orbit-core">
              <Recycle size={62} strokeWidth={1.3} />
            </div>
            <span className="auth-orbit-dot" />
          </div>

          <div className="auth-kicker">
            <span /> A SMARTER WAY FORWARD
          </div>
          <h1>Cleaner cities.<br /><span>Smarter futures.</span></h1>
          <p>
            A unified command centre for smarter waste collection,
            cleaner neighbourhoods and community action.
          </p>

          <div className="auth-proof">
            <span><ShieldCheck size={16} /> Responsible operations</span>
            <span><Recycle size={16} /> Sustainable impact</span>
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-card-heading">
            <span className="auth-eyebrow">WELCOME TO URBANNOVA</span>
            <h2>{mode === 'login' ? 'Good to have you back.' : 'Create your account.'}</h2>
            <p>
              {mode === 'login'
                ? 'Sign in to open your role-specific workspace.'
                : 'Create a citizen account and join your community.'}
            </p>
          </div>

          <div className="auth-access-note">
            <ShieldCheck size={17} />
            <p>
              <strong>Authorized role access</strong>
              <span>
                Public registration is for Citizens only. Collector and Admin
                accounts are created or authorized by an Admin.
              </span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {mode === 'signup' && (
              <label>
                Full name
                <input
                  value={name}
                  onChange={event => setName(event.target.value)}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  required
                />
              </label>
            )}

            <label>
              Email address
              <input
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder=  "Enter your password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={8}
                required
              />
            </label>
            {error && <p className="auth-error" role="alert">{error}</p>}

            <button className="auth-submit" type="submit" disabled={loading}>
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign in to UrbanNova' : 'Create account'}
              <ArrowRight size={18} />
            </button>
          </form>

          <div className="auth-switch">
            {mode === 'login' ? "Don't have an account?" : 'Already registered?'}
            <button
              type="button"
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </div>

          <p className="auth-security">
            <ShieldCheck size={14} /> Secure access for a cleaner tomorrow
          </p>
        </div>
      </section>

      <footer className="auth-footer">
        <span>URBANNOVA © 2026</span>
        <span>DESIGNED FOR BETTER CITIES</span>
      </footer>
    </main>
  )
}
