// Input validation at trust boundaries — user-submitted free-text fields.

export function validateEmail(input: string): string | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(s)) return null;
  return s;
}

export function validatePassword(input: string): string | null {
  if (!input || input.length < 6) return null;
  if (input.length > 100) return null;
  return input;
}

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

export function validateAge(input: string | number): number | null {
  const n = Number(input);
  if (!Number.isFinite(n) || n < 10 || n > 120) return null;
  return Math.round(n);
}

export function validateHeight(input: string | number): number | null {
  const n = Number(input);
  if (!Number.isFinite(n) || n < 100 || n > 250) return null;
  return Math.round(n);
}

export function validateWeight(input: string | number): number | null {
  const n = Number(input);
  if (!Number.isFinite(n) || n < 30 || n > 300) return null;
  return Math.round(n * 10) / 10;
}

export function validatePhone(input: string): string | null {
  // Indonesian phone: +62 or 08 format
  const s = input.replace(/[\s-]/g, '');
  if (/^(\+62|62|0)8[1-9]\d{6,11}$/.test(s)) {
    // Normalize to +62 format
    let normalized = s;
    if (normalized.startsWith('0')) normalized = '+62' + normalized.slice(1);
    else if (normalized.startsWith('62')) normalized = '+' + normalized;
    return normalized;
  }
  return null;
}

export function sanitizeText(input: string, maxLen = 200): string | null {
  const s = input.trim().slice(0, maxLen);
  if (!s) return null;
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
  if (/[;'"\\]/.test(s)) return null;
  return s;
}

// BMR/TDEE calculation — Mifflin-St Jeor equation
export function calcTDEE(
  gender: string,
  weightKg: number,
  heightCm: number,
  age: number,
  activityLevel: string
): number {
  // BMR (Mifflin-St Jeor)
  let bmr: number;
  if (gender === 'female') {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  } else {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  }

  // Activity multiplier
  const multipliers: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
  };
  const mult = multipliers[activityLevel] ?? 1.375;

  return Math.round(bmr * mult);
}

// Suggest protein target (g) based on goal + weight
export function suggestProtein(goal: string, weightKg: number): number {
  const perKg: Record<string, number> = {
    weight_loss: 1.6,
    muscle_gain: 2.0,
    maintenance: 1.2,
    general_health: 1.0,
  };
  const factor = perKg[goal] ?? 1.2;
  return Math.round(weightKg * factor);
}
