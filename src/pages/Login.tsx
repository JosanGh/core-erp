import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { Mail, Lock } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import { isStandardPassword, PASSWORD_REQUIREMENTS } from '../utils/authValidation';

export const Login: React.FC = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isStandardPassword(password)) {
      setError(PASSWORD_REQUIREMENTS);
      return;
    }
    setSubmitting(true);

    const { error: err } = await signIn(email, password);

    if (err) {
      setError(err.message);
      setSubmitting(false);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="auth-page flex min-h-screen items-center justify-center bg-slate-950 p-4 font-sans text-slate-100">
      <div className="auth-toolbar"><ThemeToggle /></div>
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">Sign In</h1>
          <p className="mt-1 text-sm text-slate-400">Access your business portal</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-950/50 border border-red-500/50 p-3 text-xs text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@business.com"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors disabled:opacity-50 mt-2"
          >
            {submitting ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Need a workspace?{' '}
          <Link to="/signup" className="text-blue-400 hover:underline">
            Register Here
          </Link>
        </p>
        <p className="mt-3 text-center text-xs text-slate-500"><Link to="/terms" className="text-blue-400 hover:underline">Terms and privacy</Link></p>
      </div>
    </div>
  );
};