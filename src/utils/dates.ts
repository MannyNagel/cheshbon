export function todayIsoDate() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

export function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function normalizeReviewDate(value: string, latestDate = todayIsoDate()) {
  const trimmed = value.trim();
  if (!isIsoDate(trimmed)) return null;
  return trimmed > latestDate ? latestDate : trimmed;
}

export function calculateReviewStreak(completedDates: Iterable<string>, today = todayIsoDate()) {
  const completed = new Set(completedDates);
  let cursor = completed.has(today) ? today : addDaysIso(today, -1);
  let streak = 0;
  while (completed.has(cursor)) {
    streak += 1;
    cursor = addDaysIso(cursor, -1);
  }
  return streak;
}

export function addDaysIso(date: string, delta: number) {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(year, month - 1, day + delta);
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');
}

export function dayOfWeek(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
}

export function dayName(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(new Date(year, month - 1, day));
}

export function shortDayName(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(year, month - 1, day));
}

export function monthDay(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(year, month - 1, day));
}

export function dayOfMonth(date: string) {
  return Number(date.split('-')[2]);
}

export function daysAgoIso(days: number) {
  return addDaysIso(todayIsoDate(), -days);
}
