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
import AiInsightsPage from './pages/AiInsightsPage';
import AccessControlPage from './pages/AccessControlPage';
import CompleteProfilePage from './pages/CompleteProfilePage';
import WhatsappTemplatesPage from './pages/WhatsappTemplatesPage';
import { useAuthStore } from './store/useAuthStore';
import { api } from './lib/api';
import { hasAnyPermission, homePath } from './lib/rbac';
import Toaster from './components/ui/Toaster';

function ProtectedRoute({ children }: { children: React.JSX.Element }) {
  const { isAuthenticated, accessToken, setUser, logout, user } = useAuthStore();

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
  // Imported staff confirm their details and set their own password before anything else
  if (user?.mustCompleteProfile) {
    return <Navigate to="/complete-profile" replace />;
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
        <Route path="/complete-profile" element={<CompleteProfilePage />} />

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
              <RequirePermission anyOf={['review_queue.view']}>
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
            path="insights"
            element={
              <RequirePermission anyOf={['insights.view_all', 'insights.view_department']}>
                <AiInsightsPage />
              </RequirePermission>
            }
          />
          <Route
            path="access-control"
            element={
              <RequirePermission anyOf={['admin.access_control']}>
                <AccessControlPage />
              </RequirePermission>
            }
          />
          <Route
            path="whatsapp-messages"
            element={
              <RequirePermission anyOf={['admin.whatsapp_templates']}>
                <WhatsappTemplatesPage />
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
