// Anonymous per-device id (no accounts). Lives in localStorage; falls back to a
// per-session id when storage is blocked (private mode).
const KEY = 'kc.deviceId';
let memo: string | null = null;

export function deviceId(): string {
  if (memo) return memo;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && /^[0-9a-f-]{36}$/i.test(saved)) return (memo = saved);
    memo = crypto.randomUUID();
    localStorage.setItem(KEY, memo);
  } catch {
    memo ??= crypto.randomUUID();
  }
  return memo;
}
