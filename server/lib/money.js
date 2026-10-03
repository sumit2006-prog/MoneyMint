export const MAX_MONEY = 1_000_000_000;

export function toPaise(value) {
  if (value === null || value === undefined || value === '') return null;
  const amount = String(value).trim();
  const match = amount.match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match) return null;
  const [, sign, whole, fraction = ''] = match;
  if (fraction.slice(2).replace(/0/g, '')) return null;
  const minor = BigInt(`${whole}${fraction.slice(0, 2).padEnd(2, '0')}`);
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  const paise = Number(minor);
  return sign ? -paise : paise;
}

export const fromPaise = (paise) => paise / 100;

export function normalizeMoney(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > MAX_MONEY) return null;
  const paise = toPaise(value);
  return paise === null ? null : fromPaise(paise);
}

export function sumMoney(values) {
  return fromPaise(values.reduce((sum, value) => {
    const paise = toPaise(value);
    if (paise === null) throw new TypeError('Cannot sum an invalid monetary amount.');
    return sum + paise;
  }, 0));
}

export const mongoPaiseSum = (field = '$amount') => ({
  $sum: { $round: [{ $multiply: [field, 100] }, 0] },
});
