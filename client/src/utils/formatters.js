/**
 * Currency, number, and date formatters
 */

export function formatCurrency(amount, symbol = 'Rs.') {
  const num = Number(amount) || 0;
  return `${symbol} ${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatNumber(val, decimals = 0) {
  const num = Number(val) || 0;
  return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatPercent(val, decimals = 1) {
  const num = Number(val) || 0;
  return `${num.toFixed(decimals)}%`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
