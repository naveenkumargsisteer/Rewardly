import React from 'react';
import { Users, Trophy, HeartHandshake, IndianRupee, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatCompactInr } from '../api/client';

export default function KpiCards({ kpis, comparisonLabel }) {
  if (!kpis) return null;

  const cards = [
    {
      label: 'Total Employees',
      value: String(kpis.totalEmployees),
      trend: `${kpis.engagementRate}% active engagement`,
      positive: true,
      icon: <Users size={18} color="#6d28d9" />,
      iconBg: '#f3efff',
    },
    {
      label: 'Performance Score',
      value: `${kpis.avgPerformanceScore}%`,
      trend: `${kpis.performanceDelta >= 0 ? '+' : ''}${kpis.performanceDelta}% ${comparisonLabel}`,
      positive: kpis.performanceDelta >= 0,
      icon: <Trophy size={18} color="#d97706" />,
      iconBg: '#fffbeb',
    },
    {
      label: 'Attendance & Loyalty',
      value: `${kpis.avgAttendanceLoyalty}%`,
      trend: `${kpis.attendanceDelta >= 0 ? '+' : ''}${kpis.attendanceDelta}% ${comparisonLabel}`,
      positive: kpis.attendanceDelta >= 0,
      icon: <HeartHandshake size={18} color="#e11d48" />,
      iconBg: '#fff1f2',
    },
    {
      label: 'Showroom Net Sales',
      value: formatCompactInr(kpis.totalNetSalesInr),
      trend: `${kpis.salesDeltaPct >= 0 ? '+' : ''}${kpis.salesDeltaPct}% • Avg ${kpis.avgCustomerRating}★ rating`,
      positive: kpis.salesDeltaPct >= 0,
      icon: <IndianRupee size={18} color="#059669" />,
      iconBg: '#ecfdf5',
    },
  ];

  return (
    <div className="kpi-grid">
      {cards.map((c) => (
        <div className="kpi-card" key={c.label}>
          <div className="kpi-icon-box" style={{ background: c.iconBg }}>
            {c.icon}
          </div>
          <div className="kpi-label">{c.label}</div>
          <div className="kpi-value tabular-nums">{c.value}</div>
          <div className={`kpi-trend ${c.positive ? 'trend-up' : 'trend-down'}`}>
            {c.positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            <span>{c.trend}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

