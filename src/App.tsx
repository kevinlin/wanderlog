import { Analytics } from '@vercel/analytics/react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { ProtectedRoute } from '@/components/Auth/ProtectedRoute';
import { ToastProvider } from '@/components/Layout/Toast';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { HomeRedirect } from '@/pages/HomeRedirect';
import { LoginPage } from '@/pages/LoginPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { TripLibraryPage } from '@/pages/TripLibraryPage';
import { TripPage } from '@/pages/TripPage';

const App = () => (
  <>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ToastProvider>
        <Routes>
          <Route element={<LoginPage />} path="/login" />
          <Route element={<ForgotPasswordPage />} path="/forgot-password" />
          <Route element={<ResetPasswordPage />} path="/reset-password" />
          <Route
            element={
              <ProtectedRoute>
                <HomeRedirect />
              </ProtectedRoute>
            }
            path="/"
          />
          <Route
            element={
              <ProtectedRoute>
                <TripLibraryPage />
              </ProtectedRoute>
            }
            path="/trips"
          />
          <Route
            element={
              <ProtectedRoute>
                <TripPage />
              </ProtectedRoute>
            }
            path="/trips/:tripId"
          />
          <Route
            element={
              <ProtectedRoute>
                <HomeRedirect />
              </ProtectedRoute>
            }
            path="*"
          />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
    <Analytics />
  </>
);

export default App;
