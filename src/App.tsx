import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import './App.css';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';

const DashboardView: React.FC = () => {
  const { profile, organization, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold">{organization?.name} Dashboard</h1>
            <p className="text-xs text-slate-400 uppercase tracking-wider mt-1">
              Industry: <span className="text-blue-400">{organization?.industry_type}</span>
            </p>
          </div>
          <button
            onClick={signOut}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg text-slate-300"
          >
            Sign Out
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <h3 className="text-xs text-slate-500 uppercase font-bold">User Identity</h3>
            <p className="text-lg font-semibold mt-1">{profile?.full_name}</p>
            <p className="text-sm text-slate-400">{profile?.email}</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <h3 className="text-xs text-slate-500 uppercase font-bold">Access Level</h3>
            <p className="text-lg font-semibold text-emerald-400 mt-1 capitalize">{profile?.role}</p>
            <p className="text-sm text-slate-400">Row-Level Security Active</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Protected Area */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardView />} />
          </Route>

          {/* Default Redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;