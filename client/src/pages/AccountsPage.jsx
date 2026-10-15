import React, { useState, useEffect } from 'react';
import api from '../utils/api.js';
import { useTenant } from '../contexts/TenantContext.jsx';
import { formatCurrency, formatDate, formatNumber } from '../utils/formatters.js';
import {
  Landmark, Wallet, CreditCard, AlertCircle, ArrowUpRight, ArrowDownLeft,
  ArrowRightLeft, CheckCircle2, Clock, XCircle, Search, RefreshCw, Plus,
  FileText, Store, ChevronRight, Building, ShieldCheck, DollarSign, Eye
} from 'lucide-react';

export function AccountsPage() {
  const { activeDistributorId, currencySymbol } = useTenant();

  // State
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [cheques, setCheques] = useState([]);
  const [credits, setCredits] = useState({ debtorShops: [], unpaidInvoices: [] });
  const [bankAccounts, setBankAccounts] = useState([]);
  const [cashLogs, setCashLogs] = useState([]);
  
  // Navigation / Filters
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'cheques', 'credits', 'banking'
  const [chequeFilter, setChequeFilter] = useState('pending'); // 'all', 'pending', 'cleared', 'bounced'
  const [chequeSearch, setChequeSearch] = useState('');
  const [creditSearch, setCreditSearch] = useState('');
  const [creditViewMode, setCreditViewMode] = useState('shops'); // 'shops' or 'invoices'
  const [txFilter, setTxFilter] = useState('all'); // 'all', 'INFLOW', 'OUTFLOW'

  // Modals
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showChequeModal, setShowChequeModal] = useState(false);
  const [selectedCheque, setSelectedCheque] = useState(null);
  const [showCashLogModal, setShowCashLogModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showAddBankModal, setShowAddBankModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Form states
  const [settleForm, setSettleForm] = useState({
    sale_id: '',
    amount: '',
    payment_method: 'cash',
    cheque_number: '',
    cheque_date: new Date().toISOString().split('T')[0],
    bank_name: '',
    bank_account_id: '',
    notes: ''
  });

  const [chequeActionForm, setChequeActionForm] = useState({
    status: 'cleared',
    bank_account_id: '',
    cleared_date: new Date().toISOString().split('T')[0]
  });

  const [cashLogForm, setCashLogForm] = useState({
    transaction_type: 'cash_in',
    amount: '',
    reason: '',
    date: new Date().toISOString().split('T')[0]
  });

  const [transferForm, setTransferForm] = useState({
    from_type: 'cash',
    to_type: 'bank',
    from_bank_id: '',
    to_bank_id: '',
    amount: '',
    notes: '',
    date: new Date().toISOString().split('T')[0]
  });

  const [bankForm, setBankForm] = useState({
    account_name: '',
    account_number: '',
    bank_name: '',
    branch: '',
    initial_balance: ''
  });

  // Fetch all core accounts data
  const loadData = async () => {
    setLoading(true);
    try {
      const [sumData, chqData, credData, bankData, logsData] = await Promise.all([
        api.get('/accounts/summary'),
        api.get('/accounts/cheques'),
        api.get('/accounts/credits'),
        api.get('/accounts/bank-accounts'),
        api.get('/accounts/cash-logs')
      ]);
      setSummary(sumData);
      setCheques(chqData);
      setCredits(credData);
      setBankAccounts(bankData);
      setCashLogs(logsData || []);
      
      if (bankData.length > 0) {
        setSettleForm(prev => ({ ...prev, bank_account_id: bankData[0].id }));
        setChequeActionForm(prev => ({ ...prev, bank_account_id: bankData[0].id }));
        setTransferForm(prev => ({ ...prev, to_bank_id: bankData[0].id, from_bank_id: bankData[0].id }));
      }
    } catch (err) {
      console.error('Failed to load accounts data:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Error loading account data' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeDistributorId]);

  // Flash message timer
  useEffect(() => {
    if (statusMessage) {
      const t = setTimeout(() => setStatusMessage(null), 5000);
      return () => clearTimeout(t);
    }
  }, [statusMessage]);

  // Modal Handlers
  const handleOpenSettle = (inv = null) => {
    if (inv) {
      setSelectedInvoice(inv);
      setSettleForm({
        sale_id: inv.sale_id || inv.id,
        amount: inv.balance_due || inv.net_sales,
        payment_method: 'cash',
        cheque_number: '',
        cheque_date: new Date().toISOString().split('T')[0],
        bank_name: '',
        bank_account_id: bankAccounts[0]?.id || '',
        notes: `Payment for ${inv.invoice_number} (${inv.shop_name})`
      });
    } else {
      setSelectedInvoice(null);
      setSettleForm({
        sale_id: credits.unpaidInvoices[0]?.sale_id || '',
        amount: credits.unpaidInvoices[0]?.balance_due || '',
        payment_method: 'cash',
        cheque_number: '',
        cheque_date: new Date().toISOString().split('T')[0],
        bank_name: '',
        bank_account_id: bankAccounts[0]?.id || '',
        notes: ''
      });
    }
    setShowSettleModal(true);
  };

  const handleSettleCreditSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/accounts/settle-credit', settleForm);
      setStatusMessage({ type: 'success', text: `Settlement of ${formatCurrency(settleForm.amount, currencySymbol)} recorded successfully!` });
      setShowSettleModal(false);
      loadData();
    } catch (err) {
      alert('Error recording credit settlement: ' + err.message);
    }
  };

  const handleOpenChequeAction = (chq) => {
    setSelectedCheque(chq);
    setChequeActionForm({
      status: 'cleared',
      bank_account_id: bankAccounts[0]?.id || 1,
      cleared_date: new Date().toISOString().split('T')[0]
    });
    setShowChequeModal(true);
  };

  const handleChequeStatusSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCheque) return;
    try {
      await api.put(`/accounts/cheques/${selectedCheque.payment_id}/status`, chequeActionForm);
      setStatusMessage({ 
        type: 'success', 
        text: `Cheque ${selectedCheque.cheque_number} updated to ${chequeActionForm.status.toUpperCase()} successfully!` 
      });
      setShowChequeModal(false);
      loadData();
    } catch (err) {
      alert('Error updating cheque status: ' + err.message);
    }
  };

  const handleCashLogSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/accounts/cash-log', cashLogForm);
      setStatusMessage({ type: 'success', text: `Cash drawer ${cashLogForm.transaction_type === 'cash_in' ? 'Deposit' : 'Disbursement'} recorded!` });
      setShowCashLogModal(false);
      setCashLogForm({ transaction_type: 'cash_in', amount: '', reason: '', date: new Date().toISOString().split('T')[0] });
      loadData();
    } catch (err) {
      alert('Error adjusting cash drawer: ' + err.message);
    }
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/accounts/transfer', transferForm);
      setStatusMessage({ type: 'success', text: `Transferred ${formatCurrency(transferForm.amount, currencySymbol)} successfully!` });
      setShowTransferModal(false);
      loadData();
    } catch (err) {
      alert('Error completing transfer: ' + err.message);
    }
  };

  const handleAddBankSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/accounts/bank-accounts', bankForm);
      setStatusMessage({ type: 'success', text: `Bank Account "${bankForm.account_name}" registered successfully!` });
      setShowAddBankModal(false);
      setBankForm({ account_name: '', account_number: '', bank_name: '', branch: '', initial_balance: '' });
      loadData();
    } catch (err) {
      alert('Error adding bank account: ' + err.message);
    }
  };

  // Filtered Cheques
  const filteredCheques = cheques.filter(chq => {
    const matchesStatus = chequeFilter === 'all' || chq.cheque_status === chequeFilter;
    const term = chequeSearch.toLowerCase();
    const matchesSearch = !term || 
      (chq.cheque_number && chq.cheque_number.toLowerCase().includes(term)) ||
      (chq.shop_name && chq.shop_name.toLowerCase().includes(term)) ||
      (chq.bank_name && chq.bank_name.toLowerCase().includes(term)) ||
      (chq.invoice_number && chq.invoice_number.toLowerCase().includes(term));
    return matchesStatus && matchesSearch;
  });

  // Filtered Credits
  const filteredDebtors = credits.debtorShops.filter(s => {
    const term = creditSearch.toLowerCase();
    return !term || 
      s.shop_name.toLowerCase().includes(term) ||
      (s.town && s.town.toLowerCase().includes(term)) ||
      (s.route_name && s.route_name.toLowerCase().includes(term));
  });

  const filteredInvoices = credits.unpaidInvoices.filter(inv => {
    const term = creditSearch.toLowerCase();
    return !term ||
      inv.invoice_number.toLowerCase().includes(term) ||
      inv.shop_name.toLowerCase().includes(term) ||
      (inv.route_name && inv.route_name.toLowerCase().includes(term));
  });

  // Filtered Recent Transactions
  const filteredRecent = (summary?.recentTransactions || []).filter(tx => {
    if (txFilter === 'all') return true;
    return tx.flow_type === txFilter;
  });

  // Total Portfolio Capital
  const cashBal = summary?.cash?.balance || 0;
  const bankBal = summary?.bankAccounts?.totalBalance || 0;
  const pendingChqBal = summary?.cheques?.inHandBalance || 0;
  const totalCreditBal = summary?.credits?.totalOutstanding || 0;
  const totalLiquid = cashBal + bankBal + pendingChqBal;
  const totalWorkingAssets = totalLiquid + totalCreditBal;

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              padding: '8px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(16, 185, 129, 0.3)'
            }}>
              <Landmark size={24} color="#fff" />
            </div>
            <div>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                Treasury & Accounts Management
                <span className="badge badge-success" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
                  Live Balances
                </span>
              </h1>
              <p>Real-time liquidity hub: Cash in Hand, Bank Accounts, Cheque Portfolio, and Customer Credit Balances.</p>
            </div>
          </div>
        </div>

        {/* Global Action Bar */}
        <div className="page-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={loadData} title="Refresh Balances" disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button className="btn btn-secondary" onClick={() => setShowCashLogModal(true)}>
            <DollarSign size={14} />
            <span>Cash In / Out</span>
          </button>

          <button className="btn btn-secondary" onClick={() => setShowTransferModal(true)}>
            <ArrowRightLeft size={14} />
            <span>Transfer Funds</span>
          </button>

          <button className="btn btn-primary" onClick={() => handleOpenSettle()} style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
            <CreditCard size={14} />
            <span>Settle Credit</span>
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
          {statusMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{statusMessage.text}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4 CORE BALANCES (HERO SECTION - CASH, BANK, CHEQUES, CREDITS) */}
      {/* ========================================================================= */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', marginBottom: '28px' }}>
        
        {/* 1. CASH BALANCE */}
        <div className="kpi-card" style={{
          borderLeft: '4px solid #10b981',
          background: 'radial-gradient(circle at top right, rgba(16, 185, 129, 0.08) 0%, var(--bg-card) 70%)'
        }}>
          <div className="kpi-card-header">
            <span className="kpi-title" style={{ color: '#34d399' }}>Cash Balance (Drawer)</span>
            <div className="kpi-icon-box" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
              <Wallet size={20} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#10b981', fontSize: '1.75rem' }}>
            {formatCurrency(summary?.cash?.balance, currencySymbol)}
          </div>
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', marginTop: '10px', fontSize: '0.78rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              <span>Total Cash In:</span>
              <strong style={{ color: '#34d399' }}>+{formatCurrency(summary?.cash?.totalIn, currencySymbol)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Total Cash Out:</span>
              <strong style={{ color: '#f87171' }}>-{formatCurrency(summary?.cash?.totalOut, currencySymbol)}</strong>
            </div>
          </div>
          <div style={{ marginTop: '8px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Physical vault & sales collections in hand
          </div>
        </div>

        {/* 2. ACCOUNTS / BANK BALANCE */}
        <div className="kpi-card" style={{
          borderLeft: '4px solid #6366f1',
          background: 'radial-gradient(circle at top right, rgba(99, 102, 241, 0.08) 0%, var(--bg-card) 70%)'
        }}>
          <div className="kpi-card-header">
            <span className="kpi-title" style={{ color: '#818cf8' }}>Accounts Balance (Banks)</span>
            <div className="kpi-icon-box" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' }}>
              <Landmark size={20} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#818cf8', fontSize: '1.75rem' }}>
            {formatCurrency(summary?.bankAccounts?.totalBalance, currencySymbol)}
          </div>
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', marginTop: '10px', fontSize: '0.78rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              <span>Active Bank A/Cs:</span>
              <strong style={{ color: '#e2e8f0' }}>{summary?.bankAccounts?.accounts?.length || 0} Registered</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Transfers Received:</span>
              <strong style={{ color: '#34d399' }}>+{formatCurrency(summary?.bankAccounts?.transfersIn, currencySymbol)}</strong>
            </div>
          </div>
          <div style={{ marginTop: '8px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Commercial Bank, BOC & institutional deposits
          </div>
        </div>

        {/* 3. CHEQUES BALANCE */}
        <div className="kpi-card" style={{
          borderLeft: '4px solid #f59e0b',
          background: 'radial-gradient(circle at top right, rgba(245, 158, 11, 0.08) 0%, var(--bg-card) 70%)'
        }}>
          <div className="kpi-card-header">
            <span className="kpi-title" style={{ color: '#fbbf24' }}>Cheques (Pending in Hand)</span>
            <div className="kpi-icon-box" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
              <Clock size={20} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#fbbf24', fontSize: '1.75rem' }}>
            {formatCurrency(summary?.cheques?.inHandBalance, currencySymbol)}
          </div>
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', marginTop: '10px', fontSize: '0.78rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              <span>Pending in Hand:</span>
              <strong style={{ color: '#fbbf24' }}>{summary?.cheques?.pendingCount || 0} Cheques</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Realized / Cleared:</span>
              <strong style={{ color: '#34d399' }}>{formatCurrency(summary?.cheques?.clearedBalance, currencySymbol)} ({summary?.cheques?.clearedCount})</strong>
            </div>
          </div>
          <div style={{ marginTop: '8px', fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Unrealized portfolio</span>
            {summary?.cheques?.bouncedCount > 0 && (
              <span style={{ color: '#f87171', fontWeight: 600 }}>{summary?.cheques?.bouncedCount} Bounced</span>
            )}
          </div>
        </div>

        {/* 4. CREDITS BALANCE */}
        <div className="kpi-card" style={{
          borderLeft: '4px solid #ef4444',
          background: 'radial-gradient(circle at top right, rgba(239, 68, 68, 0.08) 0%, var(--bg-card) 70%)'
        }}>
          <div className="kpi-card-header">
            <span className="kpi-title" style={{ color: '#f87171' }}>Credits (Trade Receivables)</span>
            <div className="kpi-icon-box" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
              <CreditCard size={20} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#f87171', fontSize: '1.75rem' }}>
            {formatCurrency(summary?.credits?.totalOutstanding, currencySymbol)}
          </div>
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', marginTop: '10px', fontSize: '0.78rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              <span>Debtor Retail Shops:</span>
              <strong style={{ color: '#e2e8f0' }}>{summary?.credits?.debtorShopsCount || 0} Outlets</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Overdue (&gt;21 Days):</span>
              <strong style={{ color: '#f87171' }}>{formatCurrency(summary?.credits?.overdueOutstanding, currencySymbol)}</strong>
            </div>
          </div>
          <div style={{ marginTop: '8px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Uncollected invoices across distribution routes
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* LIQUIDITY SUMMARY BAR (TOTAL POSITION) */}
      {/* ========================================================================= */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(19, 27, 46, 0.95) 100%)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '18px 24px',
        marginBottom: '28px',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
              Net Liquid Funds (Cash + Banks + Cheques)
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#38bdf8', fontFamily: 'Outfit, sans-serif' }}>
              {formatCurrency(totalLiquid, currencySymbol)}
            </div>
          </div>
          <div style={{ height: '36px', width: '1px', background: 'var(--border-subtle)' }} />
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
              Total Working Capital Assets (Incl. Credits)
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#a78bfa', fontFamily: 'Outfit, sans-serif' }}>
              {formatCurrency(totalWorkingAssets, currencySymbol)}
            </div>
          </div>
        </div>

        {/* Visual Capital Distribution */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '320px', flex: 1, maxWidth: '500px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <span>Liquidity Composition</span>
            <span>
              Cash {totalWorkingAssets > 0 ? ((cashBal / totalWorkingAssets) * 100).toFixed(0) : 0}% • 
              Bank {totalWorkingAssets > 0 ? ((bankBal / totalWorkingAssets) * 100).toFixed(0) : 0}% • 
              Chq {totalWorkingAssets > 0 ? ((pendingChqBal / totalWorkingAssets) * 100).toFixed(0) : 0}% • 
              Credit {totalWorkingAssets > 0 ? ((totalCreditBal / totalWorkingAssets) * 100).toFixed(0) : 0}%
            </span>
          </div>
          <div style={{ height: '8px', borderRadius: '4px', background: 'var(--bg-surface)', display: 'flex', overflow: 'hidden' }}>
            <div style={{ width: `${totalWorkingAssets > 0 ? (cashBal / totalWorkingAssets) * 100 : 0}%`, background: '#10b981' }} title="Cash" />
            <div style={{ width: `${totalWorkingAssets > 0 ? (bankBal / totalWorkingAssets) * 100 : 0}%`, background: '#6366f1' }} title="Bank" />
            <div style={{ width: `${totalWorkingAssets > 0 ? (pendingChqBal / totalWorkingAssets) * 100 : 0}%`, background: '#f59e0b' }} title="Cheques" />
            <div style={{ width: `${totalWorkingAssets > 0 ? (totalCreditBal / totalWorkingAssets) * 100 : 0}%`, background: '#ef4444' }} title="Credits" />
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
          onClick={() => setActiveTab('overview')}
          style={{
            padding: '10px 18px',
            background: activeTab === 'overview' ? 'var(--bg-card)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'overview' ? '2px solid #10b981' : '2px solid transparent',
            color: activeTab === 'overview' ? '#fff' : 'var(--text-secondary)',
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
          <Landmark size={16} color={activeTab === 'overview' ? '#10b981' : 'currentColor'} />
          <span>Treasury Overview & Activity Stream</span>
        </button>

        <button
          onClick={() => setActiveTab('cheques')}
          style={{
            padding: '10px 18px',
            background: activeTab === 'cheques' ? 'var(--bg-card)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'cheques' ? '2px solid #f59e0b' : '2px solid transparent',
            color: activeTab === 'cheques' ? '#fff' : 'var(--text-secondary)',
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
          <Clock size={16} color={activeTab === 'cheques' ? '#f59e0b' : 'currentColor'} />
          <span>Cheques Portfolio</span>
          <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
            {summary?.cheques?.pendingCount || 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('credits')}
          style={{
            padding: '10px 18px',
            background: activeTab === 'credits' ? 'var(--bg-card)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'credits' ? '2px solid #ef4444' : '2px solid transparent',
            color: activeTab === 'credits' ? '#fff' : 'var(--text-secondary)',
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
          <CreditCard size={16} color={activeTab === 'credits' ? '#ef4444' : 'currentColor'} />
          <span>Debtor Credits & Settlement</span>
          <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>
            {summary?.credits?.debtorShopsCount || 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('banking')}
          style={{
            padding: '10px 18px',
            background: activeTab === 'banking' ? 'var(--bg-card)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'banking' ? '2px solid #6366f1' : '2px solid transparent',
            color: activeTab === 'banking' ? '#fff' : 'var(--text-secondary)',
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
          <Building size={16} color={activeTab === 'banking' ? '#6366f1' : 'currentColor'} />
          <span>Bank Accounts & Cash Drawer Logs</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW & COMBINED TRANSACTIONS STREAM */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
          
          {/* Recent Live Activity Stream */}
          <div className="table-card" style={{ gridColumn: 'span 2' }}>
            <div className="table-toolbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Live Treasury Inflow & Outflow Activity</span>
                <span className="badge badge-info">{filteredRecent.length} Recent Records</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className={`btn ${txFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                  onClick={() => setTxFilter('all')}
                >
                  All
                </button>
                <button 
                  className={`btn ${txFilter === 'INFLOW' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '4px 10px', fontSize: '0.75rem', background: txFilter === 'INFLOW' ? '#10b981' : undefined }}
                  onClick={() => setTxFilter('INFLOW')}
                >
                  Inflows (+)
                </button>
                <button 
                  className={`btn ${txFilter === 'OUTFLOW' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '4px 10px', fontSize: '0.75rem', background: txFilter === 'OUTFLOW' ? '#ef4444' : undefined }}
                  onClick={() => setTxFilter('OUTFLOW')}
                >
                  Outflows (-)
                </button>
              </div>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Flow</th>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Method / Details</th>
                    <th>Receipt / Ref</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecent.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                        No transactions recorded in this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRecent.map((tx, idx) => (
                      <tr key={idx}>
                        <td>
                          {tx.flow_type === 'INFLOW' ? (
                            <span className="badge badge-success" style={{ gap: '4px' }}>
                              <ArrowDownLeft size={12} /> INFLOW
                            </span>
                          ) : (
                            <span className="badge badge-danger" style={{ gap: '4px' }}>
                              <ArrowUpRight size={12} /> OUTFLOW
                            </span>
                          )}
                        </td>
                        <td>{formatDate(tx.date)}</td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{tx.description}</div>
                          {tx.invoice_number && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{tx.invoice_number}</div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>
                              {tx.payment_method?.replace('_', ' ') || 'Cash'}
                            </span>
                            {tx.cheque_number && (
                              <span className="badge badge-warning" style={{ fontSize: '0.68rem' }}>
                                {tx.cheque_number} ({tx.cheque_status})
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                          {tx.receipt_number || '-'}
                        </td>
                        <td style={{ 
                          textAlign: 'right', 
                          fontWeight: 700, 
                          color: tx.flow_type === 'INFLOW' ? '#10b981' : '#f87171' 
                        }}>
                          {tx.flow_type === 'INFLOW' ? '+' : '-'} {formatCurrency(tx.amount, currencySymbol)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Bank Accounts Balances Card */}
          <div className="table-card">
            <div className="table-toolbar">
              <div style={{ fontWeight: 600, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Landmark size={18} color="#6366f1" />
                <span>Institutional Bank Balances</span>
              </div>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                onClick={() => setShowAddBankModal(true)}
              >
                <Plus size={12} /> Add Bank A/C
              </button>
            </div>
            <div style={{ padding: '16px' }}>
              {bankAccounts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                  No active bank accounts registered.
                </div>
              ) : (
                bankAccounts.map(b => (
                  <div key={b.id} style={{
                    padding: '14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    marginBottom: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          {b.account_name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {b.bank_name} • {b.branch || 'Central'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'monospace', marginTop: '2px' }}>
                          A/C: {b.account_number}
                        </div>
                      </div>
                      <span className="badge badge-success">Active</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px dashed var(--border-subtle)', paddingTop: '8px', marginTop: '8px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Current Balance:</span>
                      <strong style={{ fontSize: '1.15rem', color: '#818cf8', fontFamily: 'Outfit, sans-serif' }}>
                        {formatCurrency(b.current_balance, currencySymbol)}
                      </strong>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CHEQUES PORTFOLIO & REALIZATION */}
      {/* ========================================================================= */}
      {activeTab === 'cheques' && (
        <div className="table-card">
          <div className="table-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div className="search-input-box">
                <Search size={14} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Search cheque #, shop name, bank..."
                  value={chequeSearch}
                  onChange={e => setChequeSearch(e.target.value)}
                />
              </div>

              {/* Status Filter Buttons */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  className={`btn ${chequeFilter === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 12px', fontSize: '0.78rem', background: chequeFilter === 'pending' ? '#f59e0b' : undefined }}
                  onClick={() => setChequeFilter('pending')}
                >
                  Pending in Hand ({summary?.cheques?.pendingCount || 0})
                </button>
                <button
                  className={`btn ${chequeFilter === 'cleared' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 12px', fontSize: '0.78rem', background: chequeFilter === 'cleared' ? '#10b981' : undefined }}
                  onClick={() => setChequeFilter('cleared')}
                >
                  Cleared ({summary?.cheques?.clearedCount || 0})
                </button>
                <button
                  className={`btn ${chequeFilter === 'bounced' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 12px', fontSize: '0.78rem', background: chequeFilter === 'bounced' ? '#ef4444' : undefined }}
                  onClick={() => setChequeFilter('bounced')}
                >
                  Bounced ({summary?.cheques?.bouncedCount || 0})
                </button>
                <button
                  className={`btn ${chequeFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                  onClick={() => setChequeFilter('all')}
                >
                  All Cheques
                </button>
              </div>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Showing {filteredCheques.length} cheques
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cheque #</th>
                  <th>Cheque Date</th>
                  <th>Bank Name</th>
                  <th>Retailer / Customer</th>
                  <th>Invoice Ref</th>
                  <th>Route</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCheques.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      No cheques found matching the specified criteria.
                    </td>
                  </tr>
                ) : (
                  filteredCheques.map(chq => (
                    <tr key={chq.payment_id}>
                      <td style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                        {chq.cheque_number || 'N/A'}
                      </td>
                      <td>{formatDate(chq.cheque_date || chq.payment_date)}</td>
                      <td>{chq.bank_name || '-'}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{chq.shop_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{chq.town} • {chq.telephone}</div>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{chq.invoice_number}</td>
                      <td>
                        <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>
                          {chq.route_name ? chq.route_name.split('(')[0] : 'General'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#fbbf24', fontSize: '0.95rem' }}>
                        {formatCurrency(chq.amount, currencySymbol)}
                      </td>
                      <td>
                        {chq.cheque_status === 'cleared' && (
                          <span className="badge badge-success" style={{ gap: '4px' }}>
                            <CheckCircle2 size={12} /> Cleared
                          </span>
                        )}
                        {chq.cheque_status === 'pending' && (
                          <span className="badge badge-warning" style={{ gap: '4px' }}>
                            <Clock size={12} /> Pending in Hand
                          </span>
                        )}
                        {chq.cheque_status === 'bounced' && (
                          <span className="badge badge-danger" style={{ gap: '4px' }}>
                            <XCircle size={12} /> Dishonored
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {chq.cheque_status === 'pending' && (
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button
                              className="btn btn-primary"
                              style={{ padding: '4px 8px', fontSize: '0.72rem', background: '#10b981' }}
                              onClick={() => handleOpenChequeAction(chq)}
                            >
                              <CheckCircle2 size={12} /> Deposit / Clear
                            </button>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '0.72rem', color: '#f87171' }}
                              onClick={() => {
                                if (window.confirm(`Mark cheque ${chq.cheque_number} as BOUNCED? This will reopen invoice ${chq.invoice_number}.`)) {
                                  api.put(`/accounts/cheques/${chq.payment_id}/status`, { status: 'bounced' })
                                    .then(() => {
                                      setStatusMessage({ type: 'success', text: `Cheque ${chq.cheque_number} marked as bounced.` });
                                      loadData();
                                    });
                                }
                              }}
                            >
                              Bounce
                            </button>
                          </div>
                        )}
                        {chq.cheque_status === 'cleared' && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Cleared on {formatDate(chq.cleared_date)}
                          </span>
                        )}
                        {chq.cheque_status === 'bounced' && (
                          <span style={{ fontSize: '0.75rem', color: '#f87171' }}>
                            Reopened for Collection
                          </span>
                        )}
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
      {/* TAB 3: DEBTOR CREDITS & SETTLEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'credits' && (
        <div>
          {/* Sub Toolbar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div className="search-input-box">
                <Search size={14} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Search debtor shop, town, route, invoice..."
                  value={creditSearch}
                  onChange={e => setCreditSearch(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  className={`btn ${creditViewMode === 'shops' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                  onClick={() => setCreditViewMode('shops')}
                >
                  <Store size={14} /> Grouped by Debtor Shop ({credits.debtorShops.length})
                </button>
                <button
                  className={`btn ${creditViewMode === 'invoices' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                  onClick={() => setCreditViewMode('invoices')}
                >
                  <FileText size={14} /> Individual Unpaid Invoices ({credits.unpaidInvoices.length})
                </button>
              </div>
            </div>

            <button
              className="btn btn-primary"
              style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
              onClick={() => handleOpenSettle()}
            >
              <CreditCard size={14} /> Settle Credit Payment
            </button>
          </div>

          {/* VIEW MODE 1: GROUPED BY DEBTOR SHOP */}
          {creditViewMode === 'shops' && (
            <div className="table-card">
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Debtor Shop & Details</th>
                      <th>Route</th>
                      <th>Credit Limit</th>
                      <th>Unpaid Invoices</th>
                      <th>Oldest Invoice</th>
                      <th>Max Days Outstanding</th>
                      <th style={{ textAlign: 'right' }}>Total Balance Due</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDebtors.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                          No debtor accounts found.
                        </td>
                      </tr>
                    ) : (
                      filteredDebtors.map(shop => {
                        const isOverdue = shop.max_days_outstanding > 21;
                        return (
                          <tr key={shop.shop_id}>
                            <td>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{shop.shop_name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {shop.town} • Tel: {shop.telephone || '-'} • Contact: {shop.owner_name}
                              </div>
                            </td>
                            <td>
                              <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>
                                {shop.route_name ? shop.route_name.split('(')[0] : 'General'}
                              </span>
                            </td>
                            <td>{formatCurrency(shop.credit_limit || 50000, currencySymbol)}</td>
                            <td>
                              <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>
                                {shop.unpaid_invoices_count} Invoices
                              </span>
                            </td>
                            <td>{formatDate(shop.oldest_invoice_date)}</td>
                            <td>
                              <span className={`badge ${isOverdue ? 'badge-danger' : 'badge-warning'}`}>
                                {shop.max_days_outstanding} Days {isOverdue ? '(OVERDUE)' : ''}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#f87171', fontSize: '1rem' }}>
                              {formatCurrency(shop.total_outstanding_balance, currencySymbol)}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                className="btn btn-primary"
                                style={{ padding: '5px 12px', fontSize: '0.75rem', background: '#10b981' }}
                                onClick={() => {
                                  // Find the first unpaid invoice for this shop
                                  const inv = credits.unpaidInvoices.find(x => x.shop_id === shop.shop_id);
                                  handleOpenSettle(inv || {
                                    sale_id: '',
                                    balance_due: shop.total_outstanding_balance,
                                    shop_name: shop.shop_name,
                                    invoice_number: `Account of ${shop.shop_name}`
                                  });
                                }}
                              >
                                Settle Payment
                              </button>
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

          {/* VIEW MODE 2: INDIVIDUAL INVOICES */}
          {creditViewMode === 'invoices' && (
            <div className="table-card">
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Date</th>
                      <th>Customer Outlet</th>
                      <th>Route</th>
                      <th style={{ textAlign: 'right' }}>Net Total</th>
                      <th style={{ textAlign: 'right' }}>Paid So Far</th>
                      <th style={{ textAlign: 'right' }}>Balance Due</th>
                      <th>Aging / Status</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                          No unpaid invoices found.
                        </td>
                      </tr>
                    ) : (
                      filteredInvoices.map(inv => (
                        <tr key={inv.sale_id}>
                          <td style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                            {inv.invoice_number}
                          </td>
                          <td>{formatDate(inv.invoice_date)}</td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{inv.shop_name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{inv.town}</div>
                          </td>
                          <td>
                            <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>
                              {inv.route_name ? inv.route_name.split('(')[0] : 'General'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(inv.net_sales, currencySymbol)}</td>
                          <td style={{ textAlign: 'right', color: '#10b981' }}>{formatCurrency(inv.paid_amount, currencySymbol)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#f87171', fontSize: '0.95rem' }}>
                            {formatCurrency(inv.balance_due, currencySymbol)}
                          </td>
                          <td>
                            <span className={`badge ${inv.age_bracket === 'OVERDUE' ? 'badge-danger' : 'badge-warning'}`}>
                              {inv.days_elapsed} Days ({inv.age_bracket})
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              className="btn btn-primary"
                              style={{ padding: '4px 10px', fontSize: '0.72rem', background: '#10b981' }}
                              onClick={() => handleOpenSettle(inv)}
                            >
                              Collect & Settle
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: BANKING & CASH DRAWER LOGS */}
      {/* ========================================================================= */}
      {activeTab === 'banking' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          
          {/* Left: Registered Bank Accounts */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.1rem' }}>Corporate Bank Accounts</h3>
              <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.78rem' }} onClick={() => setShowAddBankModal(true)}>
                <Plus size={14} /> Add Bank A/C
              </button>
            </div>

            {bankAccounts.map(b => (
              <div key={b.id} className="kpi-card" style={{ marginBottom: '16px', borderLeft: '4px solid #6366f1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <h4 style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{b.account_name}</h4>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {b.bank_name} • {b.branch || 'Main Branch'}
                    </div>
                    <div style={{ fontSize: '0.85rem', fontFamily: 'monospace', color: '#94a3b8', marginTop: '4px' }}>
                      A/C: {b.account_number}
                    </div>
                  </div>
                  <div className="kpi-icon-box" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' }}>
                    <Landmark size={20} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', marginTop: '10px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Current Verified Balance:</span>
                  <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#818cf8', fontFamily: 'Outfit, sans-serif' }}>
                    {formatCurrency(b.current_balance, currencySymbol)}
                  </span>
                </div>

                <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                  <button 
                    className="btn btn-secondary" 
                    style={{ flex: 1, padding: '6px', fontSize: '0.75rem' }}
                    onClick={() => {
                      setTransferForm(prev => ({ ...prev, from_type: 'bank', to_type: 'cash', from_bank_id: b.id }));
                      setShowTransferModal(true);
                    }}
                  >
                    Withdraw to Cash
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    style={{ flex: 1, padding: '6px', fontSize: '0.75rem' }}
                    onClick={() => {
                      setTransferForm(prev => ({ ...prev, from_type: 'cash', to_type: 'bank', to_bank_id: b.id }));
                      setShowTransferModal(true);
                    }}
                  >
                    Deposit Cash
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Right: Cash Drawer Adjustment Logs */}
          <div className="table-card">
            <div className="table-toolbar">
              <div style={{ fontWeight: 600, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wallet size={18} color="#10b981" />
                <span>Cash Drawer Adjustments & Float Audit</span>
              </div>
              <button 
                className="btn btn-primary" 
                style={{ padding: '6px 12px', fontSize: '0.78rem', background: '#10b981' }}
                onClick={() => setShowCashLogModal(true)}
              >
                <Plus size={14} /> Adjust Drawer Float
              </button>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Reason / Details</th>
                    <th>Authorized By</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {cashLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                        No cash drawer adjustments logged.
                      </td>
                    </tr>
                  ) : (
                    cashLogs.map(l => (
                      <tr key={l.id}>
                        <td>
                          {l.transaction_type === 'cash_in' ? (
                            <span className="badge badge-success" style={{ gap: '4px' }}>
                              <ArrowDownLeft size={12} /> Cash In
                            </span>
                          ) : (
                            <span className="badge badge-danger" style={{ gap: '4px' }}>
                              <ArrowUpRight size={12} /> Cash Out
                            </span>
                          )}
                        </td>
                        <td>{formatDate(l.date)}</td>
                        <td>{l.reason}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{l.performed_by || 'Admin'}</td>
                        <td style={{ 
                          textAlign: 'right', 
                          fontWeight: 700, 
                          color: l.transaction_type === 'cash_in' ? '#10b981' : '#f87171' 
                        }}>
                          {l.transaction_type === 'cash_in' ? '+' : '-'} {formatCurrency(l.amount, currencySymbol)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: SETTLE CREDIT INVOICE */}
      {/* ========================================================================= */}
      {showSettleModal && (
        <div className="modal-backdrop" onClick={() => setShowSettleModal(false)}>
          <div className="modal-card" style={{ maxWidth: '540px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Collect & Settle Debtor Credit</h3>
              <button className="btn-close" onClick={() => setShowSettleModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSettleCreditSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                
                {/* Sale Invoice Selection */}
                <div>
                  <label className="form-label">Select Unpaid Invoice / Customer *</label>
                  <select
                    className="form-control"
                    value={settleForm.sale_id}
                    onChange={e => {
                      const id = e.target.value;
                      const inv = credits.unpaidInvoices.find(x => String(x.sale_id) === String(id));
                      setSettleForm(prev => ({
                        ...prev,
                        sale_id: id,
                        amount: inv ? inv.balance_due : prev.amount
                      }));
                    }}
                    required
                  >
                    <option value="">-- Choose Unpaid Invoice --</option>
                    {credits.unpaidInvoices.map(inv => (
                      <option key={inv.sale_id} value={inv.sale_id}>
                        {inv.invoice_number} - {inv.shop_name} (Due: {formatCurrency(inv.balance_due, currencySymbol)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className="form-label">Collection Amount ({currencySymbol}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    className="form-control"
                    value={settleForm.amount}
                    onChange={e => setSettleForm(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="Enter collected amount"
                    required
                  />
                </div>

                {/* Payment Method */}
                <div>
                  <label className="form-label">Settlement Payment Method *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    {['cash', 'cheque', 'bank_transfer'].map(method => (
                      <button
                        type="button"
                        key={method}
                        className={`btn ${settleForm.payment_method === method ? 'btn-primary' : 'btn-secondary'}`}
                        style={{
                          textTransform: 'capitalize',
                          padding: '8px',
                          fontSize: '0.85rem',
                          background: settleForm.payment_method === method ? (method === 'cash' ? '#10b981' : method === 'cheque' ? '#f59e0b' : '#6366f1') : undefined
                        }}
                        onClick={() => setSettleForm(prev => ({ ...prev, payment_method: method }))}
                      >
                        {method.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cheque Details Fields if Cheque */}
                {settleForm.payment_method === 'cheque' && (
                  <div style={{ padding: '12px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fbbf24' }}>Cheque Details (Pending in Hand)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Cheque Number *</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. CHQ-819201"
                          value={settleForm.cheque_number}
                          onChange={e => setSettleForm(prev => ({ ...prev, cheque_number: e.target.value }))}
                          required
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Cheque Date *</label>
                        <input
                          type="date"
                          className="form-control"
                          value={settleForm.cheque_date}
                          onChange={e => setSettleForm(prev => ({ ...prev, cheque_date: e.target.value }))}
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Drawee Bank Name *</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Commercial Bank, BOC, Sampath"
                        value={settleForm.bank_name}
                        onChange={e => setSettleForm(prev => ({ ...prev, bank_name: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Bank Account Selection if Bank Transfer */}
                {settleForm.payment_method === 'bank_transfer' && (
                  <div>
                    <label className="form-label">Receiving Bank Account *</label>
                    <select
                      className="form-control"
                      value={settleForm.bank_account_id}
                      onChange={e => setSettleForm(prev => ({ ...prev, bank_account_id: e.target.value }))}
                      required
                    >
                      {bankAccounts.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.bank_name} - {b.account_name} ({b.account_number})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="form-label">Notes / Remarks</label>
                  <input
                    type="text"
                    className="form-control"
                    value={settleForm.notes}
                    onChange={e => setSettleForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="e.g. Settlement received via sales rep Priyantha"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSettleModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#10b981' }}>
                  Confirm Settlement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: DEPOSIT / CLEAR CHEQUE */}
      {/* ========================================================================= */}
      {showChequeModal && selectedCheque && (
        <div className="modal-backdrop" onClick={() => setShowChequeModal(false)}>
          <div className="modal-card" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Deposit & Clear Cheque</h3>
              <button className="btn-close" onClick={() => setShowChequeModal(false)}>✕</button>
            </div>
            <form onSubmit={handleChequeStatusSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ padding: '12px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    Cheque #{selectedCheque.cheque_number}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {selectedCheque.bank_name} • Issuer: {selectedCheque.shop_name}
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fbbf24', marginTop: '6px' }}>
                    {formatCurrency(selectedCheque.amount, currencySymbol)}
                  </div>
                </div>

                <div>
                  <label className="form-label">Action Status *</label>
                  <select
                    className="form-control"
                    value={chequeActionForm.status}
                    onChange={e => setChequeActionForm(prev => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="cleared">Realize & Deposit into Bank Account (CLEARED)</option>
                    <option value="bounced">Dishonored / Insufficient Funds (BOUNCED)</option>
                    <option value="pending">Keep Pending in Hand</option>
                  </select>
                </div>

                {chequeActionForm.status === 'cleared' && (
                  <>
                    <div>
                      <label className="form-label">Deposit into Bank Account *</label>
                      <select
                        className="form-control"
                        value={chequeActionForm.bank_account_id}
                        onChange={e => setChequeActionForm(prev => ({ ...prev, bank_account_id: e.target.value }))}
                        required
                      >
                        {bankAccounts.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.bank_name} - {b.account_name} ({b.account_number})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="form-label">Realization / Clearance Date *</label>
                      <input
                        type="date"
                        className="form-control"
                        value={chequeActionForm.cleared_date}
                        onChange={e => setChequeActionForm(prev => ({ ...prev, cleared_date: e.target.value }))}
                        required
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowChequeModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: chequeActionForm.status === 'cleared' ? '#10b981' : '#ef4444' }}>
                  Update Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CASH DRAWER FLOAT ADJUSTMENT */}
      {/* ========================================================================= */}
      {showCashLogModal && (
        <div className="modal-backdrop" onClick={() => setShowCashLogModal(false)}>
          <div className="modal-card" style={{ maxWidth: '460px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Cash Drawer In / Out Adjustment</h3>
              <button className="btn-close" onClick={() => setShowCashLogModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCashLogSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label className="form-label">Transaction Type *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button
                      type="button"
                      className={`btn ${cashLogForm.transaction_type === 'cash_in' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ background: cashLogForm.transaction_type === 'cash_in' ? '#10b981' : undefined }}
                      onClick={() => setCashLogForm(prev => ({ ...prev, transaction_type: 'cash_in' }))}
                    >
                      <ArrowDownLeft size={14} /> Cash In (Deposit)
                    </button>
                    <button
                      type="button"
                      className={`btn ${cashLogForm.transaction_type === 'cash_out' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ background: cashLogForm.transaction_type === 'cash_out' ? '#ef4444' : undefined }}
                      onClick={() => setCashLogForm(prev => ({ ...prev, transaction_type: 'cash_out' }))}
                    >
                      <ArrowUpRight size={14} /> Cash Out (Disburse)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="form-label">Amount ({currencySymbol}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    className="form-control"
                    placeholder="Enter amount in LKR"
                    value={cashLogForm.amount}
                    onChange={e => setCashLogForm(prev => ({ ...prev, amount: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Reason / Purpose *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Opening vault float, emergency cash replenishment, owner draw"
                    value={cashLogForm.reason}
                    onChange={e => setCashLogForm(prev => ({ ...prev, reason: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={cashLogForm.date}
                    onChange={e => setCashLogForm(prev => ({ ...prev, date: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCashLogModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#10b981' }}>
                  Save Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: FUND TRANSFER (CASH ⇄ BANK) */}
      {/* ========================================================================= */}
      {showTransferModal && (
        <div className="modal-backdrop" onClick={() => setShowTransferModal(false)}>
          <div className="modal-card" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Internal Fund Transfer</h3>
              <button className="btn-close" onClick={() => setShowTransferModal(false)}>✕</button>
            </div>
            <form onSubmit={handleTransferSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label className="form-label">Transfer Flow *</label>
                  <select
                    className="form-control"
                    value={`${transferForm.from_type}->${transferForm.to_type}`}
                    onChange={e => {
                      const [f, t] = e.target.value.split('->');
                      setTransferForm(prev => ({ ...prev, from_type: f, to_type: t }));
                    }}
                  >
                    <option value="cash->bank">Cash Drawer ➔ Bank Account (Deposit)</option>
                    <option value="bank->cash">Bank Account ➔ Cash Drawer (Withdrawal)</option>
                    <option value="bank->bank">Bank Account ➔ Bank Account (Inter-bank)</option>
                  </select>
                </div>

                {/* Source Bank if from_type === 'bank' */}
                {transferForm.from_type === 'bank' && (
                  <div>
                    <label className="form-label">Source Bank Account *</label>
                    <select
                      className="form-control"
                      value={transferForm.from_bank_id}
                      onChange={e => setTransferForm(prev => ({ ...prev, from_bank_id: e.target.value }))}
                      required
                    >
                      {bankAccounts.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.bank_name} - {b.account_name} ({formatCurrency(b.current_balance, currencySymbol)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Target Bank if to_type === 'bank' */}
                {transferForm.to_type === 'bank' && (
                  <div>
                    <label className="form-label">Destination Bank Account *</label>
                    <select
                      className="form-control"
                      value={transferForm.to_bank_id}
                      onChange={e => setTransferForm(prev => ({ ...prev, to_bank_id: e.target.value }))}
                      required
                    >
                      {bankAccounts.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.bank_name} - {b.account_name} ({formatCurrency(b.current_balance, currencySymbol)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="form-label">Transfer Amount ({currencySymbol}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    className="form-control"
                    placeholder="Enter transfer amount"
                    value={transferForm.amount}
                    onChange={e => setTransferForm(prev => ({ ...prev, amount: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Notes / Reference</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Weekly collection cash deposit"
                    value={transferForm.notes}
                    onChange={e => setTransferForm(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowTransferModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Execute Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: ADD CORPORATE BANK ACCOUNT */}
      {/* ========================================================================= */}
      {showAddBankModal && (
        <div className="modal-backdrop" onClick={() => setShowAddBankModal(false)}>
          <div className="modal-card" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Register New Bank Account</h3>
              <button className="btn-close" onClick={() => setShowAddBankModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddBankSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label className="form-label">Account Name / Title *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Jeewaka Collections A/C"
                    value={bankForm.account_name}
                    onChange={e => setBankForm(prev => ({ ...prev, account_name: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Bank Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Commercial Bank of Ceylon, Bank of Ceylon"
                    value={bankForm.bank_name}
                    onChange={e => setBankForm(prev => ({ ...prev, bank_name: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Account Number *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 1000-4829-9182"
                    value={bankForm.account_number}
                    onChange={e => setBankForm(prev => ({ ...prev, account_number: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Branch</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Dambulla Branch"
                    value={bankForm.branch}
                    onChange={e => setBankForm(prev => ({ ...prev, branch: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="form-label">Opening Initial Balance ({currencySymbol})</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-control"
                    placeholder="0.00"
                    value={bankForm.initial_balance}
                    onChange={e => setBankForm(prev => ({ ...prev, initial_balance: e.target.value }))}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddBankModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Bank Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default AccountsPage;
