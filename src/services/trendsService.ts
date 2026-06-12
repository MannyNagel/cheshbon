import { getDb } from '@/src/db/client';
import type { MetricType, QualitativeTrendSummary, TrendSummary, TrendWeekMode, TrendWindow } from '@/src/models/types';
import { getTrendPreferences } from '@/src/repositories/cheshbonRepo';
import { addDaysIso, dayOfWeek, daysAgoIso, shortDayName, todayIsoDate } from '@/src/utils/dates';

type MetricRow = {
  practice_id: string;
  practice_name: string;
  domain_id: string;
  domain_name: string;
  metric_id: string | null;
  metric_name: string | null;
  metric_type: MetricType | null;
  sort_order: number | null;
};

type ScoreValue = {
  practiceId: string;
  domainId: string;
  domainName: string;
  practiceName: string;
  value: number;
};

type NumericValue = { date: string; value: number };
type TextValue = { date: string; text: string };
type WeekWindow = { mode: TrendWeekMode; label: string; start: string; end: string };

type QualitativeEntryRow = {
  entry_id: string;
  entry_date: string;
  practice_id: string;
  practice_name: string;
  domain_id: string;
  domain_name: string;
  status: string | null;
  note: string | null;
  metric_type: MetricType | null;
  value_boolean: number | null;
  value_number: number | null;
  value_text: string | null;
};

type QualitativeBlockerRow = {
  blocker_name: string;
  practice_name: string;
  domain_name: string;
};

export async function getTrendSummary(): Promise<TrendSummary> {
  const db = await getDb();
  const trendPreferences = await getTrendPreferences();
  const weekWindow = getWeekWindow(trendPreferences.weekMode);
  const start30 = daysAgoIso(29);

  const metricRows = await db.getAllAsync<MetricRow>(
    `SELECT
      p.id as practice_id,
      p.name as practice_name,
      d.id as domain_id,
      d.name as domain_name,
      m.id as metric_id,
      m.name as metric_name,
      m.metric_type,
      m.sort_order
     FROM practices p
     JOIN domains d ON d.id = p.domain_id
     LEFT JOIN metrics m ON m.practice_id = p.id AND m.active = 1
     WHERE p.active = 1
      AND d.active = 1
      AND EXISTS (
        SELECT 1
        FROM routine_practices rp
        WHERE rp.practice_id = p.id
         AND rp.archived_from IS NULL
      )
     ORDER BY d.sort_order, p.name, m.sort_order`,
  );

  const practices = groupPractices(metricRows);
  const [scores7, scores30, commonBlockers] = await Promise.all([
    getPracticeScores(weekWindow.start, weekWindow.end),
    getPracticeScores(start30),
    db.getAllAsync<{
      blocker_id: string;
      blocker_name: string;
      count: number;
    }>(
      `SELECT b.id as blocker_id, b.name as blocker_name, COUNT(*) as count
       FROM entry_blockers eb
       JOIN blockers b ON b.id = eb.blocker_id
       JOIN daily_entries de ON de.id = eb.entry_id
       JOIN practices p ON p.id = de.practice_id
       WHERE de.entry_date >= ?
        AND EXISTS (
          SELECT 1
          FROM routine_practices rp
          WHERE rp.practice_id = p.id
           AND rp.archived_from IS NULL
        )
       GROUP BY b.id, b.name
       ORDER BY count DESC, b.name
       LIMIT 8`,
      start30,
    ),
  ]);

  const domainInsights = buildDomainInsights(scores7, scores30);
  const practiceTrends = [];
  for (const practice of practices) {
    const trend = await buildPracticeTrend(practice, weekWindow);
    if (trend) practiceTrends.push(trend);
  }

  return {
    weekMode: weekWindow.mode,
    weekLabel: weekWindow.label,
    domainInsights,
    practiceTrends,
    commonBlockers: commonBlockers.map((row) => ({
      blockerId: row.blocker_id,
      blockerName: row.blocker_name,
      count: row.count,
    })),
  };
}

