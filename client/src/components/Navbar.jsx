import React from 'react';
import { useTenant } from '../contexts/TenantContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { Globe, Bell, User, LogOut, Shield } from 'lucide-react';

export function Navbar() {
  const { distributors, activeDistributorId, changeDistributor, currencySymbol } = useTenant();
  const { user, logout, login } = useAuth();

  const handleRoleSwitch = async (roleName) => {
    if (roleName === 'ADMIN') await login('admin', 'admin123');
    else if (roleName === 'FINANCE_USER') await login('finance', 'finance123');
    else if (roleName === 'VIEWER') await login('viewer', 'viewer123');
  };

  return (
    <header className="top-navbar">
      <div className="navbar-left">
        {/* Multi-Distributor Scoping Selector */}
        <div className="tenant-selector-pill">
          <Globe size={16} color="var(--primary)" />
          <select
            value={activeDistributorId}
            onChange={(e) => changeDistributor(e.target.value)}
          >
            <option value="all">🏢 All Distributors (Consolidated Intelligence)</option>
            {distributors.map(d => (
              <option key={d.id} value={d.id}>
                📍 {d.name} ({d.code})
              </option>
            ))}
          </select>
        </div>

        <div className="currency-badge">
          Currency: {currencySymbol}
        </div>
      </div>

      <div className="navbar-right">
        {/* Quick Role Switcher for Demo testing */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Role Switch:</span>
          <button
            className={`btn btn-sm ${user?.role === 'ADMIN' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleRoleSwitch('ADMIN')}
          >
            Admin
          </button>
          <button
            className={`btn btn-sm ${user?.role === 'FINANCE_USER' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleRoleSwitch('FINANCE_USER')}
          >
            Finance
          </button>
          <button
            className={`btn btn-sm ${user?.role === 'VIEWER' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleRoleSwitch('VIEWER')}
          >
            Viewer
          </button>
        </div>

        {/* User Pill */}
        <div className="user-profile-pill">
          <div className="user-avatar">
            {user?.fullName?.charAt(0) || 'U'}
          </div>
          <div className="user-info">
            <div className="user-name">{user?.fullName || 'Administrator'}</div>
            <div className="user-role">{user?.role || 'ADMIN'}</div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
