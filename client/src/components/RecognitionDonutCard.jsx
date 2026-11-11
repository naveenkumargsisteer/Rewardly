import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Award } from 'lucide-react';
import './chartSetup';

export default function RecognitionDonutCard({ recognitionByType }) {
  const items = recognitionByType?.items || [];
  const lead = [...items].sort((a, b) => b.percentage - a.percentage)[0];

  const data = {
    labels: items.map((i) => i.type),
    datasets: [
      {
        data: items.map((i) => i.count),
        backgroundColor: items.map((i) => i.color),
        borderWidth: 2,
        borderColor: '#ffffff',
        cutout: '70%',
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
          label: (ctx) => {
            const item = items[ctx.dataIndex];
            return ` ${item.type}: ${item.count} (${item.percentage}%)`;
          },
        },
      },
    },
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title-row">
          <Award size={17} color="#7c3aed" />
          <span>Recognition by Type</span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
          {recognitionByType?.total || 0} Total
        </span>
      </div>

      <div className="donut-layout">
        <div className="donut-wrap">
          <Doughnut data={data} options={options} />
          <div className="donut-center">
            <div className="donut-center-pct">{lead ? `${lead.percentage}%` : '0%'}</div>
            <div className="donut-center-label">{lead?.type || 'None'}</div>
          </div>
        </div>

        <div className="legend-list">
          {items.map((item) => (
            <div className="legend-item" key={item.type}>
              <div className="legend-left">
                <span className="legend-dot" style={{ background: item.color }} />
                <span style={{ fontWeight: 500 }}>{item.type}</span>
              </div>
              <strong className="tabular-nums">{item.percentage}%</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