export async function getQualitativeTrendSummary(): Promise<QualitativeTrendSummary> {
  const db = await getDb();
  const startDate = daysAgoIso(29);
  const today = todayIsoDate();
  const [rows, blockerRows] = await Promise.all([
    db.getAllAsync<QualitativeEntryRow>(
      `SELECT
        de.id as entry_id,
        de.entry_date,
        p.id as practice_id,
        p.name as practice_name,
        d.id as domain_id,
        d.name as domain_name,
        de.status,
        de.note,
        m.metric_type,
        emv.value_boolean,
        emv.value_number,
        emv.value_text
       FROM daily_entries de
       JOIN practices p ON p.id = de.practice_id
       JOIN domains d ON d.id = p.domain_id
       LEFT JOIN metrics m ON m.practice_id = p.id AND m.active = 1
       LEFT JOIN entry_metric_values emv ON emv.entry_id = de.id AND emv.metric_id = m.id
       WHERE de.entry_date >= ?
        AND de.entry_date <= ?
        AND p.active = 1
        AND d.active = 1
        AND EXISTS (
          SELECT 1
          FROM routine_practices rp
          WHERE rp.practice_id = p.id
           AND rp.archived_from IS NULL
        )
       ORDER BY de.entry_date DESC`,
      startDate,
      today,
    ),
    db.getAllAsync<QualitativeBlockerRow>(
      `SELECT b.name as blocker_name,
        p.name as practice_name,
        d.name as domain_name
       FROM entry_blockers eb
       JOIN blockers b ON b.id = eb.blocker_id
       JOIN daily_entries de ON de.id = eb.entry_id
       JOIN practices p ON p.id = de.practice_id
       JOIN domains d ON d.id = p.domain_id
       WHERE de.entry_date >= ?
        AND de.entry_date <= ?
        AND p.active = 1
        AND d.active = 1
        AND EXISTS (
          SELECT 1
          FROM routine_practices rp
          WHERE rp.practice_id = p.id
           AND rp.archived_from IS NULL
        )
       ORDER BY de.entry_date DESC`,
      startDate,
      today,
    ),
  ]);

  const domainMap = new Map<string, {
    domainId: string;
    domainName: string;
    practiceNames: Set<string>;
    qualityValues: number[];
    booleanValues: number[];
    statusValues: number[];
    noteCount: number;
    blockerNames: string[];
  }>();
  const notesByKey = new Map<string, QualitativeTrendSummary['recentNotes'][number]>();
  const countedNoteKeys = new Set<string>();

  for (const row of rows) {
    const domain = domainMap.get(row.domain_id) ?? {
      domainId: row.domain_id,
      domainName: row.domain_name,
      practiceNames: new Set<string>(),
      qualityValues: [],
      booleanValues: [],
      statusValues: [],
      noteCount: 0,
      blockerNames: [],
    };
    domain.practiceNames.add(row.practice_name);
    if (row.metric_type === 'scale' && row.value_number != null) domain.qualityValues.push(row.value_number);
    if (row.metric_type === 'boolean' && row.value_boolean != null) domain.booleanValues.push(row.value_boolean);
    if (row.status === 'done' || row.status === 'partial' || row.status === 'missed') {
      domain.statusValues.push(row.status === 'done' ? 1 : row.status === 'partial' ? 0.5 : 0);
    }

    const text = firstNonEmpty(row.value_text, row.note);
    if (text) {
      const noteKey = `${row.entry_id}-${text}`;
      if (!countedNoteKeys.has(noteKey)) {
        domain.noteCount += 1;
        countedNoteKeys.add(noteKey);
      }
      notesByKey.set(noteKey, {
        date: row.entry_date,
        practiceName: row.practice_name,
        domainName: row.domain_name,
        text,
      });
    }
    domainMap.set(row.domain_id, domain);
  }

  for (const row of blockerRows) {
    for (const domain of domainMap.values()) {
      if (domain.domainName === row.domain_name) domain.blockerNames.push(row.blocker_name);
    }
  }

  const domains = [...domainMap.values()];
  const succeeding = domains
    .map((domain) => buildSuccessInsight(domain))
    .filter((item): item is QualitativeTrendSummary['succeeding'][number] => item != null)
    .slice(0, 4);
  const needsAttention = domains
    .map((domain) => buildAttentionInsight(domain))
    .filter((item): item is QualitativeTrendSummary['needsAttention'][number] => item != null)
    .slice(0, 4);

  return {
    rangeLabel: `${startDate} through ${today}`,
    succeeding,
    needsAttention,
    recentNotes: [...notesByKey.values()].slice(0, 10),
    blockerPatterns: buildBlockerPatterns(blockerRows),
  };
}

