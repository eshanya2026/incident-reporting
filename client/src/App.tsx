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
import MyReportsPage from './pages/MyReportsPage';
import TriageInboxPage from './pages/TriageInboxPage';
import ReviewQueuePage from './pages/ReviewQueuePage';
import MyDepartmentPage from './pages/MyDepartmentPage';
import { useAuthStore } from './store/useAuthStore';
import { api } from './lib/api';
import { hasAnyPermission, homePath } from './lib/rbac';
import Toaster from './components/ui/Toaster';

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

/** Blocks direct URL access to pages the user's role does not allow. */
function RequirePermission({ anyOf, children }: { anyOf: string[]; children: React.JSX.Element }) {
  const user = useAuthStore((state) => state.user);
  if (!hasAnyPermission(user, anyOf)) {
    return <Navigate to={homePath(user)} replace />;
  }
  return children;
}

function HomeRedirect() {
  const user = useAuthStore((state) => state.user);
  return <Navigate to={homePath(user)} replace />;
}

export default function App() {
  return (
    <Router>
      <Toaster />
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
          <Route index element={<HomeRedirect />} />
          <Route
            path="dashboard"
            element={
              <RequirePermission anyOf={['dashboard.view']}>
                <DashboardPage />
              </RequirePermission>
            }
          />
          <Route
            path="incidents/new"
            element={
              <RequirePermission anyOf={['incident.create']}>
                <ReportIncidentPage />
              </RequirePermission>
            }
          />
          <Route
            path="my-reports"
            element={
              <RequirePermission anyOf={['incident.read_own']}>
                <MyReportsPage />
              </RequirePermission>
            }
          />
          <Route
            path="triage"
            element={
              <RequirePermission anyOf={['incident.triage']}>
                <TriageInboxPage />
              </RequirePermission>
            }
          />
          <Route
            path="review"
            element={
              <RequirePermission anyOf={['incident.review']}>
                <ReviewQueuePage />
              </RequirePermission>
            }
          />
          <Route
            path="my-department"
            element={
              <RequirePermission anyOf={['incident.read_assigned']}>
                <MyDepartmentPage />
              </RequirePermission>
            }
          />
          <Route
            path="incidents"
            element={
              <RequirePermission anyOf={['incident.read_all']}>
                <IncidentRegisterPage />
              </RequirePermission>
            }
          />
          {/* Access to a single incident is checked by the server */}
          <Route path="incidents/:id" element={<IncidentDetailPage />} />
          <Route
            path="capas"
            element={
              <RequirePermission anyOf={['capa.read']}>
                <CapaManagerPage />
              </RequirePermission>
            }
          />
          <Route
            path="reports"
            element={
              <RequirePermission anyOf={['report.view_all', 'report.view_department']}>
                <QualityReportsPage />
              </RequirePermission>
            }
          />
          <Route
            path="admin"
            element={
              <RequirePermission anyOf={['admin.user_manage']}>
                <AdminMasterPage />
              </RequirePermission>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
