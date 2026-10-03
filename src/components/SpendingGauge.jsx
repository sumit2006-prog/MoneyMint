import { formatSpendingPercent, spendingGaugeAngle } from '../lib/spendingGauge';

const statusMessages = {
  LOW: "You're comfortably within your monthly limit.",
  MEDIUM: 'Keep an eye on your spending.',
  HIGH: "You're getting close to your monthly limit.",
  'OVER LIMIT': "You've gone over your monthly limit.",
};

const labels = [
  { text: 'LOW', x: 46, y: 97, className: 'gauge-label-low' },
  { text: 'MEDIUM', x: 86, y: 61, className: 'gauge-label-medium' },
  { text: 'HIGH', x: 154, y: 61, className: 'gauge-label-high' },
];

export default function SpendingGauge({ percent, status }) {
  const hasBudget = Number.isFinite(percent);
  const needleAngle = spendingGaugeAngle(hasBudget ? percent : 0);
  const percentText = hasBudget ? `${formatSpendingPercent(percent)}% of your monthly budget used` : 'Set a monthly budget to track your pace.';
  const accessibleState = hasBudget ? `${formatSpendingPercent(percent)}% used, ${status}` : 'No monthly budget set';

  return <>
    <svg className="spending-gauge" viewBox="0 0 240 154" role="img" aria-label={`Monthly spending gauge: ${accessibleState}`}>
      <path className="gauge-segment gauge-segment-low" d="M30 122 A90 90 0 0 1 56.36 58.36" />
      <path className="gauge-segment gauge-segment-medium" d="M56.36 58.36 A90 90 0 0 1 120 32" />
      <path className="gauge-segment gauge-segment-high" d="M120 32 A90 90 0 0 1 183.64 58.36" />
      <path className="gauge-segment gauge-segment-over" d="M183.64 58.36 A90 90 0 0 1 210 122" />
      <path className="gauge-divider" d="M56.36 58.36 L65 67" />
      <path className="gauge-divider" d="M120 32 L120 44" />
      <path className="gauge-divider" d="M183.64 58.36 L175 67" />
      {labels.map((label) => <text key={label.text} className={`gauge-label ${label.className}`} x={label.x} y={label.y} textAnchor="middle">{label.text}</text>)}
      <text className="gauge-label gauge-label-over" x="182" y="92" textAnchor="middle"><tspan x="182">OVER</tspan><tspan x="182" dy="9">LIMIT</tspan></text>
      <g className="gauge-needle" style={{ transform: `rotate(${needleAngle}deg)` }} aria-hidden="true">
        <path className="gauge-needle-shape" d="M120 49 L113 121 L120 115 L127 121 Z" />
      </g>
      <circle className="gauge-pivot-ring" cx="120" cy="122" r="8" />
      <circle className="gauge-pivot" cx="120" cy="122" r="5" />
    </svg>
    <strong className="status-name">{status}</strong>
    <p>{percentText}</p>
    <small>{hasBudget ? statusMessages[status] : 'Your gauge will update when you add a monthly budget.'}</small>
  </>;
}
