import React from 'react';

export function KPICard({ title, value, subtext, icon: Icon, color = 'var(--primary)', isPositive = null }) {
  return (
    <div className="kpi-card">
      <div className="kpi-card-header">
        <span className="kpi-title">{title}</span>
        {Icon && (
          <div className="kpi-icon-box" style={{ background: `rgba(${color}, 0.12)`, color: `rgb(${color})` }}>
            <Icon size={18} />
          </div>
        )}
      </div>
      <div className="kpi-value">{value}</div>
      {subtext && (
        <div className={`kpi-subtext ${isPositive === true ? 'positive' : isPositive === false ? 'negative' : ''}`}>
          {subtext}
        </div>
      )}
    </div>
  );
}

export default KPICard;
