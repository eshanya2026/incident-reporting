import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import AppLayout from './components/layout/AppLayout';
import DashboardPage from './pages/DashboardPage';
import ReportIncidentPage from './pages/ReportIncidentPage';
import IncidentRegisterPage from './pages/IncidentRegisterPage';
import IncidentDetailPage from './pages/IncidentDetailPage';
import CapaManagerPage from './pages/CapaManagerPage';
import QualityReportsPage from './pages/QualityReportsPage';
import AdminMasterPage from './pages/AdminMasterPage';
import { useAuthStore } from './store/useAuthStore';
import { api } from './lib/api';

function ProtectedRoute({ children }: { children: React.JSX.Element }) {
  const { isAuthenticated, accessToken, setUser, logout } = useAuthStore();

  useEffect(() => {
    if (accessToken) {
      api
        .get('/auth/me')
        .then((res: any) => {
          if (res?.data) {
            setUser(res.data);
          }
        })
        .catch((err: any) => {
          if (err?.statusCode === 401 || err?.response?.status === 401) {
            logout();
          }
        });
    }
  }, [accessToken, setUser, logout]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="incidents/new" element={<ReportIncidentPage />} />
          <Route path="incidents" element={<IncidentRegisterPage />} />
          <Route path="incidents/:id" element={<IncidentDetailPage />} />
          <Route path="capas" element={<CapaManagerPage />} />
          <Route path="reports" element={<QualityReportsPage />} />
          <Route path="admin" element={<AdminMasterPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}
