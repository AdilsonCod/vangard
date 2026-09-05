import { useState } from 'react';

// Personal planning preference, scoped to the professional on this device.
export function useProfessionalGoal(userId?: string) {
  const key = `vans_professional_goal_${userId || 'guest'}`;
  const [goals, setGoals] = useState<Record<string, number>>({});
  let stored = 10000;
  try {
    const raw = localStorage.getItem(key);
    const value = Number(raw);
    if (raw !== null && Number.isFinite(value) && value >= 0) stored = value;
  } catch { /* The planner also works when browser storage is unavailable. */ }
  const goal = goals[key] ?? stored;
  const setGoal = (value: number) => {
    const next = Number.isFinite(value) ? Math.max(0, value) : 0;
    setGoals(previous => ({ ...previous, [key]: next }));
    try { localStorage.setItem(key, String(next)); } catch { /* Keep the session preference. */ }
  };
  return [goal, setGoal] as const;
}
