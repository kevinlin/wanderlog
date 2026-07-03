import { Navigate } from 'react-router';
import { getCurrentTripId } from '@/services/viewStateStorage';

export const DEFAULT_TRIP_ID = '202512_NZ';

export const HomeRedirect = () => <Navigate replace to={`/trips/${getCurrentTripId() ?? DEFAULT_TRIP_ID}`} />;
