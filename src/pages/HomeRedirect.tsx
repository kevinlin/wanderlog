import { Navigate } from 'react-router';
import { getCurrentTripId } from '@/services/viewStateStorage';

export const HomeRedirect = () => {
  const lastTripId = getCurrentTripId();
  return <Navigate replace to={lastTripId ? `/trips/${lastTripId}` : '/trips'} />;
};
