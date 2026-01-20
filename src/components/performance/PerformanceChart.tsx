// src/components/performance/PerformanceChart.tsx
import React from 'react';

interface PerformanceMetric {
  shift_date: string;
  completed_on_time: number;
  completed_with_exceptions: number;
  avg_completion_time_minutes: number;
}

interface PerformanceChartProps {
  data: PerformanceMetric[];
}

const PerformanceChart: React.FC<PerformanceChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div style={{
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: '8px',
        padding: '2rem',
        textAlign: 'center',
        color: 'var(--color-text-secondary)'
      }}>
        No performance data available
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.completed_on_time), 1);

  return (
    <div style={{
      background: 'var(--color-bg-secondary)',
      border: '1px solid var(--color-border)',
      borderRadius: '8px',
      padding: '1.5rem'
    }}>
      <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--color-text)' }}>
        Completion Trend
      </h3>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', height: '200px' }}>
        {data.map((metric, index) => {
          const percentage = (metric.completed_on_time / maxValue) * 100;
          const date = new Date(metric.shift_date);

          return (
            <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  width: '100%',
                  height: `${percentage}%`,
                  background: 'linear-gradient(180deg, var(--color-primary), var(--color-success))',
                  borderRadius: '4px 4px 0 0',
                  minHeight: '4px',
                  transition: 'all 0.3s',
                  cursor: 'pointer'
                }}
                title={`${metric.completed_on_time} completed on ${metric.shift_date}`}
              />
              <div style={{
                fontSize: '0.7rem',
                color: 'var(--color-text-secondary)',
                marginTop: '0.5rem',
                textAlign: 'center'
              }}>
                {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PerformanceChart;
