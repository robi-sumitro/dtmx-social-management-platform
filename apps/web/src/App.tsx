import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { PageLoader } from '@/components/ui/Loading';
import { Landing } from '@/pages/Landing';
import { Login } from '@/pages/auth/Login';
import { Register } from '@/pages/auth/Register';
import { ForgotPassword } from '@/pages/auth/ForgotPassword';
import { ResetPassword } from '@/pages/auth/ResetPassword';
import { OAuthCallback } from '@/pages/auth/OAuthCallback';
import { AppShell } from '@/components/layout/AppShell';
import { Dashboard } from '@/pages/app/Dashboard';
import { Posts } from '@/pages/app/Posts';
import { PostComposer } from '@/pages/app/PostComposer';
import { Inbox } from '@/pages/app/Inbox';
import { Media } from '@/pages/app/Media';
import { AIStudio } from '@/pages/app/AIStudio';
import { Accounts } from '@/pages/app/Accounts';
import { Billing } from '@/pages/app/Billing';
import { Settings } from '@/pages/app/Settings';

const Admin = lazy(() => import('@/pages/app/admin/Admin').then((m) => ({ default: m.Admin })));

function Protected({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader label="Memuat sesi..." />;
  if (!isAuthenticated) return <Navigate to="/auth/login" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return <PageLoader label="Memuat sesi..." />;
  if (!isAdmin) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/register" element={<Register />} />
        <Route path="/auth/forgot-password" element={<ForgotPassword />} />
        <Route path="/auth/reset-password" element={<ResetPassword />} />
        <Route path="/auth/oauth/callback" element={<OAuthCallback />} />

        <Route
          path="/app"
          element={
            <Protected>
              <AppShell>
                <Routes>
                  <Route path="" element={<Dashboard />} />
                  <Route path="posts" element={<Posts />} />
                  <Route path="posts/new" element={<PostComposer />} />
                  <Route path="inbox" element={<Inbox />} />
                  <Route path="media" element={<Media />} />
                  <Route path="ai" element={<AIStudio />} />
                  <Route path="accounts" element={<Accounts />} />
                  <Route path="billing" element={<Billing />} />
                  <Route path="settings" element={<Settings />} />
                  <Route
                    path="admin"
                    element={
                      <AdminRoute>
                        <Suspense fallback={<PageLoader label="Memuat admin panel..." />}>
                          <Admin />
                        </Suspense>
                      </AdminRoute>
                    }
                  />
                  <Route path="*" element={<Navigate to="/app" replace />} />
                </Routes>
              </AppShell>
            </Protected>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
