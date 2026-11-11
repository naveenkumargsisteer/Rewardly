import React, { useState } from 'react';
import { Line } from 'react-chartjs-2';
import { TrendingUp } from 'lucide-react';
import './chartSetup';
import { formatCompactInr } from '../api/client';

export default function TrendChartCard({ monthlyTrend }) {
  const [metric, setMetric] = useState('performance'); // 'performance' | 'sales'

  const labels = (monthlyTrend || []).map((m) => m.shortLabel);
  const values = (monthlyTrend || []).map((m) =>
    metric === 'performance' ? m.performanceScore : Math.round(m.netSalesInr / 100000)
  );

  const data = {
    labels,
    datasets: [
      {
        label: metric === 'performance' ? 'Performance Score (%)' : 'Net Sales (₹ Lakhs)',
        data: values,
        borderColor: '#6d28d9',
        backgroundColor: (ctx) => {
          const chart = ctx.chart;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return 'rgba(109, 40, 217, 0.12)';
          const grad = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          grad.addColorStop(0, 'rgba(109, 40, 217, 0.25)');
          grad.addColorStop(1, 'rgba(109, 40, 217, 0.01)');
          return grad;
        },
        fill: true,
        tension: 0.36,
        borderWidth: 2.5,
        pointBackgroundColor: '#fff',
        pointBorderColor: '#6d28d9',
        pointBorderWidth: 2.5,
        pointRadius: 5,
        pointHoverRadius: 7,
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
          label: (item) =>
            metric === 'performance'
              ? ` Score: ${item.raw}%`
              : ` Sales: ${formatCompactInr(monthlyTrend[item.dataIndex]?.netSalesInr || 0)}`,
        },
      },
    },
    scales: {
      x: { grid: { display: false }, border: { display: false } },
      y: {
        beginAtZero: metric === 'sales',
        suggestedMin: metric === 'performance' ? 50 : 0,
        suggestedMax: metric === 'performance' ? 100 : undefined,
        grid: { color: '#f1f3f8' },
        border: { display: false },
        ticks: {
          callback: (val) => (metric === 'performance' ? `${val}%` : `₹${val}L`),
        },
      },
    },
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title-row">
          <TrendingUp size={17} color="#6d28d9" />
          <span>{metric === 'performance' ? 'Performance & Recognition Trend' : 'Monthly Sales Revenue Trend'}</span>
        </div>
        <div className="nav-pills" style={{ padding: 3 }}>
          <button
            type="button"
            className={`nav-pill ${metric === 'performance' ? 'active' : ''}`}
            style={{ padding: '4px 10px', fontSize: 11 }}
            onClick={() => setMetric('performance')}
          >
            Score %
          </button>
          <button
            type="button"
            className={`nav-pill ${metric === 'sales' ? 'active' : ''}`}
            style={{ padding: '4px 10px', fontSize: 11 }}
            onClick={() => setMetric('sales')}
          >
            Sales ₹
          </button>
        </div>
      </div>
      <div className="chart-box">
        <Line data={data} options={options} />
      </div>
    </div>
  );
}

