import React, { useState, useEffect } from 'react';
import api from '../utils/api.js';
import { useTenant } from '../contexts/TenantContext.jsx';
import { formatCurrency, formatDate, formatNumber } from '../utils/formatters.js';
import {
  Boxes, Package, AlertTriangle, Clock, ArrowDownLeft, ArrowUpRight,
  Search, RefreshCw, Plus, Edit2, ShieldAlert, CheckCircle2,
  TrendingUp, Tag, FileText, Layers, Truck, Filter, X
} from 'lucide-react';

export function StockManagementPage() {
  const { activeDistributorId, currencySymbol } = useTenant();

  // State
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [movements, setMovements] = useState([]);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory', 'grn', 'movements', 'reorder', 'expiry'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all'); // 'all', 'low_stock', 'near_expiry', 'in_stock'
  const [movementFilter, setMovementFilter] = useState('all');

  // Modals
  const [showInwardModal, setShowInwardModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showEditProductModal, setShowEditProductModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  // Forms
  const [inwardForm, setInwardForm] = useState({
    product_id: '',
    quantity: '',
    unit_cost: '',
    batch_number: '',
    expiry_date: '',
    reference_number: '',
    supplier_name: 'Jeewaka Herbals Central Factory',
    notes: '',
    date: new Date().toISOString().split('T')[0]
  });

  const [adjustForm, setAdjustForm] = useState({
    product_id: '',
    adjustment_type: 'DAMAGE_DISPOSAL',
    quantity: '',
    reason: '',
    date: new Date().toISOString().split('T')[0]
  });

  const [productForm, setProductForm] = useState({
    product_name: '',
    sku: '',
    category_id: 1,
    brand: 'Jeewaka Herbals',
    unit: 'bottle',
    cost_price: '',
    selling_price: '',
    mrp: '',
    stock_quantity: 0,
    min_stock_level: 30,
    batch_number: '',
    expiry_date: ''
  });

  const [editForm, setEditForm] = useState({
    id: null,
    product_name: '',
    category_id: '',
    brand: '',
    unit: '',
    cost_price: '',
    selling_price: '',
    mrp: '',
    min_stock_level: '',
    batch_number: '',
    expiry_date: ''
  });

  // Fetch all stock data
  const loadData = async () => {
    setLoading(true);
    try {
      const [sumData, prodData, moveData, catData] = await Promise.all([
        api.get('/stock/summary'),
        api.get('/stock/products'),
        api.get('/stock/movements'),
        api.get('/stock/categories')
      ]);
      setSummary(sumData);
      setProducts(prodData);
      setMovements(moveData);
      setCategories(catData);

      if (prodData.length > 0 && !inwardForm.product_id) {
        setInwardForm(prev => ({
          ...prev,
          product_id: prodData[0].id,
          unit_cost: prodData[0].cost_price,
          batch_number: prodData[0].batch_number || '',
          expiry_date: prodData[0].expiry_date ? prodData[0].expiry_date.split('T')[0] : ''
        }));
        setAdjustForm(prev => ({ ...prev, product_id: prodData[0].id }));
      }
    } catch (err) {
      console.error('Failed to load stock data:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Error loading stock information' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeDistributorId]);

  // Flash timer
  useEffect(() => {
    if (statusMessage) {
      const t = setTimeout(() => setStatusMessage(null), 5000);
      return () => clearTimeout(t);
    }
  }, [statusMessage]);

  // Modal Handlers
  const handleOpenInward = (prod = null) => {
    const target = prod || products[0];
    if (target) {
      setInwardForm({
        product_id: target.id,
        quantity: target.stock_quantity <= target.min_stock_level ? (target.min_stock_level * 3 - target.stock_quantity) : 100,
        unit_cost: target.cost_price,
        batch_number: `JH-2026-B${Math.floor(100 + Math.random() * 900)}`,
        expiry_date: new Date(Date.now() + 730 * 86400000).toISOString().split('T')[0], // 2 years default
        reference_number: `GRN-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        supplier_name: 'Jeewaka Herbals Central Factory',
        notes: `Restock consignment for ${target.product_name}`,
        date: new Date().toISOString().split('T')[0]
      });
    }
    setShowInwardModal(true);
  };

  const handleInwardSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/stock/inward', inwardForm);
      setStatusMessage({ type: 'success', text: `Stock In (GRN) of ${inwardForm.quantity} units recorded successfully!` });
      setShowInwardModal(false);
      loadData();
    } catch (err) {
      alert('Error receiving stock: ' + err.message);
    }
  };

  const handleOpenAdjust = (prod = null) => {
    const target = prod || products[0];
    if (target) {
      setAdjustForm({
        product_id: target.id,
        adjustment_type: 'DAMAGE_DISPOSAL',
        quantity: 5,
        reason: 'Broken/damaged packaging during warehouse handling',
        date: new Date().toISOString().split('T')[0]
      });
    }
    setShowAdjustModal(true);
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/stock/adjust', adjustForm);
      setStatusMessage({ type: 'success', text: `Stock adjustment (${adjustForm.adjustment_type}) recorded successfully!` });
      setShowAdjustModal(false);
      loadData();
    } catch (err) {
      alert('Error adjusting stock: ' + err.message);
    }
  };

  const handleOpenEdit = (prod) => {
    setSelectedProduct(prod);
    setEditForm({
      id: prod.id,
      product_name: prod.product_name,
      category_id: prod.category_id || 1,
      brand: prod.brand || 'Jeewaka Herbals',
      unit: prod.unit || 'bottle',
      cost_price: prod.cost_price,
      selling_price: prod.selling_price,
      mrp: prod.mrp || prod.selling_price * 1.2,
      min_stock_level: prod.min_stock_level,
      batch_number: prod.batch_number || '',
      expiry_date: prod.expiry_date ? prod.expiry_date.split('T')[0] : ''
    });
    setShowEditProductModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/stock/products/${editForm.id}`, editForm);
      setStatusMessage({ type: 'success', text: `Product "${editForm.product_name}" updated successfully!` });
      setShowEditProductModal(false);
      loadData();
    } catch (err) {
      alert('Error updating product: ' + err.message);
    }
  };

  const handleAddProductSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/stock/products', productForm);
      setStatusMessage({ type: 'success', text: `New SKU "${productForm.product_name}" added to catalog!` });
      setShowAddProductModal(false);
      setProductForm({
        product_name: '', sku: '', category_id: 1, brand: 'Jeewaka Herbals',
        unit: 'bottle', cost_price: '', selling_price: '', mrp: '', stock_quantity: 0,
        min_stock_level: 30, batch_number: '', expiry_date: ''
      });
      loadData();
    } catch (err) {
      alert('Error creating product: ' + err.message);
    }
  };

  // Filtered Products
  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'all' || String(p.category_id) === String(selectedCategory);
    let matchesStatus = true;
    if (selectedStatus === 'low_stock') {
      matchesStatus = p.stock_quantity <= p.min_stock_level && p.stock_quantity > 0;
    } else if (selectedStatus === 'out_of_stock') {
      matchesStatus = p.stock_quantity === 0;
    } else if (selectedStatus === 'near_expiry') {
      matchesStatus = p.days_until_expiry !== null && p.days_until_expiry <= 90;
    } else if (selectedStatus === 'in_stock') {
      matchesStatus = p.stock_quantity > p.min_stock_level;
    }

    const term = searchQuery.toLowerCase();
    const matchesSearch = !term ||
      p.product_name.toLowerCase().includes(term) ||
      p.sku.toLowerCase().includes(term) ||
      (p.brand && p.brand.toLowerCase().includes(term)) ||
      (p.batch_number && p.batch_number.toLowerCase().includes(term));

    return matchesCat && matchesStatus && matchesSearch;
  });

  // Filtered Movements
  const filteredMovements = movements.filter(m => {
    if (movementFilter === 'all') return true;
    return m.movement_type === movementFilter;
  });

  const metrics = summary?.metrics || {};

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              padding: '8px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(59, 130, 246, 0.3)'
            }}>
              <Boxes size={24} color="#fff" />
            </div>
            <div>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                Warehouse Stock & Inventory Hub
                <span className="badge badge-info" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
                  Live Stock Control
                </span>
              </h1>
              <p>Physical inventory valuation, batch expiry monitoring, Goods Received Notes (GRN), and reorder alerts.</p>
            </div>
          </div>
        </div>

        {/* Global Action Bar */}
        <div className="page-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={loadData} title="Refresh Inventory" disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button className="btn btn-secondary" onClick={() => handleOpenAdjust()}>
            <ShieldAlert size={14} color="#f87171" />
            <span>Stock Adjustment / Damage</span>
          </button>

          <button className="btn btn-secondary" onClick={() => setShowAddProductModal(true)}>
            <Plus size={14} />
            <span>New SKU</span>
          </button>

          <button 
            className="btn btn-primary" 
            style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
            onClick={() => handleOpenInward()}
          >
            <ArrowDownLeft size={14} />
            <span>Receive Stock (GRN)</span>
          </button>
        </div>
      </div>

      {/* Alert banner if any */}
      {statusMessage && (
        <div style={{
          padding: '12px 20px',
          borderRadius: '10px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          border: `1px solid ${statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          color: statusMessage.type === 'success' ? '#34d399' : '#f87171'
        }}>
          {statusMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{statusMessage.text}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TOP STOCK METRIC CARDS */}
      {/* ========================================================================= */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', marginBottom: '28px' }}>
        
        {/* Card 1: Inventory Valuation (Cost) */}
        <div className="kpi-card" style={{
          borderLeft: '4px solid #6366f1',
          background: 'radial-gradient(circle at top right, rgba(99, 102, 241, 0.08) 0%, var(--bg-card) 70%)'
        }}>
          <div className="kpi-card-header">
            <span className="kpi-title" style={{ color: '#818cf8' }}>Total Stock Valuation (Cost)</span>
            <div className="kpi-icon-box" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' }}>
              <Boxes size={20} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#818cf8', fontSize: '1.75rem' }}>
            {formatCurrency(metrics.totalCostValue, currencySymbol)}
          </div>
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', marginTop: '8px', fontSize: '0.78rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Retail Valuation:</span>
              <strong style={{ color: '#38bdf8' }}>{formatCurrency(metrics.totalRetailValue, currencySymbol)}</strong>
            </div>
          </div>
          <div style={{ marginTop: '6px', fontSize: '0.72rem', color: '#34d399' }}>
            Potential Gross Profit: +{formatCurrency(metrics.potentialGrossProfit, currencySymbol)} ({metrics.potentialMarginPercent}%)
          </div>
        </div>

        {/* Card 2: Total Units in Stock */}
        <div className="kpi-card" style={{
          borderLeft: '4px solid #10b981',
          background: 'radial-gradient(circle at top right, rgba(16, 185, 129, 0.08) 0%, var(--bg-card) 70%)'
        }}>
          <div className="kpi-card-header">
            <span className="kpi-title" style={{ color: '#34d399' }}>Total Warehouse Stock</span>
            <div className="kpi-icon-box" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
              <Package size={20} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#10b981', fontSize: '1.75rem' }}>
            {formatNumber(metrics.totalUnits)} <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-muted)' }}>Units</span>
          </div>
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', marginTop: '8px', fontSize: '0.78rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Active Catalog SKUs:</span>
              <strong style={{ color: '#e2e8f0' }}>{metrics.totalSkus || 0} Products</strong>
            </div>
          </div>
          <div style={{ marginTop: '6px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Herbal Arishta, Oils, Balms & Teas
          </div>
        </div>

        {/* Card 3: Low Stock Alerts */}
        <div className="kpi-card" style={{
          borderLeft: '4px solid #ef4444',
          background: 'radial-gradient(circle at top right, rgba(239, 68, 68, 0.08) 0%, var(--bg-card) 70%)'
        }}>
          <div className="kpi-card-header">
            <span className="kpi-title" style={{ color: '#f87171' }}>Low Stock & Reorder</span>
            <div className="kpi-icon-box" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#f87171', fontSize: '1.75rem' }}>
            {metrics.lowStockCount || 0} <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-muted)' }}>SKUs Low</span>
          </div>
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', marginTop: '8px', fontSize: '0.78rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Out of Stock (Zero):</span>
              <strong style={{ color: metrics.outOfStockCount > 0 ? '#f87171' : '#34d399' }}>
                {metrics.outOfStockCount || 0} SKUs
              </strong>
            </div>
          </div>
          <div style={{ marginTop: '6px', fontSize: '0.72rem', color: '#f87171' }}>
            Below safety buffer threshold
          </div>
        </div>

        {/* Card 4: Near Expiry Alerts */}
        <div className="kpi-card" style={{
          borderLeft: '4px solid #f59e0b',
          background: 'radial-gradient(circle at top right, rgba(245, 158, 11, 0.08) 0%, var(--bg-card) 70%)'
        }}>
          <div className="kpi-card-header">
            <span className="kpi-title" style={{ color: '#fbbf24' }}>Batch Expiry Watch</span>
            <div className="kpi-icon-box" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
              <Clock size={20} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#fbbf24', fontSize: '1.75rem' }}>
            {metrics.nearExpiryCount || 0} <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-muted)' }}>Near Expiry</span>
          </div>
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', marginTop: '8px', fontSize: '0.78rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Expiry Horizon:</span>
              <strong style={{ color: '#fbbf24' }}>Within 90 Days</strong>
            </div>
          </div>
          <div style={{ marginTop: '6px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            FIFO dispatch prioritisation active
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TABS NAVIGATION */}
      {/* ========================================================================= */}
      <div style={{
        display: 'flex',
        gap: '8px',
        borderBottom: '1px solid var(--border-subtle)',
        marginBottom: '24px',
        overflowX: 'auto',
        paddingBottom: '2px'
      }}>
        <button
          onClick={() => setActiveTab('inventory')}
          style={{
            padding: '10px 18px',
            background: activeTab === 'inventory' ? 'var(--bg-card)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'inventory' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'inventory' ? '#fff' : 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: '0.88rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderRadius: '6px 6px 0 0',
            transition: 'all 0.15s ease'
          }}
        >
          <Boxes size={16} color={activeTab === 'inventory' ? '#3b82f6' : 'currentColor'} />
          <span>Warehouse Inventory Catalog ({products.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('grn')}
          style={{
            padding: '10px 18px',
            background: activeTab === 'grn' ? 'var(--bg-card)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'grn' ? '2px solid #10b981' : '2px solid transparent',
            color: activeTab === 'grn' ? '#fff' : 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: '0.88rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderRadius: '6px 6px 0 0',
            transition: 'all 0.15s ease'
          }}
        >
          <ArrowDownLeft size={16} color={activeTab === 'grn' ? '#10b981' : 'currentColor'} />
          <span>Goods Received Notes (GRN) Inward</span>
        </button>

        <button
          onClick={() => setActiveTab('movements')}
          style={{
            padding: '10px 18px',
            background: activeTab === 'movements' ? 'var(--bg-card)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'movements' ? '2px solid #6366f1' : '2px solid transparent',
            color: activeTab === 'movements' ? '#fff' : 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: '0.88rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderRadius: '6px 6px 0 0',
            transition: 'all 0.15s ease'
          }}
        >
          <FileText size={16} color={activeTab === 'movements' ? '#6366f1' : 'currentColor'} />
          <span>Stock Movements Ledger ({movements.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('reorder')}
          style={{
            padding: '10px 18px',
            background: activeTab === 'reorder' ? 'var(--bg-card)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'reorder' ? '2px solid #ef4444' : '2px solid transparent',
            color: activeTab === 'reorder' ? '#fff' : 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: '0.88rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderRadius: '6px 6px 0 0',
            transition: 'all 0.15s ease'
          }}
        >
          <AlertTriangle size={16} color={activeTab === 'reorder' ? '#ef4444' : 'currentColor'} />
          <span>Low Stock Reorder Plan</span>
          {metrics.lowStockCount > 0 && (
            <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>
              {metrics.lowStockCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('expiry')}
          style={{
            padding: '10px 18px',
            background: activeTab === 'expiry' ? 'var(--bg-card)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'expiry' ? '2px solid #f59e0b' : '2px solid transparent',
            color: activeTab === 'expiry' ? '#fff' : 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: '0.88rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderRadius: '6px 6px 0 0',
            transition: 'all 0.15s ease'
          }}
        >
          <Clock size={16} color={activeTab === 'expiry' ? '#f59e0b' : 'currentColor'} />
          <span>Batch & Expiry Timeline</span>
          {metrics.nearExpiryCount > 0 && (
            <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
              {metrics.nearExpiryCount}
            </span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: WAREHOUSE INVENTORY CATALOG */}
      {/* ========================================================================= */}
      {activeTab === 'inventory' && (
        <div className="table-card">
          <div className="table-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div className="search-input-box">
                <Search size={14} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Search product name, SKU, brand, batch..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Category Filter */}
              <select
                className="form-control"
                style={{ width: 'auto', padding: '6px 12px' }}
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
              >
                <option value="all">All Categories</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              {/* Health Status Pills */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  className={`btn ${selectedStatus === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                  onClick={() => setSelectedStatus('all')}
                >
                  All ({products.length})
                </button>
                <button
                  className={`btn ${selectedStatus === 'low_stock' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 12px', fontSize: '0.75rem', background: selectedStatus === 'low_stock' ? '#ef4444' : undefined }}
                  onClick={() => setSelectedStatus('low_stock')}
                >
                  Low Stock ({metrics.lowStockCount || 0})
                </button>
                <button
                  className={`btn ${selectedStatus === 'near_expiry' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 12px', fontSize: '0.75rem', background: selectedStatus === 'near_expiry' ? '#f59e0b' : undefined }}
                  onClick={() => setSelectedStatus('near_expiry')}
                >
                  Near Expiry ({metrics.nearExpiryCount || 0})
                </button>
                <button
                  className={`btn ${selectedStatus === 'in_stock' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 12px', fontSize: '0.75rem', background: selectedStatus === 'in_stock' ? '#10b981' : undefined }}
                  onClick={() => setSelectedStatus('in_stock')}
                >
                  Healthy Stock
                </button>
              </div>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Showing {filteredProducts.length} Products
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>SKU & Product Name</th>
                  <th>Category</th>
                  <th>Batch / Expiry</th>
                  <th style={{ textAlign: 'right' }}>Cost Price</th>
                  <th style={{ textAlign: 'right' }}>Selling Price</th>
                  <th style={{ textAlign: 'right' }}>Margin %</th>
                  <th style={{ textAlign: 'center' }}>Current Stock</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      No products found matching the criteria.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map(p => {
                    const isLow = p.stock_quantity <= p.min_stock_level;
                    const isOut = p.stock_quantity === 0;
                    const isNearExp = p.days_until_expiry !== null && p.days_until_expiry <= 90;
                    return (
                      <tr key={p.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.product_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {p.sku} • {p.unit}
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {p.category_name}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{p.batch_number || 'BATCH-01'}</div>
                          <div style={{ fontSize: '0.72rem', color: isNearExp ? '#fbbf24' : 'var(--text-muted)' }}>
                            Exp: {formatDate(p.expiry_date)} {isNearExp ? `(${p.days_until_expiry}d)` : ''}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                          {formatCurrency(p.cost_price, currencySymbol)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {formatCurrency(p.selling_price, currencySymbol)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: '#10b981' }}>
                          {p.gross_margin_percent}%
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: isLow ? '#f87171' : 'var(--text-primary)' }}>
                            {p.stock_quantity} {p.unit}s
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            Min Buffer: {p.min_stock_level}
                          </div>
                        </td>
                        <td>
                          {isOut ? (
                            <span className="badge badge-danger">Out of Stock</span>
                          ) : isLow ? (
                            <span className="badge badge-danger">Low Stock</span>
                          ) : isNearExp ? (
                            <span className="badge badge-warning">Near Expiry</span>
                          ) : (
                            <span className="badge badge-success">In Stock</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '0.72rem', color: '#10b981' }}
                              title="Receive Stock"
                              onClick={() => handleOpenInward(p)}
                            >
                              <ArrowDownLeft size={12} /> Stock In
                            </button>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '0.72rem', color: '#f87171' }}
                              title="Damage / Adjust"
                              onClick={() => handleOpenAdjust(p)}
                            >
                              Adjust
                            </button>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                              title="Edit Product"
                              onClick={() => handleOpenEdit(p)}
                            >
                              <Edit2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: GOODS RECEIVED NOTES (GRN) INWARD FORM */}
      {/* ========================================================================= */}
      {activeTab === 'grn' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
          
          {/* GRN Inward Wizard */}
          <div className="table-card">
            <div className="table-toolbar">
              <div style={{ fontWeight: 600, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ArrowDownLeft size={18} color="#10b981" />
                <span>Goods Received Note (GRN) - Stock In Receipt</span>
              </div>
            </div>

            <form onSubmit={handleInwardSubmit} style={{ padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label className="form-label">Select Herbal Product *</label>
                  <select
                    className="form-control"
                    value={inwardForm.product_id}
                    onChange={e => {
                      const id = e.target.value;
                      const prod = products.find(x => String(x.id) === String(id));
                      setInwardForm(prev => ({
                        ...prev,
                        product_id: id,
                        unit_cost: prod ? prod.cost_price : prev.unit_cost
                      }));
                    }}
                    required
                  >
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.product_name} ({p.sku}) - Current Stock: {p.stock_quantity}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Quantity Received *</label>
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      placeholder="e.g. 200"
                      value={inwardForm.quantity}
                      onChange={e => setInwardForm(prev => ({ ...prev, quantity: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Unit Factory Cost ({currencySymbol}) *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={inwardForm.unit_cost}
                      onChange={e => setInwardForm(prev => ({ ...prev, unit_cost: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Batch Number *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. JH-2026-B115"
                      value={inwardForm.batch_number}
                      onChange={e => setInwardForm(prev => ({ ...prev, batch_number: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Expiry Date *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={inwardForm.expiry_date}
                      onChange={e => setInwardForm(prev => ({ ...prev, expiry_date: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">GRN Reference # *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={inwardForm.reference_number}
                      onChange={e => setInwardForm(prev => ({ ...prev, reference_number: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Arrival Date *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={inwardForm.date}
                      onChange={e => setInwardForm(prev => ({ ...prev, date: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Manufacturer / Consignor</label>
                  <input
                    type="text"
                    className="form-control"
                    value={inwardForm.supplier_name}
                    onChange={e => setInwardForm(prev => ({ ...prev, supplier_name: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="form-label">Notes & Consignment Details</label>
                  <textarea
                    rows={2}
                    className="form-control"
                    value={inwardForm.notes}
                    onChange={e => setInwardForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="e.g. Received via delivery lorry WP-LB-3819 in good condition"
                  />
                </div>

                <div style={{ marginTop: '10px' }}>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%', background: '#10b981', padding: '10px' }}>
                    <ArrowDownLeft size={16} /> Confirm Inward Stock Receipt
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Category Breakdown & Quick Facts */}
          <div>
            <div className="table-card">
              <div className="table-toolbar">
                <span style={{ fontWeight: 600 }}>Category Stock Valuation</span>
              </div>
              <div style={{ padding: '16px' }}>
                {(summary?.categoryBreakdown || []).map(cat => (
                  <div key={cat.category_id} style={{
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    marginBottom: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cat.category_name}</span>
                      <span className="badge badge-info">{cat.sku_count} SKUs</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <span>Units in Stock: <strong>{formatNumber(cat.total_units)}</strong></span>
                      <span style={{ color: '#818cf8', fontWeight: 600 }}>{formatCurrency(cat.cost_value, currencySymbol)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: STOCK MOVEMENTS AUDIT LEDGER */}
      {/* ========================================================================= */}
      {activeTab === 'movements' && (
        <div className="table-card">
          <div className="table-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontWeight: 600, fontSize: '1rem' }}>Stock Transactions & Movements Audit Ledger</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  className={`btn ${movementFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                  onClick={() => setMovementFilter('all')}
                >
                  All Transactions
                </button>
                <button
                  className={`btn ${movementFilter === 'INWARD_GRN' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '4px 10px', fontSize: '0.75rem', background: movementFilter === 'INWARD_GRN' ? '#10b981' : undefined }}
                  onClick={() => setMovementFilter('INWARD_GRN')}
                >
                  GRN Inward (+)
                </button>
                <button
                  className={`btn ${movementFilter === 'DAMAGE_DISPOSAL' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '4px 10px', fontSize: '0.75rem', background: movementFilter === 'DAMAGE_DISPOSAL' ? '#ef4444' : undefined }}
                  onClick={() => setMovementFilter('DAMAGE_DISPOSAL')}
                >
                  Damages / Disposals (-)
                </button>
                <button
                  className={`btn ${movementFilter === 'AUDIT_CORRECTION' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '4px 10px', fontSize: '0.75rem', background: movementFilter === 'AUDIT_CORRECTION' ? '#f59e0b' : undefined }}
                  onClick={() => setMovementFilter('AUDIT_CORRECTION')}
                >
                  Audit Adjustments
                </button>
              </div>
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Product Name & SKU</th>
                  <th>Batch Number</th>
                  <th style={{ textAlign: 'right' }}>Quantity</th>
                  <th style={{ textAlign: 'center' }}>Stock Progression</th>
                  <th>Reference #</th>
                  <th>Authorized By / Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      No inventory movements logged.
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map(m => {
                    const isInward = m.movement_type === 'INWARD_GRN' || m.movement_type === 'RETURN_INWARD';
                    return (
                      <tr key={m.id}>
                        <td>
                          {isInward ? (
                            <span className="badge badge-success" style={{ gap: '4px' }}>
                              <ArrowDownLeft size={12} /> {m.movement_type}
                            </span>
                          ) : (
                            <span className="badge badge-danger" style={{ gap: '4px' }}>
                              <ArrowUpRight size={12} /> {m.movement_type}
                            </span>
                          )}
                        </td>
                        <td>{formatDate(m.date)}</td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.product_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{m.sku}</div>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{m.batch_number || '-'}</td>
                        <td style={{ 
                          textAlign: 'right', 
                          fontWeight: 700, 
                          color: isInward ? '#10b981' : '#f87171',
                          fontSize: '0.95rem'
                        }}>
                          {isInward ? '+' : '-'} {m.quantity} {m.unit || 'units'}
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '0.82rem', fontFamily: 'monospace' }}>
                          <span style={{ color: 'var(--text-muted)' }}>{m.previous_stock}</span> ➔ <strong style={{ color: 'var(--text-primary)' }}>{m.new_stock}</strong>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{m.reference_number}</td>
                        <td>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{m.notes || '-'}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>By: {m.performed_by || 'Admin'}</div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: LOW STOCK & REORDER ACTION PLAN */}
      {/* ========================================================================= */}
      {activeTab === 'reorder' && (
        <div className="table-card">
          <div className="table-toolbar">
            <div>
              <span style={{ fontWeight: 600, fontSize: '1rem', color: '#f87171' }}>
                Critical Stock Replenishment Action Plan
              </span>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Products that have breached minimum stock safety thresholds. Suggested reorder quantities calculated based on 3-week route cycle demands.
              </p>
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Current Stock</th>
                  <th>Min Safety Level</th>
                  <th style={{ textAlign: 'right' }}>Suggested Order Qty</th>
                  <th style={{ textAlign: 'right' }}>Estimated PO Cost</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {(summary?.lowStockAlerts || []).length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#34d399' }}>
                      <CheckCircle2 size={24} style={{ display: 'inline-block', marginBottom: '8px' }} />
                      <div>All catalog SKUs are currently above minimum safety stock thresholds!</div>
                    </td>
                  </tr>
                ) : (
                  (summary?.lowStockAlerts || []).map(item => (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.product_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{item.sku}</div>
                      </td>
                      <td>{item.category_name}</td>
                      <td>
                        <span className="badge badge-danger" style={{ fontSize: '0.85rem' }}>
                          {item.stock_quantity} {item.unit}s
                        </span>
                      </td>
                      <td>{item.min_stock_level} {item.unit}s</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#38bdf8', fontSize: '0.95rem' }}>
                        +{item.suggested_reorder} {item.unit}s
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {formatCurrency(item.suggested_reorder * item.cost_price, currencySymbol)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn btn-primary"
                          style={{ padding: '6px 14px', fontSize: '0.78rem', background: '#10b981' }}
                          onClick={() => handleOpenInward(item)}
                        >
                          <ArrowDownLeft size={14} /> Create Restock GRN
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: BATCH EXPIRY TIMELINE */}
      {/* ========================================================================= */}
      {activeTab === 'expiry' && (
        <div className="table-card">
          <div className="table-toolbar">
            <div>
              <span style={{ fontWeight: 600, fontSize: '1rem', color: '#fbbf24' }}>
                Batch Quality & Expiration Horizon Tracker
              </span>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Ayurvedic medicaments, arishta and syrups scheduled by expiry date to ensure FIFO rotation and prevent write-off losses.
              </p>
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Batch Number</th>
                  <th>Expiry Date</th>
                  <th>Days Remaining</th>
                  <th style={{ textAlign: 'right' }}>Stock on Hand</th>
                  <th style={{ textAlign: 'right' }}>Cost Value at Risk</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {products
                  .filter(p => p.expiry_date)
                  .sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date))
                  .map(p => {
                    const days = p.days_until_expiry;
                    const isUrgent = days !== null && days <= 90;
                    return (
                      <tr key={p.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.product_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.category_name}</div>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{p.batch_number || 'N/A'}</td>
                        <td>{formatDate(p.expiry_date)}</td>
                        <td>
                          <span className={`badge ${days <= 60 ? 'badge-danger' : days <= 90 ? 'badge-warning' : 'badge-success'}`}>
                            {days} Days Remaining
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {p.stock_quantity} {p.unit}s
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: isUrgent ? '#f87171' : 'var(--text-primary)' }}>
                          {formatCurrency(p.stock_quantity * p.cost_price, currencySymbol)}
                        </td>
                        <td>
                          {days <= 90 ? (
                            <span className="badge badge-warning">Priority Dispatch</span>
                          ) : (
                            <span className="badge badge-success">Good Shelf Life</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: RECEIVE STOCK (GRN) */}
      {/* ========================================================================= */}
      {showInwardModal && (
        <div className="modal-backdrop" onClick={() => setShowInwardModal(false)}>
          <div className="modal-card" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Receive Factory Stock (GRN)</h3>
              <button className="btn-close" onClick={() => setShowInwardModal(false)}>✕</button>
            </div>
            <form onSubmit={handleInwardSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label className="form-label">Herbal Product *</label>
                  <select
                    className="form-control"
                    value={inwardForm.product_id}
                    onChange={e => {
                      const id = e.target.value;
                      const prod = products.find(x => String(x.id) === String(id));
                      setInwardForm(prev => ({
                        ...prev,
                        product_id: id,
                        unit_cost: prod ? prod.cost_price : prev.unit_cost
                      }));
                    }}
                    required
                  >
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.product_name} ({p.sku})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Quantity to Inward *</label>
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      value={inwardForm.quantity}
                      onChange={e => setInwardForm(prev => ({ ...prev, quantity: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Unit Cost ({currencySymbol}) *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={inwardForm.unit_cost}
                      onChange={e => setInwardForm(prev => ({ ...prev, unit_cost: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Batch Number *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={inwardForm.batch_number}
                      onChange={e => setInwardForm(prev => ({ ...prev, batch_number: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Expiry Date *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={inwardForm.expiry_date}
                      onChange={e => setInwardForm(prev => ({ ...prev, expiry_date: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">GRN Reference Number *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={inwardForm.reference_number}
                    onChange={e => setInwardForm(prev => ({ ...prev, reference_number: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Consignment Notes</label>
                  <input
                    type="text"
                    className="form-control"
                    value={inwardForm.notes}
                    onChange={e => setInwardForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="e.g. Factory delivery inspected and stored in Area B"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowInwardModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#10b981' }}>
                  Confirm Stock In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: STOCK ADJUSTMENT / DAMAGE */}
      {/* ========================================================================= */}
      {showAdjustModal && (
        <div className="modal-backdrop" onClick={() => setShowAdjustModal(false)}>
          <div className="modal-card" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Stock Adjustment & Disposal</h3>
              <button className="btn-close" onClick={() => setShowAdjustModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAdjustSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label className="form-label">Select Product *</label>
                  <select
                    className="form-control"
                    value={adjustForm.product_id}
                    onChange={e => setAdjustForm(prev => ({ ...prev, product_id: e.target.value }))}
                    required
                  >
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.product_name} (Current Stock: {p.stock_quantity})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Adjustment Type *</label>
                  <select
                    className="form-control"
                    value={adjustForm.adjustment_type}
                    onChange={e => setAdjustForm(prev => ({ ...prev, adjustment_type: e.target.value }))}
                  >
                    <option value="DAMAGE_DISPOSAL">Damage / Breakage Disposal (-)</option>
                    <option value="EXPIRED_WRITE_OFF">Expired Product Write-Off (-)</option>
                    <option value="AUDIT_CORRECTION">Physical Stock Count Correction (-)</option>
                    <option value="RETURN_INWARD">Customer Unsold Goods Return (+)</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Quantity to Adjust *</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    value={adjustForm.quantity}
                    onChange={e => setAdjustForm(prev => ({ ...prev, quantity: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Reason & Incident Description *</label>
                  <textarea
                    rows={2}
                    className="form-control"
                    value={adjustForm.reason}
                    onChange={e => setAdjustForm(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder="e.g. Broken bottles during handling on Melsiripura route"
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdjustModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#ef4444' }}>
                  Execute Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: EDIT PRODUCT & PRICING */}
      {/* ========================================================================= */}
      {showEditProductModal && selectedProduct && (
        <div className="modal-backdrop" onClick={() => setShowEditProductModal(false)}>
          <div className="modal-card" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Product & Parameters</h3>
              <button className="btn-close" onClick={() => setShowEditProductModal(false)}>✕</button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label className="form-label">Product Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editForm.product_name}
                    onChange={e => setEditForm(prev => ({ ...prev, product_name: e.target.value }))}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Category</label>
                    <select
                      className="form-control"
                      value={editForm.category_id}
                      onChange={e => setEditForm(prev => ({ ...prev, category_id: e.target.value }))}
                    >
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Unit of Measure</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editForm.unit}
                      onChange={e => setEditForm(prev => ({ ...prev, unit: e.target.value }))}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Cost Price ({currencySymbol}) *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={editForm.cost_price}
                      onChange={e => setEditForm(prev => ({ ...prev, cost_price: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Selling Price ({currencySymbol}) *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={editForm.selling_price}
                      onChange={e => setEditForm(prev => ({ ...prev, selling_price: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">MRP (Max Retail Price)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={editForm.mrp}
                      onChange={e => setEditForm(prev => ({ ...prev, mrp: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="form-label">Min Reorder Level *</label>
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      value={editForm.min_stock_level}
                      onChange={e => setEditForm(prev => ({ ...prev, min_stock_level: e.target.value }))}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditProductModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: ADD NEW SKU */}
      {/* ========================================================================= */}
      {showAddProductModal && (
        <div className="modal-backdrop" onClick={() => setShowAddProductModal(false)}>
          <div className="modal-card" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New Product SKU</h3>
              <button className="btn-close" onClick={() => setShowAddProductModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddProductSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label className="form-label">Product Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Jeewaka Aralu Thailaya 100ml"
                    value={productForm.product_name}
                    onChange={e => setProductForm(prev => ({ ...prev, product_name: e.target.value }))}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">SKU Code *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. JH-OIL-15"
                      value={productForm.sku}
                      onChange={e => setProductForm(prev => ({ ...prev, sku: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Category *</label>
                    <select
                      className="form-control"
                      value={productForm.category_id}
                      onChange={e => setProductForm(prev => ({ ...prev, category_id: e.target.value }))}
                    >
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Cost Price ({currencySymbol}) *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      placeholder="e.g. 350.00"
                      value={productForm.cost_price}
                      onChange={e => setProductForm(prev => ({ ...prev, cost_price: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Selling Price ({currencySymbol}) *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      placeholder="e.g. 450.00"
                      value={productForm.selling_price}
                      onChange={e => setProductForm(prev => ({ ...prev, selling_price: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Initial Opening Stock</label>
                    <input
                      type="number"
                      min="0"
                      className="form-control"
                      value={productForm.stock_quantity}
                      onChange={e => setProductForm(prev => ({ ...prev, stock_quantity: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="form-label">Min Safety Reorder Level</label>
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      value={productForm.min_stock_level}
                      onChange={e => setProductForm(prev => ({ ...prev, min_stock_level: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddProductModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default StockManagementPage;
