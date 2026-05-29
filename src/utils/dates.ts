export function todayIsoDate() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
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
