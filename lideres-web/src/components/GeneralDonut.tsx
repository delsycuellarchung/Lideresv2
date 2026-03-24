import React from 'react';

interface GeneralDonutProps {
  value: number | null; // expected 0..4 scale
  label: string;
  color?: string;
}

// Lightweight animated donut using inline SVG, no external deps.
export const GeneralDonut: React.FC<GeneralDonutProps> = ({ value, label, color = '#4f46e5' }) => {
  const percent = value !== null ? Math.max(0, Math.min(100, value * 25)) : 0; // map 0-4 -> 0-100
  const size = 88;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div style={{ width: 100, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
        <defs>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.08" />
          </filter>
        </defs>
        <g transform={`translate(${size / 2}, ${size / 2})`}>
          <circle r={radius} fill="transparent" stroke="#e5e7eb" strokeWidth={stroke} />
          <circle
            r={radius}
            fill="transparent"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 700ms ease' }}
            transform={`rotate(-90)`}
            filter="url(#shadow)"
          />
          {/* numeric label intentionally removed per UX request */}
        </g>
      </svg>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginTop: 6, textAlign: 'center' }}>{label}</div>
    </div>
  );
};
