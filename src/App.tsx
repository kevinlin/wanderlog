import { BrowserRouter, Route, Routes } from 'react-router';
import { ProtectedRoute } from '@/components/Auth/ProtectedRoute';
import { HomeRedirect } from '@/pages/HomeRedirect';
import { LoginPage } from '@/pages/LoginPage';
import { TripLibraryPage } from '@/pages/TripLibraryPage';
import { TripPage } from '@/pages/TripPage';

const App = () => (
  <BrowserRouter basename={import.meta.env.BASE_URL}>
    <Routes>
      <Route element={<LoginPage />} path="/login" />
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
  </BrowserRouter>
);

export default App;
