import React from 'react';
import { Download, FileText, Printer } from 'lucide-react';
import api from '../utils/api.js';

export function ExportButtons({ reportType, label = 'Export' }) {
  const handleExport = async (format) => {
    try {
      const ext = format === 'csv' ? 'csv' : 'xlsx';
      const filename = `${reportType || 'report'}-${Date.now()}.${ext}`;
      await api.download(`/reports/${reportType}/export?format=${format}`, filename);
    } catch (err) {
      alert('Export failed: ' + err.message);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => handleExport('xlsx')}
        title="Download formatted Excel spreadsheet"
      >
        <Download size={14} />
        <span>Excel (.xlsx)</span>
      </button>

      <button
        className="btn btn-secondary btn-sm"
        onClick={() => handleExport('csv')}
        title="Download standard CSV"
      >
        <FileText size={14} />
        <span>CSV</span>
      </button>

      <button
        className="btn btn-secondary btn-sm"
        onClick={handlePrint}
        title="Print this report"
      >
        <Printer size={14} />
        <span>Print</span>
      </button>
    </div>
  );
}

export default ExportButtons;