function groupPractices(rows: MetricRow[]) {
  const map = new Map<string, {
    practiceId: string;
    practiceName: string;
    domainId: string;
    domainName: string;
    metrics: Array<{ id: string; name: string; type: MetricType; sortOrder: number }>;
  }>();
  for (const row of rows) {
    const practice = map.get(row.practice_id) ?? {
      practiceId: row.practice_id,
      practiceName: row.practice_name,
      domainId: row.domain_id,
      domainName: row.domain_name,
      metrics: [],
    };
    if (row.metric_id && row.metric_name && row.metric_type) {
      practice.metrics.push({
        id: row.metric_id,
        name: row.metric_name,
        type: row.metric_type,
        sortOrder: row.sort_order ?? 0,
      });
    }
    map.set(row.practice_id, practice);
  }
  return [...map.values()];
}

async function getPracticeScores(startDate: string, endDate?: string): Promise<ScoreValue[]> {
  const db = await getDb();
  const dateFilters = ['de.entry_date >= ?'];
  const params: string[] = [startDate];
  if (endDate) {
    dateFilters.push('de.entry_date <= ?');
    params.push(endDate);
  }
  const rows = await db.getAllAsync<{
    practice_id: string;
    practice_name: string;
    domain_id: string;
    domain_name: string;
    metric_type: MetricType | null;
    value_boolean: number | null;
    value_number: number | null;
    status: string | null;
  }>(
    `SELECT
      p.id as practice_id,
      p.name as practice_name,
      d.id as domain_id,
      d.name as domain_name,
      m.metric_type,
      emv.value_boolean,
      emv.value_number,
      de.status
     FROM daily_entries de
     JOIN practices p ON p.id = de.practice_id
     JOIN domains d ON d.id = p.domain_id
     LEFT JOIN metrics m ON m.practice_id = p.id AND m.active = 1
     LEFT JOIN entry_metric_values emv ON emv.entry_id = de.id AND emv.metric_id = m.id
     WHERE ${dateFilters.join(' AND ')}
      AND p.active = 1
      AND d.active = 1
      AND EXISTS (
        SELECT 1
        FROM routine_practices rp
        WHERE rp.practice_id = p.id
         AND rp.archived_from IS NULL
      )`,
    ...params,
  );

  const byPractice = new Map<string, {
    practiceId: string;
    practiceName: string;
    domainId: string;
    domainName: string;
    qualityValues: number[];
    booleanValues: number[];
    statusValues: number[];
  }>();

  for (const row of rows) {
    const item = byPractice.get(row.practice_id) ?? {
      practiceId: row.practice_id,
      practiceName: row.practice_name,
      domainId: row.domain_id,
      domainName: row.domain_name,
      qualityValues: [],
      booleanValues: [],
      statusValues: [],
    };
    if (row.metric_type === 'scale' && row.value_number != null) item.qualityValues.push(row.value_number);
    if (row.metric_type === 'boolean' && row.value_boolean != null) item.booleanValues.push(row.value_boolean);
    if (row.status === 'done' || row.status === 'missed' || row.status === 'partial') {
      item.statusValues.push(row.status === 'done' ? 1 : row.status === 'partial' ? 0.5 : 0);
    }
    byPractice.set(row.practice_id, item);
  }

  return [...byPractice.values()]
    .map((item) => {
      const qualityScore = average(item.qualityValues);
      const completionSource = item.booleanValues.length ? item.booleanValues : item.statusValues;
      const completionScore = completionSource.length ? scaleCompletion(average(completionSource) ?? 0) : null;
      const blended = average([qualityScore, completionScore].filter((value): value is number => value != null));
      if (blended == null) return null;
      return {
        practiceId: item.practiceId,
        practiceName: item.practiceName,
        domainId: item.domainId,
        domainName: item.domainName,
        value: blended,
      };
    })
    .filter((item): item is ScoreValue => item != null);
}

