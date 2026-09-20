import React, { useEffect, useState } from 'react';
import api from '../utils/api.js';
import { useTenant } from '../contexts/TenantContext.jsx';
import { formatDate } from '../utils/formatters.js';
import { Calendar, CheckCircle2, Clock, AlertTriangle, ArrowRight, User, Truck } from 'lucide-react';

export function VisitSchedulePage() {
  const { activeDistributorId } = useTenant();
  const [schedules, setSchedules] = useState(null);
  const [activeTab, setActiveTab] = useState('dueToday');
  const [loading, setLoading] = useState(true);

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const data = await api.get('/shop-visits/schedules');
      setSchedules(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedules();
  }, [activeDistributorId]);

  const handleMarkCompleted = async (item) => {
    try {
      await api.post('/shop-visits', {
        distributor_id: 1,
        route_id: item.routeId,
        shop_id: item.shopId,
        planned_date: item.nextVisitDate,
        actual_visit_date: new Date().toISOString().split('T')[0],
        status: 'completed',
        order_amount: 18500
      });
      alert(`Visit to ${item.shopName} recorded as completed!`);
      loadSchedules();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  if (loading || !schedules) {
    return <div className="page-container">Loading visit schedules...</div>;
  }

  const currentList = schedules[activeTab] || [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title">
          <h1>Cyclic Shop Visit Schedule Engine</h1>
          <p>Automated 21-day replenishment cycle projections, due visit monitors, and driver delivery logs.</p>
        </div>
      </div>

      {/* Summary KPI Pills */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        <div
          className={`table-card ${activeTab === 'dueToday' ? 'active' : ''}`}
          style={{ padding: '16px', cursor: 'pointer', borderLeft: '4px solid var(--warning)' }}
          onClick={() => setActiveTab('dueToday')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>DUE TODAY</span>
            <Clock size={16} color="var(--warning)" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-primary)', marginTop: '6px' }}>
            {schedules.summary.dueTodayCount}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--warning)' }}>Scheduled for execution today</span>
        </div>

        <div
          className={`table-card ${activeTab === 'dueThisWeek' ? 'active' : ''}`}
          style={{ padding: '16px', cursor: 'pointer', borderLeft: '4px solid var(--primary)' }}
          onClick={() => setActiveTab('dueThisWeek')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>DUE THIS WEEK</span>
            <Calendar size={16} color="var(--primary)" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-primary)', marginTop: '6px' }}>
            {schedules.summary.dueThisWeekCount}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--primary)' }}>Next 7 days delivery pipeline</span>
        </div>

        <div
          className={`table-card ${activeTab === 'overdue' ? 'active' : ''}`}
          style={{ padding: '16px', cursor: 'pointer', borderLeft: '4px solid var(--danger)' }}
          onClick={() => setActiveTab('overdue')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>OVERDUE VISITS</span>
            <AlertTriangle size={16} color="var(--danger)" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--danger)', marginTop: '6px' }}>
            {schedules.summary.overdueCount}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--danger)' }}>Missed past scheduled cycle</span>
        </div>

        <div
          className={`table-card ${activeTab === 'upcoming' ? 'active' : ''}`}
          style={{ padding: '16px', cursor: 'pointer', borderLeft: '4px solid var(--info)' }}
          onClick={() => setActiveTab('upcoming')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>FUTURE CYCLES</span>
            <CheckCircle2 size={16} color="var(--info)" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-primary)', marginTop: '6px' }}>
            {schedules.summary.upcomingCount}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--info)' }}>Upcoming 21-day cycles</span>
        </div>
      </div>

      {/* Detail Table */}
      <div className="table-card">
        <div className="table-toolbar">
          <span style={{ fontWeight: '600' }}>
            Showing {activeTab === 'dueToday' ? 'Due Today' : activeTab === 'dueThisWeek' ? 'Due This Week' : activeTab === 'overdue' ? 'Overdue' : 'Upcoming'} Outlets ({currentList.length})
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Cycle interval: 21 Days</span>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Shop Code</th>
                <th>Shop Name</th>
                <th>Town</th>
                <th>Assigned Route</th>
                <th>Last Visit Date</th>
                <th>Target Next Visit</th>
                <th>Following Projections (21-Day Intervals)</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {currentList.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    No shop visits in this status category.
                  </td>
                </tr>
              ) : (
                currentList.map(item => (
                  <tr key={item.shopId}>
                    <td><strong>{item.shopCode}</strong></td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{item.shopName}</td>
                    <td>{item.town}</td>
                    <td>{item.routeName ? item.routeName.split(' - ')[1] || item.routeName : '-'}</td>
                    <td>{formatDate(item.lastVisitDate)}</td>
                    <td>
                      <span className={`badge ${item.status === 'overdue' ? 'badge-danger' : item.status === 'due_today' ? 'badge-warning' : 'badge-info'}`}>
                        {item.nextVisitDate}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        <span>{item.futureVisits?.[1]?.formatted || '-'}</span>
                        <ArrowRight size={10} />
                        <span>{item.futureVisits?.[2]?.formatted || '-'}</span>
                        <ArrowRight size={10} />
                        <span>{item.futureVisits?.[3]?.formatted || '-'}</span>
                      </div>
                    </td>
                    <td>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleMarkCompleted(item)}
                      >
                        <CheckCircle2 size={13} />
                        <span>Complete</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default VisitSchedulePage;
