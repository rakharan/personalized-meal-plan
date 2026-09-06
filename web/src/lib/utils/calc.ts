// Client-side BMR/TDEE + protein calculation — mirrors src/validate.ts
// No API call needed during signup (fixes the pre-registration auth bug)

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

  const multipliers: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
  };
  const mult = multipliers[activityLevel] ?? 1.375;
  return Math.round(bmr * mult);
}

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
