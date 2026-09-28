const HEBCAL_ENDPOINT = 'https://www.hebcal.com/hebcal';

type HebcalItem = {
  title?: string;
  date?: string;
  category?: string;
};

const yearCache = new Map<number, Promise<Set<string>>>();

export async function isDiasporaYomTovDate(isoDate: string) {
  const year = Number(isoDate.slice(0, 4));
  if (!Number.isFinite(year)) return false;
  try {
    const dates = await getDiasporaYomTovDates(year);
    return dates.has(isoDate);
  } catch {
    return isDiasporaYomTovDateFallback(isoDate);
  }
}

export function isDiasporaYomTovDateFallback(isoDate: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-hebrew', {
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }).formatToParts(new Date(`${isoDate}T12:00:00Z`));
    const day = Number(parts.find((part) => part.type === 'day')?.value);
    const month = normalizeHebrewMonth(parts.find((part) => part.type === 'month')?.value ?? '');
    return isFullDiasporaYomTovHebrewDate(month, day);
  } catch {
    return false;
  }
}

export function isFullDiasporaYomTovHebrewDate(month: string, day: number) {
  const normalizedMonth = normalizeHebrewMonth(month);
  if (normalizedMonth === 'tishri') return [1, 2, 10, 15, 16, 22, 23].includes(day);
  if (normalizedMonth === 'nisan') return [15, 16, 21, 22].includes(day);
  if (normalizedMonth === 'sivan') return [6, 7].includes(day);
  return false;
}

export function isFullDiasporaYomTovTitle(title: string) {
  const normalized = title.trim().toLowerCase();
  return /^(rosh hashana( \d+| ii)?|yom kippur|sukkot (i|ii)|shmini atzeret|simchat torah|pesach (i|ii|vii|viii)|shavuot (i|ii))$/.test(normalized);
}

async function getDiasporaYomTovDates(year: number) {
  let pending = yearCache.get(year);
  if (!pending) {
    pending = fetchDiasporaYomTovDates(year);
    yearCache.set(year, pending);
  }
  return pending;
}

async function fetchDiasporaYomTovDates(year: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const params = new URLSearchParams({
      v: '1',
      cfg: 'json',
      start: `${year}-01-01`,
      end: `${year}-12-31`,
      maj: 'on',
      i: 'off',
    });
    const response = await fetch(`${HEBCAL_ENDPOINT}?${params.toString()}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`Hebcal returned ${response.status}`);
    const payload = await response.json() as { items?: HebcalItem[] };
    const dates = new Set<string>();
    for (const item of payload.items ?? []) {
      if (item.category === 'holiday' && item.date && item.title && isFullDiasporaYomTovTitle(item.title)) {
        dates.add(item.date.slice(0, 10));
      }
    }
    if (!dates.size) throw new Error('Hebcal returned no Yom Tov dates');
    return dates;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeHebrewMonth(month: string) {
  return month.toLowerCase().replace(/[^a-z]/g, '').replace(/^tishrei$/, 'tishri').replace(/^nissan$/, 'nisan');
}
