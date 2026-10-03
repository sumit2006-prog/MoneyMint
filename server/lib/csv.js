export function csvCell(value) {
  let cell = String(value ?? '');
  if ('=+-@'.includes(cell.trimStart()[0] || '')) cell = `'${cell}`;
  return `"${cell.replaceAll('"', '""')}"`;
}
