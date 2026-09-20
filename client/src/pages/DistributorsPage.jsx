import React, { useEffect, useState } from 'react';
import api from '../utils/api.js';
import { useTenant } from '../contexts/TenantContext.jsx';
import { Building2, Plus, MapPin, Phone, Mail, CheckCircle } from 'lucide-react';

export function DistributorsPage() {
  const { refreshDistributors } = useTenant();
  const [distributors, setDistributors] = useState([]);
  const [dcs, setDcs] = useState([]);
  const [territories, setTerritories] = useState([]);
  const [activeTab, setActiveTab] = useState('distributors');
  const [loading, setLoading] = useState(true);

  // New Distributor modal state
  const [showDistModal, setShowDistModal] = useState(false);
  const [distForm, setDistForm] = useState({
    code: '',
    name: '',
    reg_number: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    currency_code: 'LKR',
    currency_symbol: 'Rs.'
  });

  // New DC modal state
  const [showDcModal, setShowDcModal] = useState(false);
  const [dcForm, setDcForm] = useState({
    distributor_id: 1,
    name: '',
    code: '',
    town: '',
    district: '',
    province: '',
    manager: '',
    contact_number: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [dList, dcList, tList] = await Promise.all([
        api.get('/distributors'),
        api.get('/distribution-centers'),
        api.get('/territories')
      ]);
      setDistributors(dList);
      setDcs(dcList);
      setTerritories(tList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateDistributor = async (e) => {
    e.preventDefault();
    try {
      await api.post('/distributors', distForm);
      setShowDistModal(false);
      setDistForm({ code: '', name: '', reg_number: '', contact_person: '', phone: '', email: '', address: '', currency_code: 'LKR', currency_symbol: 'Rs.' });
      loadData();
      refreshDistributors();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleCreateDc = async (e) => {
    e.preventDefault();
    try {
      await api.post('/distribution-centers', dcForm);
      setShowDcModal(false);
      setDcForm({ distributor_id: 1, name: '', code: '', town: '', district: '', province: '', manager: '', contact_number: '' });
      loadData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title">
          <h1>Multi-Distributor & Territory Architecture</h1>
          <p>Configure independent distribution businesses, distribution centers (hubs), and geographic territories.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={() => setShowDcModal(true)}>
            <Plus size={14} />
            <span>New Distribution Center</span>
          </button>
          <button className="btn btn-primary" onClick={() => setShowDistModal(true)}>
            <Plus size={14} />
            <span>Register Distributor</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <button
          className={`tab-btn ${activeTab === 'distributors' ? 'active' : ''}`}
          onClick={() => setActiveTab('distributors')}
        >
          Distributors ({distributors.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'dcs' ? 'active' : ''}`}
          onClick={() => setActiveTab('dcs')}
        >
          Distribution Centers ({dcs.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'territories' ? 'active' : ''}`}
          onClick={() => setActiveTab('territories')}
        >
          Territories ({territories.length})
        </button>
      </div>

      {/* Distributors Grid */}
      {activeTab === 'distributors' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
          {distributors.map(d => (
            <div key={d.id} className="table-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="badge badge-purple">{d.code}</span>
                    <span className="badge badge-success">{d.status}</span>
                  </div>
                  <h3 style={{ fontSize: '1.25rem', marginTop: '8px' }}>{d.name}</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Reg: {d.reg_number || 'N/A'}</p>
                </div>
                <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                  <Building2 size={22} />
                </div>
              </div>

              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={14} color="var(--text-muted)" />
                  <span>{d.address || 'Address on file'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Phone size={14} color="var(--text-muted)" />
                  <span>{d.phone || '-'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Mail size={14} color="var(--text-muted)" />
                  <span>{d.email || '-'}</span>
                </div>
              </div>

              {/* Stats badges */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)' }}>{d.dc_count}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>DC Hubs</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--primary)' }}>{d.route_count}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Routes</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--success)' }}>{d.shop_count}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Shops</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Distribution Centers Table */}
      {activeTab === 'dcs' && (
        <div className="table-card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>DC Code</th>
                  <th>Center Name</th>
                  <th>Distributor</th>
                  <th>Town & District</th>
                  <th>Province</th>
                  <th>Manager</th>
                  <th>Contact Number</th>
                  <th>Active Routes</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {dcs.map(dc => (
                  <tr key={dc.id}>
                    <td><strong>{dc.code}</strong></td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{dc.name}</td>
                    <td>{dc.distributor_name}</td>
                    <td>{dc.town}, {dc.district}</td>
                    <td>{dc.province}</td>
                    <td>{dc.manager || '-'}</td>
                    <td>{dc.contact_number || '-'}</td>
                    <td><span className="badge badge-info">{dc.routes_count} Routes</span></td>
                    <td><span className="badge badge-success">{dc.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Territories Table */}
      {activeTab === 'territories' && (
        <div className="table-card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Territory Code</th>
                  <th>Territory Name</th>
                  <th>Assigned DC</th>
                  <th>District</th>
                  <th>Province</th>
                  <th>Covered Shops</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {territories.map(t => (
                  <tr key={t.id}>
                    <td><strong>{t.code}</strong></td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{t.name}</td>
                    <td>{t.dc_name || 'Central Hub'}</td>
                    <td>{t.district}</td>
                    <td>{t.province}</td>
                    <td><span className="badge badge-purple">{t.shop_count} Shops</span></td>
                    <td><span className="badge badge-success">{t.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Register Distributor */}
      {showDistModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Register New Distributor Organization</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowDistModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateDistributor}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Distributor Code *</label>
                    <input className="form-control" required placeholder="e.g. DIST-NEG" value={distForm.code} onChange={e => setDistForm({...distForm, code: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Company / Distributor Name *</label>
                    <input className="form-control" required placeholder="e.g. Negombo Distribution Hub" value={distForm.name} onChange={e => setDistForm({...distForm, name: e.target.value})} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Business Reg. No.</label>
                    <input className="form-control" placeholder="e.g. PV-12948" value={distForm.reg_number} onChange={e => setDistForm({...distForm, reg_number: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Contact Person</label>
                    <input className="form-control" placeholder="e.g. Priyantha Fernando" value={distForm.contact_person} onChange={e => setDistForm({...distForm, contact_person: e.target.value})} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Phone Number</label>
                    <input className="form-control" placeholder="+94 77 123 4567" value={distForm.phone} onChange={e => setDistForm({...distForm, phone: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Email Address</label>
                    <input className="form-control" type="email" placeholder="contact@dist.lk" value={distForm.email} onChange={e => setDistForm({...distForm, email: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Official Address</label>
                  <input className="form-control" placeholder="Full registered address" value={distForm.address} onChange={e => setDistForm({...distForm, address: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowDistModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Distributor</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Distribution Center */}
      {showDcModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Create New Distribution Center</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowDcModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateDc}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Assigned Distributor *</label>
                  <select className="form-control" value={dcForm.distributor_id} onChange={e => setDcForm({...dcForm, distributor_id: Number(e.target.value)})}>
                    {distributors.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>DC Name *</label>
                    <input className="form-control" required placeholder="e.g. Negombo City DC" value={dcForm.name} onChange={e => setDcForm({...dcForm, name: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>DC Code *</label>
                    <input className="form-control" required placeholder="e.g. DC-NEG-01" value={dcForm.code} onChange={e => setDcForm({...dcForm, code: e.target.value})} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Town</label>
                    <input className="form-control" placeholder="e.g. Negombo" value={dcForm.town} onChange={e => setDcForm({...dcForm, town: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>District</label>
                    <input className="form-control" placeholder="e.g. Gampaha" value={dcForm.district} onChange={e => setDcForm({...dcForm, district: e.target.value})} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Center Manager</label>
                    <input className="form-control" placeholder="e.g. Sunil Perera" value={dcForm.manager} onChange={e => setDcForm({...dcForm, manager: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Contact Number</label>
                    <input className="form-control" placeholder="+94 31 222 3456" value={dcForm.contact_number} onChange={e => setDcForm({...dcForm, contact_number: e.target.value})} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowDcModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Distribution Center</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default DistributorsPage;
