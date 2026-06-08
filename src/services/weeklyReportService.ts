import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { LOCAL_USER_ID } from '@/src/constants/seedData';
import { getDb } from '@/src/db/client';
import type { MetricType } from '@/src/models/types';
import { addDaysIso, dayOfWeek, monthDay, todayIsoDate } from '@/src/utils/dates';
import { makeId } from '@/src/utils/ids';

type ScoreRow = {
  entry_id: string;
  entry_date: string;
  practice_id: string;
  practice_name: string;
  domain_id: string;
  domain_name: string;
  metric_name: string | null;
  metric_type: MetricType | null;
  value_boolean: number | null;
  value_number: number | null;
  value_text: string | null;
  status: string | null;
  note: string | null;
};

type SessionRow = {
  review_date: string;
  general_day_rating: number | null;
  main_win: string | null;
  main_struggle: string | null;
  pattern_noticed: string | null;
  adjustment_for_tomorrow: string | null;
  note: string | null;
  completed_at: string | null;
};

type BlockerRow = {
  entry_date: string;
  blocker_name: string;
  practice_name: string;
  domain_name: string;
};

type ScoreSummary = {
  id: string;
  name: string;
  average: number | null;
  entries: number;
  done: number;
  partial: number;
  missed: number;
  textEntries: number;
};

export type WeeklyReportPeriod = {
  weekStart: string;
  weekEnd: string;
  reportThrough: string;
  availableFrom: string;
};

export type SavedWeeklyReport = {
  id: string;
  weekStart: string;
  weekEnd: string;
  availableFrom: string;
  generatedAt: string;
  reportMarkdown: string;
};

export type WeeklyReportData = {
  generatedAt: string;
  weekStart: string;
  weekEnd: string;
  reportThrough: string;
  availableFrom: string;
  isSaturdayReport: boolean;
  currentWeekLabel: string;
  previousWeekLabel: string;
  domains: Array<ScoreSummary & { previousAverage: number | null; delta: number | null }>;
  practices: Array<ScoreSummary & { domainName: string; previousAverage: number | null; delta: number | null }>;
  daily: Array<{
    date: string;
    label: string;
    completed: boolean;
    average: number | null;
    generalDayRating: number | null;
    wins: string[];
    struggles: string[];
    patterns: string[];
    adjustments: string[];
    notes: string[];
    textReflections: Array<{ practiceName: string; domainName: string; text: string }>;
  }>;
  blockers: Array<{ blockerName: string; count: number; practices: string[]; domains: string[] }>;
  rawEntries: Array<{
    date: string;
    domainName: string;
    practiceName: string;
    metricName: string | null;
    metricType: MetricType | null;
    status: string | null;
    score: number | null;
    note: string | null;
    text: string | null;
  }>;
};

export function getActiveWeeklyReportPeriod(now = new Date()): WeeklyReportPeriod {
  const anchor = latestReportRollover(now);
  const anchorIso = isoFromDate(anchor);
  const weekStart = addDaysIso(anchorIso, -5);
  const weekEnd = addDaysIso(weekStart, 6);
  const today = todayIsoDate();
  return {
    weekStart,
    weekEnd,
    reportThrough: today < weekEnd ? today : weekEnd,
    availableFrom: `${anchorIso}T12:00:00`,
  };
}

export async function getSavedWeeklyReports(): Promise<SavedWeeklyReport[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    week_start_date: string;
    week_end_date: string;
    report_available_from: string;
    generated_at: string;
    report_markdown: string;
  }>(
    `SELECT id,
      week_start_date,
      week_end_date,
      report_available_from,
      generated_at,
      report_markdown
     FROM weekly_reports
     WHERE user_id = ?
     ORDER BY week_start_date DESC`,
    LOCAL_USER_ID,
  );
  return rows.map(mapSavedReport);
}

export async function getSavedWeeklyReport(weekStart: string): Promise<SavedWeeklyReport | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    id: string;
    week_start_date: string;
    week_end_date: string;
    report_available_from: string;
    generated_at: string;
    report_markdown: string;
  }>(
    `SELECT id,
      week_start_date,
      week_end_date,
      report_available_from,
      generated_at,
      report_markdown
     FROM weekly_reports
     WHERE user_id = ?
      AND week_start_date = ?
     LIMIT 1`,
    LOCAL_USER_ID,
    weekStart,
  );
  return row ? mapSavedReport(row) : null;
}

