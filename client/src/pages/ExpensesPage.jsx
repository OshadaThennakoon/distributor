import React, { useEffect, useState } from 'react';
import api from '../utils/api.js';
import { useTenant } from '../contexts/TenantContext.jsx';
import { formatCurrency, formatDate } from '../utils/formatters.js';
import { Wallet, Plus, Filter, Tag } from 'lucide-react';

export function ExpensesPage() {
  const { activeDistributorId, currencySymbol } = useTenant();
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);

  const [expForm, setExpForm] = useState({
    distributor_id: 1,
    category_id: 1,
    date: new Date().toISOString().split('T')[0],
    amount: 15000,
    payment_method: 'cash',
    receipt_number: '',
    description: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [expData, catData] = await Promise.all([
        api.get('/finance/expenses'),
        api.get('/finance/expense-categories')
      ]);
      setExpenses(expData);
      setCategories(catData);
      if (catData.length > 0 && !expForm.category_id) {
        setExpForm(prev => ({ ...prev, category_id: catData[0].id }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeDistributorId]);

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    try {
      await api.post('/finance/expenses', expForm);
      setShowAddModal(false);
      loadData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const filteredExpenses = selectedCategory === 'all'
    ? expenses
    : expenses.filter(e => String(e.category_id) === String(selectedCategory));

  const totalAmount = filteredExpenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title">
          <h1>Operating Expense Management</h1>
          <p>Track fixed overheads, variable route costs, vehicle maintenance, staff compensation, and logistics expenses.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={14} />
            <span>Record New Expense</span>
          </button>
        </div>
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>Filter Category:</span>
            <select
              className="form-control"
              style={{ width: 'auto', padding: '6px 12px' }}
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
            >
              <option value="all">All Expense Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            Total Filtered: <span style={{ color: 'var(--danger)' }}>{formatCurrency(totalAmount, currencySymbol)}</span>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Expense Category</th>
                <th>Amount</th>
                <th>Vehicle</th>
                <th>Route</th>
                <th>Recipient / Supplier</th>
                <th>Payment Method</th>
                <th>Receipt #</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map(e => (
                <tr key={e.id}>
                  <td>{formatDate(e.date)}</td>
                  <td><span className="badge badge-purple">{e.category_name}</span></td>
                  <td style={{ color: 'var(--danger)', fontWeight: '700' }}>
                    {formatCurrency(e.amount, currencySymbol)}
                  </td>
                  <td>{e.vehicle_number || '-'}</td>
                  <td>{e.route_name ? e.route_name.split(' - ')[1] || e.route_name : '-'}</td>
                  <td>{e.supplier_name || e.employee_name || '-'}</td>
                  <td><span className="badge badge-info">{e.payment_method}</span></td>
                  <td>{e.receipt_number || '-'}</td>
                  <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.description || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add Expense */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Record Operating Expense</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateExpense}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Expense Category *</label>
                    <select className="form-control" value={expForm.category_id} onChange={e => setExpForm({...expForm, category_id: Number(e.target.value)})}>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Amount (Rs.) *</label>
                    <input className="form-control" type="number" required value={expForm.amount} onChange={e => setExpForm({...expForm, amount: Number(e.target.value)})} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Date *</label>
                    <input className="form-control" type="date" required value={expForm.date} onChange={e => setExpForm({...expForm, date: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Payment Method</label>
                    <select className="form-control" value={expForm.payment_method} onChange={e => setExpForm({...expForm, payment_method: e.target.value})}>
                      <option value="cash">Cash</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="cheque">Cheque</option>
                      <option value="card">Card</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Receipt Number</label>
                  <input className="form-control" placeholder="RCP-XXXX" value={expForm.receipt_number} onChange={e => setExpForm({...expForm, receipt_number: e.target.value})} />
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <input className="form-control" placeholder="Purpose of payment" value={expForm.description} onChange={e => setExpForm({...expForm, description: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExpensesPage;