function buildDomainInsights(scores7: ScoreValue[], scores30: ScoreValue[]): TrendSummary['domainInsights'] {
  const domainIds = [...new Set([...scores7, ...scores30].map((score) => score.domainId))];
  return domainIds.map((domainId) => {
    const sevenScores = scores7.filter((score) => score.domainId === domainId);
    const thirtyScores = scores30.filter((score) => score.domainId === domainId);
    const score7 = round1(average(sevenScores.map((score) => score.value)));
    const score30 = round1(average(thirtyScores.map((score) => score.value)));
    return {
      domainId,
      domainName: sevenScores[0]?.domainName ?? thirtyScores[0]?.domainName ?? 'Domain',
      score7,
      score30,
      trackedPractices: new Set([...sevenScores, ...thirtyScores].map((score) => score.practiceId)).size,
      direction: direction(score7, score30),
    };
  });
}

async function buildPracticeTrend(practice: ReturnType<typeof groupPractices>[number], weekWindow: WeekWindow): Promise<TrendSummary['practiceTrends'][number] | null> {
  const textMetric = practice.metrics.find((metric) => metric.type === 'text');
  const numberMetric = practice.metrics.find((metric) => metric.type === 'number');
  const scaleMetric = practice.metrics.find((metric) => metric.type === 'scale');
  const booleanMetric = practice.metrics.find((metric) => metric.type === 'boolean');
  const metric = textMetric ?? numberMetric ?? scaleMetric ?? booleanMetric;
  if (!metric) return null;

  if (metric.type === 'text') {
    const recentEntries = await getTextValues(practice.practiceId, metric.id);
    if (!recentEntries.length) return null;
    const emptyWindow = emptyTrendWindow();
    return {
      practiceId: practice.practiceId,
      practiceName: practice.practiceName,
      domainId: practice.domainId,
      domainName: practice.domainName,
      metricName: metric.name,
      metricKind: 'text',
      unitLabel: 'recent entries',
      week: emptyWindow,
      month: emptyWindow,
      allTime: emptyWindow,
      recentEntries,
    };
  }

  if (metric.type === 'boolean') {
    const values = await getBooleanValues(practice.practiceId, metric.id);
    if (!values.length) return null;
    return {
      practiceId: practice.practiceId,
      practiceName: practice.practiceName,
      domainId: practice.domainId,
      domainName: practice.domainName,
      metricName: metric.name,
      metricKind: 'complete',
      unitLabel: '%',
      week: buildWindow(values, 'week', true, weekWindow),
      month: buildWindow(values, 'month', true),
      allTime: buildWindow(values, 'allTime', true),
      recentEntries: [],
    };
  }

  const values = await getNumericValues(metric.id);
  if (!values.length) return null;
  return {
    practiceId: practice.practiceId,
    practiceName: practice.practiceName,
    domainId: practice.domainId,
    domainName: practice.domainName,
    metricName: metric.name,
    metricKind: metric.type === 'number' ? 'number' : 'quality',
    unitLabel: metric.type === 'number' ? 'avg' : '1-5',
    week: buildWindow(values, 'week', false, weekWindow),
    month: buildWindow(values, 'month', false),
    allTime: buildWindow(values, 'allTime', false),
    recentEntries: [],
  };
}

async function getNumericValues(metricId: string): Promise<NumericValue[]> {
  const db = await getDb();
  return db.getAllAsync<NumericValue>(
    `SELECT de.entry_date as date, emv.value_number as value
     FROM entry_metric_values emv
     JOIN daily_entries de ON de.id = emv.entry_id
     JOIN practices p ON p.id = de.practice_id
     WHERE emv.metric_id = ?
      AND emv.value_number IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM routine_practices rp
        WHERE rp.practice_id = p.id
         AND rp.archived_from IS NULL
      )
     ORDER BY de.entry_date`,
    metricId,
  );
}

async function getBooleanValues(practiceId: string, metricId: string): Promise<NumericValue[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ date: string; value_boolean: number | null; status: string | null }>(
    `SELECT de.entry_date as date, emv.value_boolean, de.status
     FROM daily_entries de
     JOIN practices p ON p.id = de.practice_id
     LEFT JOIN entry_metric_values emv ON emv.entry_id = de.id AND emv.metric_id = ?
     WHERE de.practice_id = ?
      AND EXISTS (
        SELECT 1
        FROM routine_practices rp
        WHERE rp.practice_id = p.id
         AND rp.archived_from IS NULL
      )
     ORDER BY de.entry_date`,
    metricId,
    practiceId,
  );
  return rows
    .map((row) => {
      if (row.value_boolean != null) return { date: row.date, value: row.value_boolean ? 1 : 0 };
      if (row.status === 'done') return { date: row.date, value: 1 };
      if (row.status === 'partial') return { date: row.date, value: 0.5 };
      if (row.status === 'missed') return { date: row.date, value: 0 };
      return null;
    })
    .filter((row): row is NumericValue => row != null);
}

