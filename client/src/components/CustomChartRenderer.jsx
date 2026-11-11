import React from 'react';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import './chartSetup';

const SLICE_PALETTE = [
  '#7C3AED', '#3B82F6', '#06B6D4', '#10B981', '#F59E0B',
  '#EC4899', '#6366F1', '#14B8A6', '#F97316', '#8B5CF6',
];

export const CHART_TYPE_OPTIONS = [
  { id: 'bar', label: 'Bar' },
  { id: 'horizontalBar', label: 'H-Bar' },
  { id: 'line', label: 'Line' },
  { id: 'area', label: 'Area' },
  { id: 'doughnut', label: 'Doughnut' },
];

export default function CustomChartRenderer({ spec, height = 220 }) {
  if (!spec || !spec.labels?.length) return null;

  const type = spec.type || 'bar';
  const datasets = spec.datasets || [];

  if (type === 'doughnut') {
    const first = datasets[0] || { label: 'Value', data: [] };
    const bgColors = first.colors || spec.labels.map((_, idx) => SLICE_PALETTE[idx % SLICE_PALETTE.length]);
    const data = {
      labels: spec.labels,
      datasets: [
        {
          label: first.label,
          data: first.data,
          backgroundColor: bgColors,
          borderColor: '#ffffff',
          borderWidth: 2,
          cutout: '58%',
        },
      ],
    };
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { boxWidth: 10, font: { size: 11 } },
        },
      },
    };
    return (
      <div style={{ height }}>
        <Doughnut data={data} options={options} />
      </div>
    );
  }

  if (type === 'line' || type === 'area') {
    const isArea = type === 'area';
    const data = {
      labels: spec.labels,
      datasets: datasets.map((ds, idx) => {
        const c = ds.color || SLICE_PALETTE[idx % SLICE_PALETTE.length];
        return {
          label: ds.label,
          data: ds.data,
          borderColor: c,
          backgroundColor: isArea ? `${c}28` : c,
          fill: isArea,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 4,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: c,
          pointBorderWidth: 2,
        };
      }),
    };
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: datasets.length > 1,
          labels: { boxWidth: 10, font: { size: 11 } },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { beginAtZero: true, grid: { color: '#f1f3f8' }, ticks: { font: { size: 11 } } },
      },
    };
    return (
      <div style={{ height }}>
        <Line data={data} options={options} />
      </div>
    );
  }

  // Vertical Bar or Horizontal Bar
  const isHorizontal = type === 'horizontalBar';
  const data = {
    labels: spec.labels,
    datasets: datasets.map((ds, idx) => {
      const c = ds.color || SLICE_PALETTE[idx % SLICE_PALETTE.length];
      return {
        label: ds.label,
        data: ds.data,
        backgroundColor: ds.colors || (datasets.length === 1 && !ds.singleColor
          ? spec.labels.map((_, i) => ds.color || SLICE_PALETTE[i % SLICE_PALETTE.length])
          : c),
        borderRadius: 7,
        barThickness: isHorizontal ? 16 : undefined,
      };
    }),
  };

  const options = {
    indexAxis: isHorizontal ? 'y' : 'x',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: datasets.length > 1,
        labels: { boxWidth: 10, font: { size: 11 } },
      },
    },
    scales: {
      x: {
        beginAtZero: isHorizontal,
        grid: { display: isHorizontal, color: '#f1f3f8' },
        ticks: { font: { size: 11 } },
      },
      y: {
        beginAtZero: !isHorizontal,
        grid: { display: !isHorizontal, color: '#f1f3f8' },
        ticks: { font: { size: 11 } },
      },
    },
  };

  return (
    <div style={{ height }}>
      <Bar data={data} options={options} />
    </div>
  );
}

