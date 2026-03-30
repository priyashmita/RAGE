import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import PublicLayout from '@/components/PublicLayout';
import Layout from '@/components/Layout';
import LandingPage from '@/pages/LandingPage';
import AboutPage from '@/pages/AboutPage';
import PrivateTablePage from '@/pages/PrivateTablePage';
import ClosedTablePage from '@/pages/ClosedTablePage';
import SundayTablePage from '@/pages/SundayTablePage';
import NetworkPage from '@/pages/NetworkPage';
import ContactPage from '@/pages/ContactPage';
import PrivacyPage from '@/pages/PrivacyPage';
import LoginPage from '@/pages/LoginPage';
import ClosedTableRequestPage from '@/pages/ClosedTableRequestPage';
import FounderDashboard from '@/pages/FounderDashboard';
import ExpertDashboard from '@/pages/ExpertDashboard';
import MemberDashboard from '@/pages/MemberDashboard';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminContentEditor from '@/pages/admin/AdminContentEditor';
import AdminLoginPage from '@/pages/admin/AdminLoginPage';
import MatchingPanel from '@/pages/admin/MatchingPanel';
import EventsPage from '@/pages/EventsPage';
import '@/App.css';

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
    return <Navigate to={adminOnly ? '/admin-login' : '/member-login'} replace />;
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

  if (!user) return <Navigate to="/member-login" replace />;

  if (user.role === 'admin') return <Navigate to="/admin" replace />;

  const dashboards = {
    founder: <FounderDashboard />,
    expert: <ExpertDashboard />,
    member: <MemberDashboard />,
    sponsor: <MemberDashboard />
  };

  return dashboards[user.role] || <MemberDashboard />;
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

        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/private-table" element={<PrivateTablePage />} />
            <Route path="/closed-table" element={<ClosedTablePage />} />
            <Route path="/closed-table/request" element={<ClosedTableRequestPage />} />
            <Route path="/sunday-table" element={<SundayTablePage />} />
            <Route path="/network" element={<NetworkPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
          </Route>

          <Route path="/member-login" element={<LoginPage />} />
          <Route path="/admin-login" element={<AdminLoginPage />} />

          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardRouter />} />
            <Route path="/events" element={<EventsPage />} />
          </Route>

          <Route
            path="/admin"
            element={
              <ProtectedRoute adminOnly>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="content" element={<AdminContentEditor />} />
            <Route path="matching" element={<MatchingPanel />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
