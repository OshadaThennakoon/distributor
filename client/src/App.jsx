import React, { useState } from 'react';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { TenantProvider } from './contexts/TenantContext.jsx';
import Sidebar from './components/Sidebar.jsx';
import Navbar from './components/Navbar.jsx';

// Pages
import DashboardPage from './pages/DashboardPage.jsx';
import DistributorsPage from './pages/DistributorsPage.jsx';
import RoutesPage from './pages/RoutesPage.jsx';
import ShopsPage from './pages/ShopsPage.jsx';
import VisitSchedulePage from './pages/VisitSchedulePage.jsx';
import VehiclesPage from './pages/VehiclesPage.jsx';
import FuelManagementPage from './pages/FuelManagementPage.jsx';
import SalesPage from './pages/SalesPage.jsx';
import ExpensesPage from './pages/ExpensesPage.jsx';
import ProfitabilityPage from './pages/ProfitabilityPage.jsx';
import BreakEvenPage from './pages/BreakEvenPage.jsx';
import SimulatorPage from './pages/SimulatorPage.jsx';
import ReportsHubPage from './pages/ReportsHubPage.jsx';
import MonthlyReportPage from './pages/MonthlyReportPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import DailyPerformancePage from './pages/DailyPerformancePage.jsx';
import QuickBillingPage from './pages/QuickBillingPage.jsx';
import DailyDispatchPage from './pages/DailyDispatchPage.jsx';
import MapView from './components/MapView.jsx';

function MainApp() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedRouteForMap, setSelectedRouteForMap] = useState(null);

  const handleSelectRouteForMap = (routeId) => {
    setSelectedRouteForMap(routeId);
    setCurrentView('map');
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardPage setCurrentView={setCurrentView} />;
      case 'daily-operations':
        return <DailyPerformancePage />;
      case 'distributors':
        return <DistributorsPage />;
      case 'routes':
        return <RoutesPage onSelectRouteForMap={handleSelectRouteForMap} />;
      case 'map':
        return (
          <div className="page-container">
            <div className="page-header">
              <div className="page-title">
                <h1>Geospatial Network & Route Mapping</h1>
                <p>Distribution centers, retail customer outlets, and connected delivery paths on OpenStreetMap.</p>
              </div>
            </div>
            <MapView routeId={selectedRouteForMap} />
          </div>
        );
      case 'shops':
        return <ShopsPage />;
      case 'visit-schedule':
        return <VisitSchedulePage />;
      case 'vehicles':
      case 'drivers':
      case 'maintenance':
        return <VehiclesPage />;
      case 'fuel':
        return <FuelManagementPage />;
      case 'billing':
        return <QuickBillingPage />;
      case 'dispatch':
        return <DailyDispatchPage />;
      case 'sales':
      case 'products':
        return <SalesPage />;
      case 'expenses':
        return <ExpensesPage />;
      case 'profitability':
        return <ProfitabilityPage />;
      case 'break-even':
        return <BreakEvenPage />;
      case 'simulator':
        return <SimulatorPage />;
      case 'reports':
        return <ReportsHubPage />;
      case 'monthly-report':
        return <MonthlyReportPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage setCurrentView={setCurrentView} />;
    }
  };

  return (
    <div className="app-container">
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
      <div className="main-wrapper">
        <Navbar />
        <main>{renderCurrentView()}</main>
      </div>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <TenantProvider>
        <MainApp />
      </TenantProvider>
    </AuthProvider>
  );
}

export default App;
