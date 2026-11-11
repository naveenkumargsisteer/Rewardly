import React, { useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { BarChart3 } from 'lucide-react';
import './chartSetup';
import { formatCompactInr } from '../api/client';

export default function DeptBarChartCard({ departments }) {
  const [mode, setMode] = useState('loyalty'); // 'loyalty' | 'sales'

  const list = departments || [];
  const data = {
    labels: list.map((d) => d.code),
    datasets: [
      {
        label: mode === 'loyalty' ? 'Loyalty & Perf Score %' : 'Net Sales (₹ Lakhs)',
        data: list.map((d) =>
          mode === 'loyalty' ? d.avgPerformanceScore : Math.round(d.netSalesInr / 100000)
        ),
        backgroundColor: list.map((d) => d.colorHex || '#7C3AED'),
        borderRadius: 8,
        barThickness: 28,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => list[items[0]?.dataIndex]?.name || '',
          label: (item) => {
            const dept = list[item.dataIndex];
            return mode === 'loyalty'
              ? ` Perf: ${dept.avgPerformanceScore}% | Attendance: ${dept.attendanceRate}%`
              : ` Sales: ${formatCompactInr(dept.netSalesInr)} (${dept.targetAchievementPct}% of target)`;
          },
        },
      },
    },
    scales: {
      x: { grid: { display: false }, border: { display: false } },
      y: {
        beginAtZero: true,
        suggestedMax: mode === 'loyalty' ? 100 : undefined,
        grid: { color: '#f1f3f8' },
        border: { display: false },
        ticks: {
          callback: (v) => (mode === 'loyalty' ? `${v}%` : `₹${v}L`),
        },
      },
    },
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title-row">
          <BarChart3 size={17} color="#3b82f6" />
          <span>{mode === 'loyalty' ? 'Loyalty & Score by Department' : 'Sales by Textile Department'}</span>
        </div>
        <div className="nav-pills" style={{ padding: 3 }}>
          <button
            type="button"
            className={`nav-pill ${mode === 'loyalty' ? 'active' : ''}`}
            style={{ padding: '4px 10px', fontSize: 11 }}
            onClick={() => setMode('loyalty')}
          >
            Loyalty %
          </button>
          <button
            type="button"
            className={`nav-pill ${mode === 'sales' ? 'active' : ''}`}
            style={{ padding: '4px 10px', fontSize: 11 }}
            onClick={() => setMode('sales')}
          >
            Sales ₹
          </button>
        </div>
      </div>
      <div className="chart-box">
        <Bar data={data} options={options} />
      </div>
    </div>
  );
}

