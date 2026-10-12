
import { useState } from 'react'
import { ArrowRight, Recycle, ShieldCheck, UserRound } from 'lucide-react'
import './AuthPage.css'

type AuthPageProps = {
  onLogin: (role: 'citizen' | 'admin') => void
}

export default function AuthPage({ onLogin }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [role, setRole] = useState<'citizen' | 'admin'>('citizen')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (mode === 'signup' && role === 'admin') {
      alert('Administrator accounts must be provisioned by the municipality.')
      return
    }

    if (!email.trim() || !password.trim()) return
    if (mode === 'signup' && !name.trim()) return

    // Demo-only navigation. Real authentication will be added with the backend.
    onLogin(role)
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
                ? 'Sign in to access your workspace.'
                : 'Join the movement for cleaner cities.'}
            </p>
          </div>

          <div className="auth-role-picker">
            <button
              type="button"
              className={role === 'citizen' ? 'auth-role active' : 'auth-role'}
              onClick={() => setRole('citizen')}
            >
              <UserRound size={18} />
              <span>Citizen</span>
            </button>
            <button
              type="button"
              className={role === 'admin' ? 'auth-role active' : 'auth-role'}
              onClick={() => setRole('admin')}
            >
              <ShieldCheck size={18} />
              <span>Municipal Admin</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {mode === 'signup' && role === 'citizen' && (
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
                placeholder="Enter your password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={8}
                required
              />
            </label>

            <button className="auth-submit" type="submit">
              {mode === 'login' ? 'Sign in to UrbanNova' : 'Create account'}
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
