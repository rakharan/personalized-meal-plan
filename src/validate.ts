// Input validation at trust boundaries — user-submitted free-text fields.

export function validateCalories(input: string): string | null {
  const n = Number(input);
  if (!Number.isFinite(n)) return null;
  if (n < 800 || n > 5000) return null;
  return String(Math.round(n));
}

export function validateProtein(input: string): string | null {
  const n = Number(input.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(n)) return null;
  if (n < 20 || n > 500) return null;
  return String(Math.round(n));
}

export function validateMealsPerDay(input: string): string | null {
  const n = Number(input);
  if (![3, 4, 5, 6].includes(n)) return null;
  return String(n);
}

export function sanitizeText(input: string, maxLen = 200): string | null {
  const s = input.trim().slice(0, maxLen);
  if (!s) return null;
  // Strip control chars + Telegram markdown specials that could break formatting.
  return s.replace(/[\x00-\x1f\x7f]/g, '').trim() || null;
}

export function validateTimeFormat(input: string): { h: number; min: number } | null {
  const m = input.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return { h, min };
}

export function validatePlanName(input: string): string | null {
  const s = sanitizeText(input, 40);
  if (!s) return null;
  // No SQL-ish chars — PG parameterized queries handle injection, but defense in depth.
  if (/[;'"\\]/.test(s)) return null;
  return s;
}
