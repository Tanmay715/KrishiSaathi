import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './layouts/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import FarmsPage from './pages/FarmsPage';
import FarmDetailPage from './pages/FarmDetailPage';
import PlotDetailPage from './pages/PlotDetailPage';
import ProfilePage from './pages/ProfilePage';
import AssistantPage from './pages/AssistantPage';
import ActivityPage from './pages/ActivityPage';
import MarketPage from './pages/MarketPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="assistant" element={<AssistantPage />} />
              <Route path="farms" element={<FarmsPage />} />
              <Route path="farms/:farm_id" element={<FarmDetailPage />} />
              <Route path="farms/:farm_id/plots/:plot_id" element={<PlotDetailPage />} />
              <Route path="activity" element={<ActivityPage />} />
              <Route path="market" element={<MarketPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
