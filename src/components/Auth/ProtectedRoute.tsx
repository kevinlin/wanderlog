import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { LoadingSpinner } from '@/components/Layout/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { session, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading your adventure..." size="lg" variant="adventure" />;
  }
  if (!session) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }
  return <>{children}</>;
};