async function getTextValues(practiceId: string, metricId: string): Promise<TextValue[]> {
  const db = await getDb();
  return db.getAllAsync<TextValue>(
    `SELECT de.entry_date as date,
      COALESCE(NULLIF(TRIM(emv.value_text), ''), NULLIF(TRIM(de.note), '')) as text
     FROM daily_entries de
     JOIN practices p ON p.id = de.practice_id
     LEFT JOIN entry_metric_values emv ON emv.entry_id = de.id AND emv.metric_id = ?
     WHERE de.practice_id = ?
      AND COALESCE(NULLIF(TRIM(emv.value_text), ''), NULLIF(TRIM(de.note), '')) IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM routine_practices rp
        WHERE rp.practice_id = p.id
         AND rp.archived_from IS NULL
      )
     ORDER BY de.entry_date DESC
     LIMIT 8`,
    metricId,
    practiceId,
  );
}

function buildWindow(values: NumericValue[], mode: 'week' | 'month' | 'allTime', percent: boolean, weekWindow?: WeekWindow): TrendWindow {
  const today = todayIsoDate();
  const end = mode === 'week' ? weekWindow?.end ?? today : today;
  const start = mode === 'week' ? weekWindow?.start ?? today : mode === 'month' ? addDaysIso(today, -29) : null;
  const inRange = start ? values.filter((value) => value.date >= start && value.date <= end) : values;
  const normalized = percent ? inRange.map((value) => value.value * 100) : inRange.map((value) => value.value);
  return {
    average: round1(average(normalized)),
    sampleSize: inRange.length,
    points: mode === 'week'
      ? buildDailyPoints(values, start ?? end, end, percent)
      : mode === 'month'
        ? buildRollingWeekPoints(values, today, percent)
        : buildMonthPoints(values, percent),
  };
}

function buildDailyPoints(values: NumericValue[], startDate: string, endDate: string, percent: boolean) {
  return Array.from({ length: daysBetweenInclusive(startDate, endDate) }, (_, index) => {
    const date = addDaysIso(startDate, index);
    const matching = values.filter((value) => value.date === date).map((value) => percent ? value.value * 100 : value.value);
    return { label: shortDayName(date), value: round1(average(matching)) };
  });
}

function getWeekWindow(mode: TrendWeekMode): WeekWindow {
  const today = todayIsoDate();
  if (mode === 'rolling_7_days') {
    return {
      mode,
      label: 'Past 7 days',
      start: addDaysIso(today, -7),
      end: addDaysIso(today, -1),
    };
  }
  return {
    mode: 'sunday_to_date',
    label: 'This week',
    start: addDaysIso(today, -dayOfWeek(today)),
    end: today,
  };
}

function daysBetweenInclusive(startDate: string, endDate: string) {
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  const start = new Date(startYear, startMonth - 1, startDay);
  const end = new Date(endYear, endMonth - 1, endDay);
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);
}

function buildRollingWeekPoints(values: NumericValue[], today: string, percent: boolean) {
  return Array.from({ length: 4 }, (_, index) => {
    const end = addDaysIso(today, -(3 - index) * 7);
    const start = addDaysIso(end, -6);
    const matching = values
      .filter((value) => value.date >= start && value.date <= end)
      .map((value) => percent ? value.value * 100 : value.value);
    return { label: `W${index + 1}`, value: round1(average(matching)) };
  });
}

function buildMonthPoints(values: NumericValue[], percent: boolean) {
  const monthKeys = [...new Set(values.map((value) => value.date.slice(0, 7)))].slice(-6);
  return monthKeys.map((key) => {
    const matching = values
      .filter((value) => value.date.startsWith(key))
      .map((value) => percent ? value.value * 100 : value.value);
    return { label: key.slice(5), value: round1(average(matching)) };
  });
}