export async function saveWeeklyReport(report: string, data: WeeklyReportData): Promise<SavedWeeklyReport> {
  const db = await getDb();
  const id = makeId('weekly_report');
  const generatedAt = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO weekly_reports
      (id, user_id, week_start_date, week_end_date, report_available_from, report_markdown, generated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, week_start_date) DO UPDATE SET
      week_end_date = excluded.week_end_date,
      report_available_from = excluded.report_available_from,
      report_markdown = excluded.report_markdown,
      generated_at = excluded.generated_at,
      updated_at = CURRENT_TIMESTAMP`,
    id,
    LOCAL_USER_ID,
    data.weekStart,
    data.weekEnd,
    data.availableFrom,
    report,
    generatedAt,
  );
  return {
    id,
    weekStart: data.weekStart,
    weekEnd: data.weekEnd,
    availableFrom: data.availableFrom,
    generatedAt,
    reportMarkdown: report,
  };
}

export async function getWeeklyReportData(period = getActiveWeeklyReportPeriod()): Promise<WeeklyReportData> {
  const { weekStart, weekEnd, reportThrough } = period;
  const previousWeekStart = addDaysIso(weekStart, -7);
  const previousWeekEnd = addDaysIso(weekStart, -1);
  const [currentRows, previousRows, sessions, blockerRows] = await Promise.all([
    getScoreRows(weekStart, reportThrough),
    getScoreRows(previousWeekStart, previousWeekEnd),
    getSessions(weekStart, reportThrough),
    getBlockers(weekStart, reportThrough),
  ]);

  const currentDomains = summarizeScores(currentRows, (row) => row.domain_id, (row) => row.domain_name);
  const previousDomains = summarizeScores(previousRows, (row) => row.domain_id, (row) => row.domain_name);
  const currentPractices = summarizeScores(currentRows, (row) => row.practice_id, (row) => row.practice_name);
  const previousPractices = summarizeScores(previousRows, (row) => row.practice_id, (row) => row.practice_name);
  const domainByPractice = new Map(currentRows.map((row) => [row.practice_id, row.domain_name]));

  return {
    generatedAt: new Date().toISOString(),
    weekStart,
    weekEnd,
    reportThrough,
    availableFrom: period.availableFrom,
    isSaturdayReport: dayOfWeek(todayIsoDate()) === 6,
    currentWeekLabel: `${monthDay(weekStart)} - ${monthDay(reportThrough)}`,
    previousWeekLabel: `${monthDay(previousWeekStart)} - ${monthDay(previousWeekEnd)}`,
    domains: attachComparison(currentDomains, previousDomains).sort(sortByDeltaThenName),
    practices: attachComparison(currentPractices, previousPractices)
      .map((practice) => ({ ...practice, domainName: domainByPractice.get(practice.id) ?? 'Domain' }))
      .sort(sortByDeltaThenName),
    daily: buildDailySummaries(weekStart, reportThrough, currentRows, sessions),
    blockers: summarizeBlockers(blockerRows),
    rawEntries: currentRows.map((row) => ({
      date: row.entry_date,
      domainName: row.domain_name,
      practiceName: row.practice_name,
      metricName: row.metric_name,
      metricType: row.metric_type,
      status: row.status,
      score: scoreRow(row),
      note: cleanText(row.note),
      text: cleanText(row.value_text),
    })),
  };
}

export async function generateWeeklyReport(data: WeeklyReportData): Promise<string> {
  const response = await fetch('/api/weekly-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  });
  const payload = await response.json().catch(() => null) as { report?: string; error?: string } | null;
  if (!response.ok) {
    throw new Error(payload?.error ?? 'Could not generate weekly report.');
  }
  if (!payload?.report) throw new Error('Report response was empty.');
  return payload.report;
}

export async function exportWeeklyReportMarkdown(report: string, data: { weekStart: string; weekEnd?: string; reportThrough?: string }) {
  const end = data.reportThrough ?? data.weekEnd ?? data.weekStart;
  const filename = `daily-cheshbon-weekly-report-${data.weekStart}-to-${end}.md`;
  if (typeof document !== 'undefined') {
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return;
  }

  const path = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, report);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, { mimeType: 'text/markdown', dialogTitle: 'Export weekly report' });
  }
}

function latestReportRollover(now: Date) {
  const rollover = new Date(now);
  rollover.setHours(12, 0, 0, 0);
  const daysSinceFriday = (rollover.getDay() - 5 + 7) % 7;
  rollover.setDate(rollover.getDate() - daysSinceFriday);
  if (now < rollover) {
    rollover.setDate(rollover.getDate() - 7);
  }
  return rollover;
}

function isoFromDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function mapSavedReport(row: {
  id: string;
  week_start_date: string;
  week_end_date: string;
  report_available_from: string;
  generated_at: string;
  report_markdown: string;
}): SavedWeeklyReport {
  return {
    id: row.id,
    weekStart: row.week_start_date,
    weekEnd: row.week_end_date,
    availableFrom: row.report_available_from,
    generatedAt: row.generated_at,
    reportMarkdown: row.report_markdown,
  };
}

async function getScoreRows(startDate: string, endDate: string) {
  const db = await getDb();
  return db.getAllAsync<ScoreRow>(
    `SELECT de.entry_date,
      de.id as entry_id,
      p.id as practice_id,
      p.name as practice_name,
      d.id as domain_id,
      d.name as domain_name,
      m.name as metric_name,
      m.metric_type,
      emv.value_boolean,
      emv.value_number,
      emv.value_text,
      de.status,
      de.note
     FROM daily_entries de
     JOIN practices p ON p.id = de.practice_id
     JOIN domains d ON d.id = p.domain_id
     LEFT JOIN metrics m ON m.practice_id = p.id AND m.active = 1
     LEFT JOIN entry_metric_values emv ON emv.entry_id = de.id AND emv.metric_id = m.id
     WHERE de.entry_date >= ?
      AND de.entry_date <= ?
      AND p.active = 1
      AND d.active = 1
     ORDER BY de.entry_date, d.sort_order, p.name, m.sort_order`,
    startDate,
    endDate,
  );
}

async function getSessions(startDate: string, endDate: string) {
  const db = await getDb();
  return db.getAllAsync<SessionRow>(
    `SELECT review_date,
      general_day_rating,
      main_win,
      main_struggle,
      pattern_noticed,
      adjustment_for_tomorrow,
      note,
      completed_at
     FROM daily_review_sessions
     WHERE review_date >= ?
      AND review_date <= ?
     ORDER BY review_date`,
    startDate,
    endDate,
  );
}

async function getBlockers(startDate: string, endDate: string) {
  const db = await getDb();
  return db.getAllAsync<BlockerRow>(
    `SELECT de.entry_date,
      b.name as blocker_name,
      p.name as practice_name,
      d.name as domain_name
     FROM entry_blockers eb
     JOIN blockers b ON b.id = eb.blocker_id
     JOIN daily_entries de ON de.id = eb.entry_id
     JOIN practices p ON p.id = de.practice_id
     JOIN domains d ON d.id = p.domain_id
     WHERE de.entry_date >= ?
      AND de.entry_date <= ?
     ORDER BY de.entry_date, b.name`,
    startDate,
    endDate,
  );
}

function summarizeScores(rows: ScoreRow[], idFor: (row: ScoreRow) => string, nameFor: (row: ScoreRow) => string) {
  const map = new Map<string, ScoreSummary & { scores: number[]; entryIds: Set<string>; statusEntryIds: Set<string>; textEntryIds: Set<string> }>();
  for (const row of rows) {
    const id = idFor(row);
    const item = map.get(id) ?? {
      id,
      name: nameFor(row),
      average: null,
      entries: 0,
      done: 0,
      partial: 0,
      missed: 0,
      textEntries: 0,
      scores: [],
      entryIds: new Set<string>(),
      statusEntryIds: new Set<string>(),
      textEntryIds: new Set<string>(),
    };
    const score = scoreRow(row);
    if (score != null) item.scores.push(score);
    item.entryIds.add(row.entry_id);
    if (!item.statusEntryIds.has(row.entry_id)) {
      if (row.status === 'done') item.done += 1;
      if (row.status === 'partial') item.partial += 1;
      if (row.status === 'missed') item.missed += 1;
      item.statusEntryIds.add(row.entry_id);
    }
    if ((cleanText(row.value_text) || cleanText(row.note)) && !item.textEntryIds.has(row.entry_id)) {
      item.textEntries += 1;
      item.textEntryIds.add(row.entry_id);
    }
    item.entries = item.entryIds.size;
    map.set(id, item);
  }

  return [...map.values()].map(({ scores, entryIds, statusEntryIds, textEntryIds, ...item }) => ({
    ...item,
    average: round1(average(scores)),
  }));
}

function attachComparison(current: ScoreSummary[], previous: ScoreSummary[]) {
  const previousById = new Map(previous.map((item) => [item.id, item]));
  return current.map((item) => {
    const previousAverage = previousById.get(item.id)?.average ?? null;
    return {
      ...item,
      previousAverage,
      delta: item.average == null || previousAverage == null ? null : round1(item.average - previousAverage),
    };
  });
}

function buildDailySummaries(startDate: string, endDate: string, rows: ScoreRow[], sessions: SessionRow[]): WeeklyReportData['daily'] {
  const sessionByDate = new Map(sessions.map((session) => [session.review_date, session]));
  const summaries: WeeklyReportData['daily'] = [];
  for (let date = startDate; date <= endDate; date = addDaysIso(date, 1)) {
    const dayRows = rows.filter((row) => row.entry_date === date);
    const scores = dayRows.map(scoreRow).filter((score): score is number => score != null);
    const session = sessionByDate.get(date);
    summaries.push({
      date,
      label: monthDay(date),
      completed: Boolean(session?.completed_at),
      average: round1(average(scores)),
      generalDayRating: session?.general_day_rating ?? null,
      wins: compact([session?.main_win]),
      struggles: compact([session?.main_struggle]),
      patterns: compact([session?.pattern_noticed]),
      adjustments: compact([session?.adjustment_for_tomorrow]),
      notes: compact([session?.note, ...dayRows.map((row) => row.note)]),
      textReflections: dayRows
        .map((row) => ({
          practiceName: row.practice_name,
          domainName: row.domain_name,
          text: cleanText(row.value_text),
        }))
        .filter((entry): entry is { practiceName: string; domainName: string; text: string } => Boolean(entry.text)),
    });
  }
  return summaries;
}

function summarizeBlockers(rows: BlockerRow[]) {
  const map = new Map<string, { blockerName: string; count: number; practices: Set<string>; domains: Set<string> }>();
  for (const row of rows) {
    const item = map.get(row.blocker_name) ?? {
      blockerName: row.blocker_name,
      count: 0,
      practices: new Set<string>(),
      domains: new Set<string>(),
    };
    item.count += 1;
    item.practices.add(row.practice_name);
    item.domains.add(row.domain_name);
    map.set(row.blocker_name, item);
  }
  return [...map.values()]
    .map((item) => ({
      blockerName: item.blockerName,
      count: item.count,
      practices: [...item.practices].sort(),
      domains: [...item.domains].sort(),
    }))
    .sort((a, b) => b.count - a.count || a.blockerName.localeCompare(b.blockerName));
}

function scoreRow(row: ScoreRow) {
  if (row.metric_type === 'scale' && row.value_number != null) return row.value_number;
  if (row.metric_type === 'boolean' && row.value_boolean != null) return scaleCompletion(row.value_boolean);
  if (row.status === 'done') return 5;
  if (row.status === 'partial') return 3;
  if (row.status === 'missed') return 1;
  return null;
}

function scaleCompletion(value: number) {
  return value ? 5 : 1;
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round1(value: number | null) {
  return value == null || !Number.isFinite(value) ? null : Math.round(value * 10) / 10;
}

function cleanText(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : null;
}

function compact(values: Array<string | null | undefined>) {
  return [...new Set(values.map(cleanText).filter((value): value is string => Boolean(value)))];
}

function sortByDeltaThenName(a: { name: string; delta: number | null }, b: { name: string; delta: number | null }) {
  const aDelta = a.delta == null ? Number.POSITIVE_INFINITY : a.delta;
  const bDelta = b.delta == null ? Number.POSITIVE_INFINITY : b.delta;
  return aDelta - bDelta || a.name.localeCompare(b.name);
}
