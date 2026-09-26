import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const resp = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error || 'Invalid email or password');
      }

      localStorage.setItem('token', data.token);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent flex flex-col relative overflow-hidden selection:bg-white selection:text-black">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 pointer-events-none z-0">
        {/* subtle grid overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] opacity-30"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 w-full px-8 py-6 flex items-center justify-between animate-fade-in">
        <Logo />
        <Link to="/" className="text-sm font-medium text-[var(--color-muted)] hover:text-white transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Overview
        </Link>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="w-full max-w-[420px] bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-8">
          {/* Login container */}
          <div className="w-full">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500 tracking-tight mb-3">Welcome Back</h2>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-900/20 border border-red-500/30 flex items-start gap-3 animate-slide-right">
                <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="login-email" className="text-[10px] font-bold tracking-widest text-[var(--color-muted-light)] uppercase">
                  Email Address
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-[var(--color-muted)] group-focus-within:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="analyst@orca.ai"
                    className="w-full bg-transparent border-b border-white/[0.1] rounded-none pl-8 pr-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <label htmlFor="login-password" className="text-[10px] font-bold tracking-widest text-[var(--color-muted-light)] uppercase">
                  Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-[var(--color-muted)] group-focus-within:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-transparent border-b border-white/[0.1] rounded-none pl-8 pr-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white transition-all"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-6 bg-white hover:bg-gray-200 text-black font-semibold py-4 flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Authenticating...
                  </>
                ) : (
                  'Secure Login'
                )}
              </button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-sm text-[var(--color-muted)]">
                Don't have an analyst profile?{' '}
                <Link to="/register" className="text-white hover:text-gray-300 font-medium transition-colors">
                  Request Access
                </Link>
              </p>
            </div>

          </div>
        </div>

        <div className="mt-12 text-center flex flex-col items-center justify-center gap-3">
          <p className="text-xs font-mono text-[var(--color-muted-light)] max-w-md">
            If you want the full experience of this thing, kindly refer to our GitHub page.
          </p>
          <a href="https://github.com/Shagun812/orca" target="_blank" rel="noopener noreferrer" className="text-white hover:text-gray-300 transition-colors flex items-center gap-2 text-sm font-medium">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
            GitHub
          </a>
        </div>
      </main>
    </div>
  );
}