function emptyTrendWindow(): TrendWindow {
  return { average: null, sampleSize: 0, points: [] };
}

function buildSuccessInsight(domain: {
  domainId: string;
  domainName: string;
  practiceNames: Set<string>;
  qualityValues: number[];
  booleanValues: number[];
  statusValues: number[];
  noteCount: number;
}) {
  const quality = average(domain.qualityValues);
  const completion = average(domain.booleanValues.length ? domain.booleanValues : domain.statusValues);
  const practices = [...domain.practiceNames].slice(0, 3);
  if (quality != null && quality >= 4) {
    return {
      domainId: domain.domainId,
      domainName: domain.domainName,
      message: 'This area has had a steady feel recently. The quality entries suggest real consistency, not just motion.',
      practices,
    };
  }
  if (completion != null && completion >= 0.75) {
    return {
      domainId: domain.domainId,
      domainName: domain.domainName,
      message: 'There has been reliable follow-through here. This may be an area where the current structure is supporting you well.',
      practices,
    };
  }
  if (domain.noteCount >= 3) {
    return {
      domainId: domain.domainId,
      domainName: domain.domainName,
      message: 'You have been paying attention here in writing. That kind of noticing is itself a meaningful strength.',
      practices,
    };
  }
  return null;
}

function buildAttentionInsight(domain: {
  domainId: string;
  domainName: string;
  practiceNames: Set<string>;
  qualityValues: number[];
  booleanValues: number[];
  statusValues: number[];
  blockerNames: string[];
}) {
  const quality = average(domain.qualityValues);
  const completion = average(domain.booleanValues.length ? domain.booleanValues : domain.statusValues);
  const blockers = mostCommon(domain.blockerNames, 3);
  const practices = [...domain.practiceNames].slice(0, 3);
  if (blockers.length >= 2) {
    return {
      domainId: domain.domainId,
      domainName: domain.domainName,
      message: 'A few blockers are repeating here. This may be worth approaching gently, by changing the setup around the practice rather than pushing harder.',
      practices,
      blockers,
    };
  }
  if (quality != null && quality <= 3 && domain.qualityValues.length >= 3) {
    return {
      domainId: domain.domainId,
      domainName: domain.domainName,
      message: 'The recent quality entries suggest this area may need more care or a smaller next step.',
      practices,
      blockers,
    };
  }
  if (completion != null && completion <= 0.5 && (domain.booleanValues.length + domain.statusValues.length) >= 3) {
    return {
      domainId: domain.domainId,
      domainName: domain.domainName,
      message: 'Follow-through has been uneven here. It may help to make the practice easier to begin or more clearly tied to a routine.',
      practices,
      blockers,
    };
  }
  return null;
}

function buildBlockerPatterns(rows: QualitativeBlockerRow[]): QualitativeTrendSummary['blockerPatterns'] {
  const byBlocker = new Map<string, { blockerName: string; domainNames: string[]; practiceNames: string[] }>();
  for (const row of rows) {
    const item = byBlocker.get(row.blocker_name) ?? {
      blockerName: row.blocker_name,
      domainNames: [],
      practiceNames: [],
    };
    item.domainNames.push(row.domain_name);
    item.practiceNames.push(row.practice_name);
    byBlocker.set(row.blocker_name, item);
  }
  return [...byBlocker.values()]
    .sort((a, b) => b.practiceNames.length - a.practiceNames.length || a.blockerName.localeCompare(b.blockerName))
    .slice(0, 5)
    .map((item) => ({
      blockerName: item.blockerName,
      domainNames: mostCommon(item.domainNames, 3),
      practiceNames: mostCommon(item.practiceNames, 3),
    }));
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function mostCommon(values: string[], limit: number) {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value]) => value);
}

function scaleCompletion(rate: number) {
  return 1 + rate * 4;
}

function average(values: Array<number | null | undefined>) {
  const clean = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!clean.length) return null;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function round1(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
}

function direction(score7: number | null, score30: number | null): 'up' | 'down' | 'steady' | 'insufficient' {
  if (score7 == null || score30 == null) return 'insufficient';
  if (Math.abs(score7 - score30) < 0.25) return 'steady';
  return score7 > score30 ? 'up' : 'down';
}
