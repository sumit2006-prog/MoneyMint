export function spendingGaugeStatus(percent) {
  const usage = Number.isFinite(Number(percent)) ? Math.max(0, Number(percent)) : 0;
  if (usage > 100) return 'OVER LIMIT';
  if (usage >= 90) return 'HIGH';
  if (usage > 70) return 'MEDIUM';
  return 'LOW';
}

export function spendingGaugeAngle(percent) {
  const usage = Number.isFinite(Number(percent)) ? Math.min(120, Math.max(0, Number(percent))) : 0;
  let progress;

  if (usage <= 70) progress = (usage / 70) * 45;
  else if (usage <= 90) progress = 45 + ((usage - 70) / 20) * 45;
  else if (usage <= 100) progress = 90 + ((usage - 90) / 10) * 45;
  else progress = 135 + ((usage - 100) / 20) * 45;

  return -90 + progress;
}

export function formatSpendingPercent(percent) {
  const rounded = Math.round(Number(percent) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
