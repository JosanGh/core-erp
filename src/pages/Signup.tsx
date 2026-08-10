import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { IndustryType } from '../types/auth';
import { Building2, Mail, Lock, User, ShieldCheck } from 'lucide-react';

const INDUSTRIES: { value: IndustryType; label: string }[] = [
  { value: 'supermarket', label: 'Supermarket / Retail POS' },
  { value: 'pharmacy', label: 'Pharmacy & Drug Store' },
  { value: 'water_factory', label: 'Water Bottling / Production' },
  { value: 'electrical_shop', label: 'Electrical & Electronics Shop' },
  { value: 'susu_finance', label: 'Susu / Micro-Finance & Loans' },
  { value: 'school', label: 'School / Academic Institution' },
  { value: 'clinic', label: 'Health Clinic / Medical Center' },
];

export const Signup: React.FC = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    orgName: '',
    industryType: 'supermarket' as IndustryType,
  });

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error: err } = await signUp({
      email: form.email,
      password: form.password,
      fullName: form.fullName,
      orgName: form.orgName,
      industryType: form.industryType,
    });

    if (err) {
      setError(err.message);
      setSubmitting(false);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 font-sans text-slate-100">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">Create Enterprise Account</h1>
          <p className="mt-1 text-sm text-slate-400">Launch your multi-tenant workspace</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-950/50 border border-red-500/50 p-3 text-xs text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="John Doe"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Business / Organization Name
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                required
                value={form.orgName}
                onChange={(e) => setForm({ ...form, orgName: e.target.value })}
                placeholder="Metro Enterprise"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Primary Business Type
            </label>
            <select
              value={form.industryType}
              onChange={(e) => setForm({ ...form, industryType: e.target.value as IndustryType })}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              {INDUSTRIES.map((ind) => (
                <option key={ind.value} value={ind.value}>
                  {ind.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
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
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
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
            {submitting ? 'Creating Organization...' : 'Register Workspace'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-400 hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};
