import { BrowserRouter, Route, Routes } from 'react-router';
import { HomeRedirect } from '@/pages/HomeRedirect';
import { LoginPage } from '@/pages/LoginPage';
import { TripPage } from '@/pages/TripPage';

const App = () => (
  <BrowserRouter basename={import.meta.env.BASE_URL}>
    <Routes>
      <Route element={<LoginPage />} path="/login" />
      <Route element={<HomeRedirect />} path="/" />
      <Route element={<TripPage />} path="/trips/:tripId" />
      <Route element={<HomeRedirect />} path="*" />
    </Routes>
  </BrowserRouter>
);

export default App;
