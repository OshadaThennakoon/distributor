import React, { useEffect, useState } from 'react';
import api from '../utils/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { formatDate } from '../utils/formatters.js';
import { Settings, Shield, User, Plus, Trash2, History, Check } from 'lucide-react';

export function SettingsPage() {
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAddUserModal, setShowAddUserModal] = useState(false);

  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    password: '',
    fullName: '',
    role: 'FINANCE_USER',
    distributorId: 1
  });

  const loadData = async () => {
    setLoading(true);
    try {
      if (isAdmin) {
        const [uData, aData, sData] = await Promise.all([
          api.get('/auth/users'),
          api.get('/auth/audit-logs'),
          api.get('/auth/settings')
        ]);
        setUsers(uData);
        setAuditLogs(aData);
        setSettings(sData);
      } else {
        const [aData, sData] = await Promise.all([
          api.get('/auth/audit-logs'),
          api.get('/auth/settings')
        ]);
        setAuditLogs(aData);
        setSettings(sData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isAdmin]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/users', userForm);
      setShowAddUserModal(false);
      setUserForm({ username: '', email: '', password: '', fullName: '', role: 'FINANCE_USER', distributorId: 1 });
      loadData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleDeleteUser = async (id) => {
    if (!confirm('Are you sure you want to delete this user account?')) return;
    try {
      await api.delete(`/auth/users/${id}`);
      loadData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title">
          <h1>System Administration & Security Audits</h1>
          <p>Manage user authorizations, role privileges, system-wide configuration, and complete immutable audit trails.</p>
        </div>
        {isAdmin && (
          <div className="page-actions">
            <button className="btn btn-primary" onClick={() => setShowAddUserModal(true)}>
              <Plus size={14} />
              <span>Create User Account</span>
            </button>
          </div>
        )}
      </div>

      <div className="tabs-container">
        {isAdmin && (
          <button
            className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            User Roles & Permissions ({users.length})
          </button>
        )}
        <button
          className={`tab-btn ${activeTab === 'audits' ? 'active' : ''}`}
          onClick={() => setActiveTab('audits')}
        >
          Audit Trails ({auditLogs.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          General System Configuration
        </button>
      </div>

      {/* Users Table */}
      {activeTab === 'users' && isAdmin && (
        <div className="table-card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Assigned Role</th>
                  <th>Scoped Distributor</th>
                  <th>Created At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td><strong>{u.username}</strong></td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{u.full_name}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`badge ${u.role === 'ADMIN' ? 'badge-danger' : u.role === 'FINANCE_USER' ? 'badge-purple' : 'badge-info'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td>{u.distributor_name || 'Global Access (All)'}</td>
                    <td>{formatDate(u.created_at)}</td>
                    <td>
                      {u.username !== 'admin' && (
                        <button
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => handleDeleteUser(u.id)}
                          title="Delete user"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Trails Table (Section 36) */}
      {activeTab === 'audits' && (
        <div className="table-card">
          <div className="table-toolbar">
            <span style={{ fontWeight: '600' }}>Audit Event History (Section 36)</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Logged User Changes, Fuel Price Revisions & Transactions</span>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Operator</th>
                  <th>Action</th>
                  <th>Entity Type</th>
                  <th>Entity ID</th>
                  <th>Change Payload</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map(a => (
                  <tr key={a.id}>
                    <td>{a.created_at}</td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{a.full_name || a.username || 'System'}</td>
                    <td><span className="badge badge-purple">{a.action}</span></td>
                    <td>{a.entity_type}</td>
                    <td>{a.entity_id ? `#${a.entity_id}` : '-'}</td>
                    <td style={{ fontSize: '0.75rem', fontFamily: 'monospace', maxWidth: '350px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {a.new_values || a.old_values || '-'}
                    </td>
                    <td>{a.ip_address || '127.0.0.1'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* General Settings */}
      {activeTab === 'settings' && (
        <div className="table-card" style={{ padding: '28px', maxWidth: '650px' }}>
          <h3 style={{ marginBottom: '16px' }}>Platform Global Parameters</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Default Currency Code</span>
              <strong>{settings.default_currency || 'LKR'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Currency Symbol</span>
              <strong>{settings.default_currency_symbol || 'Rs.'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Working Days Per Month</span>
              <strong>{settings.working_days_per_month || '26'} days</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Platform Architecture</span>
              <span className="badge badge-success">Multi-Tenant SQLite Relational Engine</span>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create User */}
      {showAddUserModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Create User Account</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowAddUserModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Username *</label>
                    <input className="form-control" required value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input className="form-control" required value={userForm.fullName} onChange={e => setUserForm({...userForm, fullName: e.target.value})} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Email Address *</label>
                    <input className="form-control" type="email" required value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Password *</label>
                    <input className="form-control" type="password" required value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>User Role *</label>
                    <select className="form-control" value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})}>
                      <option value="ADMIN">ADMIN (Full Privileges)</option>
                      <option value="FINANCE_USER">FINANCE USER (P&L, Costs, Reports)</option>
                      <option value="VIEWER">VIEWER (Read-Only Operational)</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddUserModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsPage;
