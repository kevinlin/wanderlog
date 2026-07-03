import { Navigate, useLocation } from 'react-router';
import { LoginForm } from '@/components/Auth/LoginForm';
import { useAuth } from '@/contexts/AuthContext';

export const LoginPage = () => {
  const { session } = useAuth();
  const location = useLocation();
  if (session) {
    return <Navigate replace to={(location.state as { from?: string })?.from ?? '/'} />;
  }
  return <LoginForm />;
};
