import React from 'react';
import { 
  LayoutDashboard, Building2, MapPin, Route, Calendar, 
  Store, Truck, UserCheck, Fuel, Wrench, Receipt, Package, 
  Wallet, TrendingUp, BarChart3, FileSpreadsheet, Calculator, 
  Sliders, Settings, ShieldCheck, Map, Target
} from 'lucide-react';

export function Sidebar({ currentView, setCurrentView }) {
  const navSections = [
    {
      title: 'Overview',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'daily-operations', label: 'Daily Ops & Targets', icon: Target }
      ]
    },
    {
      title: 'Distribution',
      items: [
        { id: 'distributors', label: 'Distributors & DCs', icon: Building2 },
        { id: 'routes', label: 'Route Management', icon: Route },
        { id: 'map', label: 'Interactive Route Map', icon: Map },
        { id: 'shops', label: 'Shops & Customers', icon: Store },
        { id: 'visit-schedule', label: 'Visit Schedules', icon: Calendar }
      ]
    },
    {
      title: 'Fleet & Logistics',
      items: [
        { id: 'vehicles', label: 'Vehicles Fleet', icon: Truck },
        { id: 'drivers', label: 'Drivers & Salaries', icon: UserCheck },
        { id: 'fuel', label: 'Fuel Management', icon: Fuel },
        { id: 'maintenance', label: 'Vehicle Maintenance', icon: Wrench }
      ]
    },
    {
      title: 'Sales & Invoicing',
      items: [
        { id: 'billing', label: 'Quick Invoice & Billing', icon: Receipt },
        { id: 'dispatch', label: 'Daily Dispatch Sheet', icon: Truck },
        { id: 'sales', label: 'Invoices & Orders', icon: Package },
        { id: 'products', label: 'Jeewaka Herbal Catalog', icon: Package }
      ]
    },
    {
      title: 'Financial Intelligence',
      items: [
        { id: 'expenses', label: 'Expense Management', icon: Wallet },
        { id: 'profitability', label: 'Route Profitability', icon: TrendingUp },
        { id: 'break-even', label: 'Break-Even Calculator', icon: Calculator },
        { id: 'simulator', label: 'What-If? Simulator', icon: Sliders }
      ]
    },
    {
      title: 'Reports & Audits',
      items: [
        { id: 'reports', label: 'Financial Reports', icon: FileSpreadsheet },
        { id: 'monthly-report', label: 'Monthly Management', icon: BarChart3 },
        { id: 'settings', label: 'Administration & Logs', icon: Settings }
      ]
    }
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-badge" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>JH</div>
        <div className="brand-text">
          <h2>Jeewaka Herbals</h2>
          <span>Distributor Point ERP</span>
        </div>
      </div>

      <div className="sidebar-content">
        {navSections.map((sec, idx) => (
          <div className="nav-section" key={idx}>
            <div className="nav-section-title">{sec.title}</div>
            {sec.items.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <div
                  key={item.id}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setCurrentView(item.id)}
                >
                  <Icon className="icon" />
                  <span>{item.label}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </aside>
  );
}

export default Sidebar;
