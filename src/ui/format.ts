const intTh = new Intl.NumberFormat('th-TH');

export const formatInt = (n: number) => intTh.format(n);

// 83456 -> "1:23.45"
export function formatLap(ms: number): string {
  const totalCs = Math.round(ms / 10);
  const m = Math.floor(totalCs / 6000);
  const s = Math.floor((totalCs % 6000) / 100);
  const cs = totalCs % 100;
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
