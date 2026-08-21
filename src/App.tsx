import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import './App.css';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { TenantWorkspace } from './components/tenant/TenantWorkspace';
import { Terms } from './pages/Terms';
import { DeveloperPortal } from './pages/DeveloperPortal';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/developer" element={<DeveloperPortal />} />

          {/* Protected Area */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<TenantWorkspace />} />
          </Route>

          {/* Default Redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;