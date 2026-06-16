import React, { useState } from 'react'

export default function Auth({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const url = isLogin ? '/api/auth/login/' : '/api/auth/register/'
    const body = isLogin 
      ? JSON.stringify({ username, password })
      : JSON.stringify({ username, email, password })

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body,
      })

      const data = await res.json()

      if (res.ok) {
        if (isLogin) {
          // data contains { token }
          localStorage.setItem('token', data.token)
          localStorage.setItem('username', username)
          onLoginSuccess(data.token, username)
        } else {
          // Register success, auto login
          setIsLogin(true)
          setEmail('')
          setPassword('')
          setError('Registration successful! Please login.')
        }
      } else {
        // Handle error output
        if (data.non_field_errors) {
          setError(data.non_field_errors.join(' '))
        } else if (data.username) {
          setError(`Username: ${data.username.join(' ')}`)
        } else if (data.email) {
          setError(`Email: ${data.email.join(' ')}`)
        } else if (data.password) {
          setError(`Password: ${data.password.join(' ')}`)
        } else {
          setError(data.detail || 'An error occurred. Please try again.')
        }
      }
    } catch (err) {
      setError('Connection failed. Please ensure the backend is running.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card glass-card">
        <div className="auth-header">
          <span className="auth-logo">💪</span>
          <h1>AuraFit</h1>
          <p>{isLogin ? 'Sign in to track fitness & pantry' : 'Create an account to start tracking'}</p>
        </div>

        {error && <div className={`auth-message ${error.includes('successful') ? 'success' : 'error'}`}>{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          {!isLogin && (
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary w-full">
            {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="auth-toggle">
          <button onClick={() => setIsLogin(!isLogin)} className="toggle-btn">
            {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Login'}
          </button>
        </div>
      </div>

      <style>{`
        .auth-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          width: 100%;
          padding: 20px;
        }

        .auth-card {
          width: 100%;
          max-width: 440px;
          padding: 40px 32px;
        }

        .auth-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .auth-logo {
          font-size: 3rem;
          display: inline-block;
          margin-bottom: 12px;
        }

        .auth-message {
          padding: 12px;
          border-radius: 8px;
          font-size: 0.9rem;
          margin-bottom: 20px;
          text-align: center;
        }

        .auth-message.error {
          background: rgba(239, 68, 68, 0.15);
          color: #fca5a5;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .auth-message.success {
          background: rgba(16, 185, 129, 0.15);
          color: #a7f3d0;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .auth-form {
          margin-bottom: 24px;
        }

        .w-full {
          width: 100%;
        }

        .auth-toggle {
          text-align: center;
        }

        .toggle-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-family: var(--font-family);
          cursor: pointer;
          font-size: 0.9rem;
          transition: var(--transition-smooth);
        }

        .toggle-btn:hover {
          color: var(--primary);
          text-decoration: underline;
        }
      `}</style>
    </div>
  )
}
