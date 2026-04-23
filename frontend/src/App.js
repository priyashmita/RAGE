import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import PublicLayout from '@/components/PublicLayout';
import Layout from '@/components/Layout';
import AdminLayout from '@/components/AdminLayout';
import RagerLayout from '@/components/RagerLayout';
import '@/App.css';

// ── Public pages ─────────────────────────────────────────────────────────────
const LandingPage             = lazy(() => import('@/pages/LandingPage'));
const AboutPage               = lazy(() => import('@/pages/AboutPage'));
const PrivateTablePage        = lazy(() => import('@/pages/PrivateTablePage'));
const ClosedTablePage         = lazy(() => import('@/pages/ClosedTablePage'));
const ClosedTableRequestPage  = lazy(() => import('@/pages/ClosedTableRequestPage'));
const SundayTablePage         = lazy(() => import('@/pages/SundayTablePage'));
const NetworkPage             = lazy(() => import('@/pages/NetworkPage'));
const ContactPage             = lazy(() => import('@/pages/ContactPage'));
const PrivacyPage             = lazy(() => import('@/pages/PrivacyPage'));
const InsightsPage            = lazy(() => import('@/pages/InsightsPage'));

// ── Auth / misc pages ────────────────────────────────────────────────────────
const AdminLoginPage          = lazy(() => import('@/pages/admin/AdminLoginPage'));
const RagerLoginPage          = lazy(() => import('@/pages/RagerLoginPage'));
const SetupAccountPage        = lazy(() => import('@/pages/SetupAccountPage'));
const ForgotPasswordPage      = lazy(() => import('@/pages/ForgotPasswordPage'));
const ResetPasswordPage       = lazy(() => import('@/pages/ResetPasswordPage'));
const RespondPage             = lazy(() => import('@/pages/RespondPage'));
const FounderSelectPage       = lazy(() => import('@/pages/FounderSelectPage'));
const RSVPPage                = lazy(() => import('@/pages/RSVPPage'));
const PrereadFormPage         = lazy(() => import('@/pages/PrereadFormPage'));
const PrereadViewPage         = lazy(() => import('@/pages/PrereadViewPage'));

// ── Founder / member portal ───────────────────────────────────────────────────
const FounderDashboard        = lazy(() => import('@/pages/FounderDashboard'));
const EventsPage              = lazy(() => import('@/pages/EventsPage'));

// ── Rager portal ─────────────────────────────────────────────────────────────
const RagerDashboard          = lazy(() => import('@/pages/RagerDashboard'));
const RagerProfilePage        = lazy(() => import('@/pages/RagerProfilePage'));
const RagerChangePasswordPage = lazy(() => import('@/pages/RagerChangePasswordPage'));

// ── Admin portal (heaviest — recharts lives here) ────────────────────────────
const AdminDashboard          = lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminContentEditor      = lazy(() => import('@/pages/admin/AdminContentEditor'));
const AdminRagersPage         = lazy(() => import('@/pages/admin/AdminRagersPage'));
const AdminAnalyticsPage      = lazy(() => import('@/pages/admin/AdminAnalyticsPage'));
const AdminEnquiriesPage      = lazy(() => import('@/pages/admin/AdminEnquiriesPage'));
const AdminResponsesPage      = lazy(() => import('@/pages/admin/AdminResponsesPage'));
const AdminContactsPage       = lazy(() => import('@/pages/admin/AdminContactsPage'));
const AdminSettingsPage       = lazy(() => import('@/pages/admin/AdminSettingsPage'));
const AdminEventsPage         = lazy(() => import('@/pages/admin/AdminEventsPage'));
const AdminEventDetailPage    = lazy(() => import('@/pages/admin/AdminEventDetailPage'));
const AdminPodcastPage        = lazy(() => import('@/pages/admin/AdminPodcastPage'));
const MatchingPanel           = lazy(() => import('@/pages/admin/MatchingPanel'));

// ── Minimal loading fallback ──────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-4 h-4 border-2 border-gray-200 border-t-[#DC143C] rounded-full animate-spin" />
    </div>
  );
}

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="dark-ui min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-[#A1A1AA]">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={adminOnly ? '/admin-login' : '/rager-login'} replace />;
  }

  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function DashboardRouter() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="dark-ui min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-[#A1A1AA]">Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/rager-login" replace />;

  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user.role === 'rager') return <Navigate to="/rager/dashboard" replace />;
  if (user.role === 'founder') return <FounderDashboard />;

  return <Navigate to="/rager-login" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          theme="dark"
          position="top-right"
          toastOptions={{
            style: {
              background: '#111',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#F5F5F0',
              borderRadius: 0
            }
          }}
        />

        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/"                      element={<LandingPage />} />
              <Route path="/about"                 element={<AboutPage />} />
              <Route path="/private-table"         element={<PrivateTablePage />} />
              <Route path="/closed-table"          element={<ClosedTablePage />} />
              <Route path="/closed-table/request"  element={<ClosedTableRequestPage />} />
              <Route path="/sunday-table"          element={<SundayTablePage />} />
              <Route path="/network"               element={<NetworkPage />} />
              <Route path="/contact"               element={<ContactPage />} />
              <Route path="/privacy"               element={<PrivacyPage />} />
              <Route path="/insights"              element={<InsightsPage />} />
            </Route>

            <Route path="/admin-login"             element={<AdminLoginPage />} />
            <Route path="/rager-login"             element={<RagerLoginPage />} />
            {/* Legacy redirect — keeps old email links working */}
            <Route path="/rager-dashboard"         element={<Navigate to="/rager/dashboard" replace />} />
            <Route path="/setup-account"           element={<SetupAccountPage />} />
            <Route path="/forgot-password"         element={<ForgotPasswordPage />} />
            <Route path="/reset-password"          element={<ResetPasswordPage />} />
            <Route path="/respond/:anon_token"     element={<RespondPage />} />
            <Route path="/founder-select/:token"   element={<FounderSelectPage />} />
            <Route path="/rsvp/:token"             element={<RSVPPage />} />
            <Route path="/preread/:token"          element={<PrereadFormPage />} />
            <Route path="/preread-view/:token"     element={<PrereadViewPage />} />

            {/* Rager portal — auth handled inside RagerLayout */}
            <Route path="/rager" element={<RagerLayout />}>
              <Route path="dashboard"        element={<RagerDashboard />} />
              <Route path="profile"          element={<RagerProfilePage />} />
              <Route path="change-password"  element={<RagerChangePasswordPage />} />
            </Route>

            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<DashboardRouter />} />
              <Route path="/events"    element={<EventsPage />} />
            </Route>

            <Route
              path="/admin"
              element={
                <ProtectedRoute adminOnly>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index                    element={<AdminDashboard />} />
              <Route path="content"           element={<AdminContentEditor />} />
              <Route path="ragers"            element={<AdminRagersPage />} />
              <Route path="analytics"         element={<AdminAnalyticsPage />} />
              <Route path="enquiries"         element={<AdminEnquiriesPage />} />
              <Route path="contacts"          element={<AdminContactsPage />} />
              <Route path="responses"         element={<AdminResponsesPage />} />
              <Route path="matching"          element={<MatchingPanel />} />
              <Route path="settings"          element={<AdminSettingsPage />} />
              <Route path="events"            element={<AdminEventsPage />} />
              <Route path="events/:id"        element={<AdminEventDetailPage />} />
              <Route path="podcast"           element={<AdminPodcastPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
