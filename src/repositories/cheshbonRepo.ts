import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { LOCAL_USER_ID } from '@/src/constants/seedData';
import { ensureReflectionDefaults, ensureRoshChodeshRoutine, getDb } from '@/src/db/client';
import { normalizeQualityScale } from '@/src/db/qualityScale';
import { normalizeReviewCompletionState } from '@/src/db/reviewCompletion';
import type {
  Blocker,
  EntryDraft,
  Metric,
  MetricOption,
  MetricValueDraft,
  NightlyReviewDraft,
  RoutineTemplate,
} from '@/src/models/types';
import { addDaysIso, dayOfWeek, todayIsoDate } from '@/src/utils/dates';
import { makeId } from '@/src/utils/ids';

type BlockerRow = { id: string; name: string; description: string | null; active: number };
type MetricRow = {
  id: string;
  practice_id: string;
  name: string;
  metric_type: Metric['metricType'];
  scale_min: number | null;
  scale_max: number | null;
  required: number;
  help_text: string | null;
  sort_order: number;
};
type MetricOptionRow = { id: string; metric_id: string; label: string; value: string; sort_order: number };

export type ReminderPreferences = {
  taskRemindersEnabled: boolean;
  morningReminderEnabled: boolean;
  morningReminderTime: string;
};

export type OnboardingStatus = {
  completed: boolean;
  hasReviewData: boolean;
  needsOnboarding: boolean;
};

export type OnboardingPracticeOption = {
  routinePracticeId: string;
  practiceName: string;
  routineName: string;
  reviewSectionName: string;
  domainName: string;
  enabled: boolean;
};

const defaultReminderPreferences: ReminderPreferences = {
  taskRemindersEnabled: false,
  morningReminderEnabled: true,
  morningReminderTime: '05:30',
};

export type HomeSummary = {
  reviewStarted: boolean;
  reviewComplete: boolean;
  streak: number;
  reviewedPractices: number;
  currentAvodah: Array<{ practiceId: string; practiceName: string; date: string; text: string }>;
  morningReminder: {
    dailyAvodah: string | null;
    markedPractices: string[];
  };
  recentGratitude: Array<{ date: string; text: string }>;
  thoughtJournal: Array<{ date: string; practiceName: string; text: string }>;
};

export type JournalKind = 'gratitude' | 'thoughts';
export type JournalEntry = { date: string; practiceName: string; text: string };

const homeFunctionPracticeIds = new Set([
  'practice_gratitude',
  'practice_daily_thoughts',
  'practice_daily_avodah',
  'practice_weekly_avodah',
]);

function isHomeFunctionPractice(practice: { id?: string | null; name?: string | null; domainId?: string | null; domain_id?: string | null }) {
  const name = practice.name?.toLowerCase() ?? '';
  const domainId = practice.domainId ?? practice.domain_id;
  return (
    homeFunctionPracticeIds.has(practice.id ?? '') ||
    domainId === 'domain_current_avodah' ||
    name === 'gratitude' ||
    name.includes('thought') ||
    name.includes('reflection')
  );
}

export async function getReminderPreferences(): Promise<ReminderPreferences> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value
     FROM app_preferences
     WHERE key IN ('task_reminders_enabled', 'morning_reminder_enabled', 'morning_reminder_time')`,
  );
  const values = new Map(rows.map((row) => [row.key, row.value]));
  return {
    taskRemindersEnabled: parseBooleanPreference(values.get('task_reminders_enabled'), defaultReminderPreferences.taskRemindersEnabled),
    morningReminderEnabled: parseBooleanPreference(values.get('morning_reminder_enabled'), defaultReminderPreferences.morningReminderEnabled),
    morningReminderTime: normalizeReminderTime(values.get('morning_reminder_time') ?? defaultReminderPreferences.morningReminderTime),
  };
}

export async function updateReminderPreferences(input: Partial<ReminderPreferences>) {
  const db = await getDb();
  const current = await getReminderPreferences();
  const next: ReminderPreferences = {
    taskRemindersEnabled: input.taskRemindersEnabled ?? current.taskRemindersEnabled,
    morningReminderEnabled: input.morningReminderEnabled ?? current.morningReminderEnabled,
    morningReminderTime: normalizeReminderTime(input.morningReminderTime ?? current.morningReminderTime),
  };
  await db.withTransactionAsync(async () => {
    await setPreference(db, 'task_reminders_enabled', next.taskRemindersEnabled ? '1' : '0');
    await setPreference(db, 'morning_reminder_enabled', next.morningReminderEnabled ? '1' : '0');
    await setPreference(db, 'morning_reminder_time', next.morningReminderTime);
    if (!next.taskRemindersEnabled) {
      await db.runAsync('UPDATE daily_entries SET remind_tomorrow = 0, updated_at = CURRENT_TIMESTAMP WHERE remind_tomorrow = 1');
    }
  });
  return next;
}

async function setPreference(db: Awaited<ReturnType<typeof getDb>>, key: string, value: string) {
  await db.runAsync(
    `INSERT INTO app_preferences (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = CURRENT_TIMESTAMP`,
    key,
    value,
  );
}

function parseBooleanPreference(value: string | undefined, fallback: boolean) {
  if (value == null) return fallback;
  return value === '1' || value.toLowerCase() === 'true';
}

function normalizeReminderTime(value: string) {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return defaultReminderPreferences.morningReminderTime;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

export async function getOnboardingStatus(): Promise<OnboardingStatus> {
  const db = await getDb();
  const [preference, reviewData] = await Promise.all([
    db.getFirstAsync<{ value: string }>("SELECT value FROM app_preferences WHERE key = 'onboarding_completed'"),
    db.getFirstAsync<{ count: number }>(
      `SELECT
        (SELECT COUNT(*) FROM daily_entries WHERE user_id = ?) +
        (SELECT COUNT(*) FROM daily_review_sessions WHERE user_id = ?) as count`,
      LOCAL_USER_ID,
      LOCAL_USER_ID,
    ),
  ]);
  const completed = parseBooleanPreference(preference?.value, false);
  const hasReviewData = (reviewData?.count ?? 0) > 0;
  return {
    completed: completed || hasReviewData,
    hasReviewData,
    needsOnboarding: !completed && !hasReviewData,
  };
}

export async function getOnboardingPracticeOptions(): Promise<OnboardingPracticeOption[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    routinePracticeId: string;
    practiceName: string;
    routineName: string;
    reviewSectionName: string;
    domainName: string;
    enabled: number;
    routinePriority: number;
    sectionSortOrder: number;
    sortOrder: number;
  }>(
    `SELECT
      rp.id as routinePracticeId,
      p.name as practiceName,
      rt.name as routineName,
      rs.name as reviewSectionName,
      d.name as domainName,
      rp.enabled,
      rt.priority as routinePriority,
      rs.sort_order as sectionSortOrder,
      rp.sort_order as sortOrder
     FROM routine_practices rp
     JOIN practices p ON p.id = rp.practice_id
     JOIN routine_templates rt ON rt.id = rp.routine_template_id
     JOIN review_sections rs ON rs.id = rp.review_section_id
     JOIN domains d ON d.id = p.domain_id
     WHERE rp.archived_from IS NULL
      AND p.active = 1
      AND rt.id IN ('routine_core', 'routine_shabbos', 'routine_rosh_chodesh')
     ORDER BY rt.priority, rs.sort_order, rp.sort_order, p.name`,
  );
  return rows.map((row) => ({
    routinePracticeId: row.routinePracticeId,
    practiceName: row.practiceName,
    routineName: row.routineName,
    reviewSectionName: row.reviewSectionName,
    domainName: row.domainName,
    enabled: row.enabled === 1,
  }));
}

export async function completeOnboarding(selectedRoutinePracticeIds: string[]) {
  const db = await getDb();
  const starterRows = await getOnboardingPracticeOptions();
  const starterIds = starterRows.map((row) => row.routinePracticeId);
  const selectedIds = new Set(selectedRoutinePracticeIds);
  await db.withTransactionAsync(async () => {
    for (const routinePracticeId of starterIds) {
      await db.runAsync(
        'UPDATE routine_practices SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        selectedIds.has(routinePracticeId) ? 1 : 0,
        routinePracticeId,
      );
    }
    await setPreference(db, 'onboarding_completed', '1');
    await setPreference(db, 'onboarding_completed_at', new Date().toISOString());
  });
}

export async function getHomeSummary(reviewDate = todayIsoDate()): Promise<HomeSummary> {
  const db = await getDb();
  const sevenDaysAgo = addDaysIso(reviewDate, -6);

  const session = await db.getFirstAsync<{ id: string; note: string | null; pattern_noticed: string | null; completed_at: string | null }>(
    'SELECT id, note, pattern_noticed, completed_at FROM daily_review_sessions WHERE user_id = ? AND review_date = ?',
    LOCAL_USER_ID,
    reviewDate,
  );
  const reviewed = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM daily_entries WHERE user_id = ?',
    LOCAL_USER_ID,
  );
  const recentGratitude = await getJournalEntries('gratitude', { startDate: sevenDaysAgo, endDate: reviewDate, limit: 5 });
  const thoughtJournal = await getJournalEntries('thoughts', { startDate: sevenDaysAgo, endDate: reviewDate, limit: 5 });

  return {
    reviewStarted: Boolean(session),
    reviewComplete: Boolean(session?.completed_at),
    streak: await getCurrentReviewStreak(),
    reviewedPractices: reviewed?.count ?? 0,
    currentAvodah: await getCurrentAvodahSummary(db, reviewDate),
    morningReminder: await getMorningReminderSummary(db, reviewDate),
    recentGratitude: recentGratitude.map((entry) => ({ date: entry.date, text: entry.text })),
    thoughtJournal,
  };
}

export async function getJournalEntries(
  kind: JournalKind,
  options: { startDate?: string; endDate?: string; date?: string; limit?: number } = {},
): Promise<JournalEntry[]> {
  const db = await getDb();
  const filters: string[] = ['de.user_id = ?'];
  const args: Array<string | number> = [LOCAL_USER_ID];

  if (options.date) {
    filters.push('de.entry_date = ?');
    args.push(options.date);
  } else {
    if (options.startDate) {
      filters.push('de.entry_date >= ?');
      args.push(options.startDate);
    }
    if (options.endDate) {
      filters.push('de.entry_date <= ?');
      args.push(options.endDate);
    }
  }

  if (kind === 'gratitude') {
    filters.push("(p.id = 'practice_gratitude' OR LOWER(p.name) = 'gratitude')");
  } else {
    filters.push(
      "(p.id = 'practice_daily_thoughts' OR LOWER(p.name) LIKE '%thought%' OR LOWER(p.name) LIKE '%reflection%')",
    );
  }
  filters.push("COALESCE(NULLIF(TRIM(emv.value_text), ''), NULLIF(TRIM(de.note), '')) IS NOT NULL");
  const limit = Math.max(1, Math.min(options.limit ?? 200, 500));

  const rows = await db.getAllAsync<{ entry_date: string; practice_name: string; entry_text: string }>(
    `SELECT de.entry_date,
      p.name as practice_name,
      COALESCE(NULLIF(TRIM(emv.value_text), ''), NULLIF(TRIM(de.note), '')) as entry_text
     FROM daily_entries de
     JOIN practices p ON p.id = de.practice_id
     LEFT JOIN metrics m ON m.practice_id = p.id
      AND m.metric_type = 'text'
      AND m.active = 1
     LEFT JOIN entry_metric_values emv ON emv.entry_id = de.id
      AND emv.metric_id = m.id
     WHERE ${filters.join(' AND ')}
     ORDER BY de.entry_date DESC
     LIMIT ?`,
    ...args,
    limit,
  );

  return rows.map((row) => ({ date: row.entry_date, practiceName: row.practice_name, text: row.entry_text }));
}

async function getMorningReminderSummary(db: Awaited<ReturnType<typeof getDb>>, reviewDate: string) {
  const yesterday = addDaysIso(reviewDate, -1);
  const dailyAvodah = await db.getFirstAsync<{ text: string | null }>(
    `SELECT COALESCE(NULLIF(TRIM(emv.value_text), ''), NULLIF(TRIM(de.note), '')) as text
     FROM daily_entries de
     LEFT JOIN metrics m ON m.practice_id = de.practice_id
      AND m.metric_type = 'text'
      AND m.active = 1
     LEFT JOIN entry_metric_values emv ON emv.entry_id = de.id
      AND emv.metric_id = m.id
     WHERE de.user_id = ?
      AND de.practice_id = 'practice_daily_avodah'
      AND de.entry_date = ?
      AND COALESCE(NULLIF(TRIM(emv.value_text), ''), NULLIF(TRIM(de.note), '')) IS NOT NULL
     LIMIT 1`,
    LOCAL_USER_ID,
    yesterday,
  );
  const markedPractices = await db.getAllAsync<{ name: string }>(
    `SELECT DISTINCT p.name
     FROM daily_entries de
     JOIN practices p ON p.id = de.practice_id
     WHERE de.user_id = ?
      AND de.entry_date = ?
      AND de.remind_tomorrow = 1
      AND p.active = 1
     ORDER BY p.name`,
    LOCAL_USER_ID,
    yesterday,
  );
  return {
    dailyAvodah: dailyAvodah?.text?.trim() || null,
    markedPractices: markedPractices.map((practice) => practice.name),
  };
}

async function getCurrentAvodahSummary(db: Awaited<ReturnType<typeof getDb>>, reviewDate: string) {
  const yesterday = addDaysIso(reviewDate, -1);
  const lastShabbos = lastShabbosOnOrBefore(reviewDate);
  const practices = await db.getAllAsync<{ id: string; name: string }>(
    `SELECT p.id, p.name
     FROM practices p
     JOIN domains d ON d.id = p.domain_id
     WHERE p.active = 1
      AND d.active = 1
      AND d.id = 'domain_current_avodah'
     ORDER BY p.name`,
  );
  const rows: Array<{ practiceId: string; practiceName: string; date: string; text: string }> = [];
  for (const practice of practices) {
    const lowerName = practice.name.toLowerCase();
    const targetDate = lowerName.includes('week') || lowerName.includes('shabbos') ? lastShabbos : yesterday;
    const value = await db.getFirstAsync<{ text: string | null }>(
      `SELECT COALESCE(NULLIF(TRIM(emv.value_text), ''), NULLIF(TRIM(de.note), '')) as text
       FROM daily_entries de
       LEFT JOIN metrics m ON m.practice_id = de.practice_id
        AND m.metric_type = 'text'
        AND m.active = 1
       LEFT JOIN entry_metric_values emv ON emv.entry_id = de.id
        AND emv.metric_id = m.id
       WHERE de.user_id = ?
        AND de.practice_id = ?
        AND de.entry_date = ?
        AND COALESCE(NULLIF(TRIM(emv.value_text), ''), NULLIF(TRIM(de.note), '')) IS NOT NULL
       LIMIT 1`,
      LOCAL_USER_ID,
      practice.id,
      targetDate,
    );
    if (value?.text?.trim()) {
      rows.push({ practiceId: practice.id, practiceName: practice.name, date: targetDate, text: value.text.trim() });
    }
  }
  return rows;
}

function lastShabbosOnOrBefore(date: string) {
  const delta = (dayOfWeek(date) - 6 + 7) % 7;
  return addDaysIso(date, -delta);
}

export async function getActiveBlockers(): Promise<Blocker[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<BlockerRow>(
    'SELECT id, name, description, active FROM blockers WHERE active = 1 ORDER BY name',
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    active: row.active === 1,
  }));
}

export async function getMetricsForPracticeIds(practiceIds: string[]) {
  if (practiceIds.length === 0) {
    return new Map<string, Metric[]>();
  }
  const db = await getDb();
  const placeholders = practiceIds.map(() => '?').join(',');
  const metricRows = await db.getAllAsync<MetricRow>(
    `SELECT * FROM metrics WHERE active = 1 AND practice_id IN (${placeholders}) ORDER BY sort_order`,
    practiceIds,
  );
  const metricIds = metricRows.map((row) => row.id);
  const options = metricIds.length
    ? await db.getAllAsync<MetricOptionRow>(
        `SELECT * FROM metric_options WHERE active = 1 AND metric_id IN (${metricIds.map(() => '?').join(',')}) ORDER BY sort_order`,
        metricIds,
      )
    : [];
  const optionsByMetric = new Map<string, MetricOption[]>();
  for (const option of options) {
    const list = optionsByMetric.get(option.metric_id) ?? [];
    list.push({
      id: option.id,
      metricId: option.metric_id,
      label: option.label,
      value: option.value,
      sortOrder: option.sort_order,
    });
    optionsByMetric.set(option.metric_id, list);
  }
  const byPractice = new Map<string, Metric[]>();
  for (const row of metricRows) {
    const list = byPractice.get(row.practice_id) ?? [];
    list.push({
      id: row.id,
      practiceId: row.practice_id,
      name: row.name,
      metricType: row.metric_type,
      scaleMin: row.scale_min,
      scaleMax: row.scale_max,
      required: row.required === 1,
      helpText: row.help_text,
      sortOrder: row.sort_order,
      options: optionsByMetric.get(row.id) ?? [],
    });
    byPractice.set(row.practice_id, list);
  }
  return byPractice;
}

export async function getReviewDraft(reviewDate: string): Promise<NightlyReviewDraft> {
  const db = await getDb();
  const session = await db.getFirstAsync<{
    general_day_rating: number | null;
    bed_time: string | null;
    wake_time: string | null;
    main_win: string | null;
    main_struggle: string | null;
    pattern_noticed: string | null;
    adjustment_for_tomorrow: string | null;
    note: string | null;
    completed_at: string | null;
  }>('SELECT * FROM daily_review_sessions WHERE user_id = ? AND review_date = ?', LOCAL_USER_ID, reviewDate);

  const entries = await db.getAllAsync<{
    id: string;
    practice_id: string;
    status: string | null;
    note: string | null;
    remind_tomorrow: number | null;
  }>('SELECT * FROM daily_entries WHERE user_id = ? AND entry_date = ?', LOCAL_USER_ID, reviewDate);
  const entryIds = entries.map((entry) => entry.id);
  const metricRows = entryIds.length
    ? await db.getAllAsync<{
        entry_id: string;
        metric_id: string;
        value_boolean: number | null;
        value_number: number | null;
        value_text: string | null;
        value_json: string | null;
      }>(
        `SELECT * FROM entry_metric_values WHERE entry_id IN (${entryIds.map(() => '?').join(',')})`,
        entryIds,
      )
    : [];
  const blockerRows = entryIds.length
    ? await db.getAllAsync<{ entry_id: string; blocker_id: string }>(
        `SELECT * FROM entry_blockers WHERE entry_id IN (${entryIds.map(() => '?').join(',')})`,
        entryIds,
      )
    : [];

  const byEntry = new Map(entries.map((entry) => [entry.id, entry]));
  const draftEntries: Record<string, EntryDraft> = {};
  for (const entry of entries) {
    draftEntries[entry.practice_id] = {
      practiceId: entry.practice_id,
      status: entry.status as EntryDraft['status'],
      note: entry.note,
      remindTomorrow: entry.remind_tomorrow === 1,
      metricValues: {},
      blockerIds: [],
    };
  }
  for (const metric of metricRows) {
    const entry = byEntry.get(metric.entry_id);
    if (!entry) continue;
    draftEntries[entry.practice_id].metricValues[metric.metric_id] = {
      metricId: metric.metric_id,
      valueBoolean: metric.value_boolean == null ? null : metric.value_boolean === 1,
      valueNumber: metric.value_number,
      valueText: metric.value_text,
      valueJson: metric.value_json,
    };
  }
  for (const blocker of blockerRows) {
    const entry = byEntry.get(blocker.entry_id);
    if (!entry) continue;
    draftEntries[entry.practice_id].blockerIds.push(blocker.blocker_id);
  }

  return {
    session: {
      generalDayRating: session?.general_day_rating,
      bedTime: session?.bed_time,
      wakeTime: session?.wake_time,
      mainWin: session?.main_win,
      mainStruggle: session?.main_struggle,
      patternNoticed: session?.pattern_noticed,
      adjustmentForTomorrow: session?.adjustment_for_tomorrow,
      note: session?.note,
      completedAt: session?.completed_at,
    },
    entries: draftEntries,
  };
}

export async function saveNightlyReview(reviewDate: string, draft: NightlyReviewDraft, options: { complete?: boolean } = {}) {
  const db = await getDb();
  const complete = options.complete === true;
  await db.withTransactionAsync(async () => {
    const sessionId = makeId('session');
    await db.runAsync(
      `INSERT INTO daily_review_sessions
        (id, user_id, review_date, general_day_rating, bed_time, wake_time, main_win, main_struggle, pattern_noticed, adjustment_for_tomorrow, note, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END)
       ON CONFLICT(user_id, review_date) DO UPDATE SET
        general_day_rating = excluded.general_day_rating,
        bed_time = excluded.bed_time,
        wake_time = excluded.wake_time,
        main_win = excluded.main_win,
        main_struggle = excluded.main_struggle,
        pattern_noticed = excluded.pattern_noticed,
        adjustment_for_tomorrow = excluded.adjustment_for_tomorrow,
        note = excluded.note,
        completed_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE completed_at END,
        updated_at = CURRENT_TIMESTAMP`,
      sessionId,
      LOCAL_USER_ID,
      reviewDate,
      draft.session.generalDayRating ?? null,
      draft.session.bedTime ?? null,
      draft.session.wakeTime ?? null,
      draft.session.mainWin ?? null,
      draft.session.mainStruggle ?? null,
      draft.session.patternNoticed ?? null,
      draft.session.adjustmentForTomorrow ?? null,
      draft.session.note ?? null,
      complete ? 1 : 0,
      complete ? 1 : 0,
    );
    const persistedSession = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM daily_review_sessions WHERE user_id = ? AND review_date = ?',
      LOCAL_USER_ID,
      reviewDate,
    );
    const actualSessionId = persistedSession?.id ?? sessionId;

    for (const entry of Object.values(draft.entries)) {
      const entryId = makeId('entry');
      await db.runAsync(
        `INSERT INTO daily_entries (id, user_id, review_session_id, practice_id, entry_date, status, note, remind_tomorrow)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, practice_id, entry_date) DO UPDATE SET
          review_session_id = excluded.review_session_id,
          status = excluded.status,
          note = excluded.note,
          remind_tomorrow = excluded.remind_tomorrow,
          updated_at = CURRENT_TIMESTAMP`,
        entryId,
        LOCAL_USER_ID,
        actualSessionId,
        entry.practiceId,
        reviewDate,
        entry.status ?? null,
        entry.note ?? null,
        entry.remindTomorrow ? 1 : 0,
      );
      const persistedEntry = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM daily_entries WHERE user_id = ? AND practice_id = ? AND entry_date = ?',
        LOCAL_USER_ID,
        entry.practiceId,
        reviewDate,
      );
      const actualEntryId = persistedEntry?.id ?? entryId;
      await db.runAsync('DELETE FROM entry_blockers WHERE entry_id = ?', actualEntryId);

      for (const value of Object.values(entry.metricValues)) {
        await upsertMetricValue(actualEntryId, value);
      }
      for (const blockerId of entry.blockerIds) {
        await db.runAsync(
          'INSERT OR IGNORE INTO entry_blockers (entry_id, blocker_id) VALUES (?, ?)',
          actualEntryId,
          blockerId,
        );
      }
    }
  });
}

async function upsertMetricValue(entryId: string, value: MetricValueDraft) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO entry_metric_values
      (id, entry_id, metric_id, value_boolean, value_number, value_text, value_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(entry_id, metric_id) DO UPDATE SET
      value_boolean = excluded.value_boolean,
      value_number = excluded.value_number,
      value_text = excluded.value_text,
      value_json = excluded.value_json`,
    makeId('metric_value'),
    entryId,
    value.metricId,
    value.valueBoolean == null ? null : value.valueBoolean ? 1 : 0,
    value.valueNumber ?? null,
    value.valueText ?? null,
    value.valueJson ?? null,
  );
}

export async function getRoutinesWithSchedules(selectedDate: string) {
  const db = await getDb();
  const routines = await db.getAllAsync<{
    id: string;
    name: string;
    description: string | null;
    routine_type: RoutineTemplate['routineType'];
    priority: number;
    active: number;
  }>(
    'SELECT id, name, description, routine_type, priority, active FROM routine_templates ORDER BY priority, name',
  );
  const schedules = await db.getAllAsync<{
    id: string;
    routine_template_id: string;
    start_date: string | null;
    end_date: string | null;
    days_of_week: string;
    active: number;
  }>('SELECT * FROM routine_schedules ORDER BY routine_template_id');
  const exceptions = await db.getAllAsync<{
    routine_template_id: string;
    action: string;
    reason: string | null;
  }>('SELECT * FROM routine_exceptions WHERE exception_date = ?', selectedDate);
  return routines.map((routine) => ({
    id: routine.id,
    name: routine.name,
    description: routine.description,
    routineType: routine.routine_type,
    priority: routine.priority,
    active: routine.active === 1,
    schedules: schedules
      .filter((schedule) => schedule.routine_template_id === routine.id)
      .map((schedule) => ({
        id: schedule.id,
        startDate: schedule.start_date,
        endDate: schedule.end_date,
        daysOfWeek: JSON.parse(schedule.days_of_week) as number[],
        active: schedule.active === 1,
      })),
    exception: exceptions.find((exception) => exception.routine_template_id === routine.id) ?? null,
  }));
}

export async function createRoutine(input: {
  name: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  daysOfWeek: number[];
}) {
  const db = await getDb();
  const routineId = makeId('routine');
  const maxPriority = await db.getFirstAsync<{ max_priority: number | null }>(
    'SELECT MAX(priority) as max_priority FROM routine_templates',
  );
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO routine_templates (id, user_id, name, description, routine_type, priority, active)
       VALUES (?, ?, ?, ?, 'custom', ?, 1)`,
      routineId,
      LOCAL_USER_ID,
      input.name.trim(),
      input.description?.trim() || null,
      (maxPriority?.max_priority ?? 50) + 10,
    );
    await db.runAsync(
      `INSERT INTO routine_schedules (id, routine_template_id, start_date, end_date, days_of_week, active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      makeId('schedule'),
      routineId,
      input.startDate?.trim() || null,
      input.endDate?.trim() || null,
      JSON.stringify(input.daysOfWeek.length ? input.daysOfWeek : [0, 1, 2, 3, 4, 5, 6]),
    );
  });
  return routineId;
}

export async function updateRoutine(input: { id: string; name: string; description?: string | null; active: boolean }) {
  const db = await getDb();
  await db.runAsync(
    'UPDATE routine_templates SET name = ?, description = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    input.name.trim(),
    input.description?.trim() || null,
    input.active ? 1 : 0,
    input.id,
  );
}

export async function deleteRoutine(routineId: string) {
  if (routineId === 'routine_core') {
    throw new Error('The year-round core routine cannot be deleted.');
  }
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM routine_exceptions WHERE routine_template_id = ?', routineId);
    await db.runAsync('DELETE FROM routine_schedules WHERE routine_template_id = ?', routineId);
    await db.runAsync('DELETE FROM routine_practices WHERE routine_template_id = ?', routineId);
    await db.runAsync('DELETE FROM routine_templates WHERE id = ?', routineId);
  });
}

export async function addRoutineSchedule(input: {
  routineId: string;
  startDate?: string | null;
  endDate?: string | null;
  daysOfWeek: number[];
}) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO routine_schedules (id, routine_template_id, start_date, end_date, days_of_week, active)
     VALUES (?, ?, ?, ?, ?, 1)`,
    makeId('schedule'),
    input.routineId,
    input.startDate?.trim() || null,
    input.endDate?.trim() || null,
    JSON.stringify(input.daysOfWeek.length ? input.daysOfWeek : [0, 1, 2, 3, 4, 5, 6]),
  );
}

export async function deleteRoutineSchedule(scheduleId: string) {
  const db = await getDb();
  await db.runAsync('DELETE FROM routine_schedules WHERE id = ?', scheduleId);
}

export async function toggleRoutineActive(routineId: string, active: boolean) {
  const db = await getDb();
  await db.runAsync(
    'UPDATE routine_templates SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    active ? 1 : 0,
    routineId,
  );
}

export async function updateScheduleDays(scheduleId: string, daysOfWeek: number[]) {
  const db = await getDb();
  await db.runAsync(
    'UPDATE routine_schedules SET days_of_week = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    JSON.stringify(daysOfWeek),
    scheduleId,
  );
}

export async function updateScheduleDates(scheduleId: string, startDate: string | null, endDate: string | null) {
  const db = await getDb();
  await db.runAsync(
    'UPDATE routine_schedules SET start_date = ?, end_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    startDate?.trim() || null,
    endDate?.trim() || null,
    scheduleId,
  );
}

export async function getSettingsSnapshot() {
  const db = await getDb();
  const [domains, practices, metrics, reviewSections, blockers] = await Promise.all([
    db.getAllAsync<{ id: string; name: string; active: number }>('SELECT id, name, active FROM domains WHERE active = 1 ORDER BY sort_order'),
    db.getAllAsync<{ id: string; name: string; active: number; domain_name: string }>(
      `SELECT practices.id, practices.name, practices.active, domains.name as domain_name
       FROM practices JOIN domains ON domains.id = practices.domain_id
       WHERE practices.active = 1
       ORDER BY domains.sort_order, practices.name`,
    ),
    db.getAllAsync<{ id: string; name: string; metric_type: string; practice_name: string }>(
      `SELECT metrics.id, metrics.name, metrics.metric_type, practices.name as practice_name
       FROM metrics JOIN practices ON practices.id = metrics.practice_id
       WHERE metrics.active = 1 AND practices.active = 1
       ORDER BY practices.name, metrics.sort_order`,
    ),
    db.getAllAsync<{ id: string; name: string; active: number }>('SELECT id, name, active FROM review_sections ORDER BY sort_order'),
    db.getAllAsync<{ id: string; name: string; active: number }>('SELECT id, name, active FROM blockers WHERE active = 1 ORDER BY name'),
  ]);
  return { domains, practices, metrics, reviewSections, blockers };
}

export async function getTaskFormOptions() {
  const db = await getDb();
  const [domains, routines, reviewSections, blockers] = await Promise.all([
    db.getAllAsync<{ id: string; name: string }>('SELECT id, name FROM domains WHERE active = 1 ORDER BY sort_order'),
    db.getAllAsync<{ id: string; name: string }>('SELECT id, name FROM routine_templates ORDER BY active DESC, priority, name'),
    db.getAllAsync<{ id: string; name: string }>('SELECT id, name FROM review_sections WHERE active = 1 ORDER BY sort_order'),
    db.getAllAsync<{ id: string; name: string }>('SELECT id, name FROM blockers WHERE active = 1 ORDER BY name'),
  ]);
  return { domains, routines, reviewSections, blockers };
}

export async function getTasksForManagement() {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    routinePracticeId: string;
    practiceId: string;
    name: string;
    description: string | null;
    domainId: string;
    domainName: string;
    allowNote: number;
    markable: number;
    weeklyTarget: number | null;
    routineId: string;
    routineName: string;
    reviewSectionId: string;
    reviewSectionName: string;
    required: number;
    enabled: number;
    sortOrder: number;
    archivedFrom: string | null;
  }>(
    `SELECT
      rp.id as routinePracticeId,
      p.id as practiceId,
      p.name,
      p.description,
      p.allow_note as allowNote,
      p.markable,
      p.weekly_target as weeklyTarget,
      d.id as domainId,
      d.name as domainName,
      rt.id as routineId,
      rt.name as routineName,
      rs.id as reviewSectionId,
      rs.name as reviewSectionName,
      rp.required,
      rp.enabled,
      rp.sort_order as sortOrder,
      rp.archived_from as archivedFrom
     FROM routine_practices rp
     JOIN practices p ON p.id = rp.practice_id
     JOIN domains d ON d.id = p.domain_id
     JOIN routine_templates rt ON rt.id = rp.routine_template_id
     JOIN review_sections rs ON rs.id = rp.review_section_id
     WHERE rp.archived_from IS NULL
     ORDER BY rt.priority, rt.name, rs.sort_order, rp.sort_order`,
  );
  const practiceIds = [...new Set(rows.map((row) => row.practiceId))];
  const metricRows = practiceIds.length
    ? await db.getAllAsync<{ id: string; practice_id: string; name: string; metric_type: Metric['metricType']; sort_order: number }>(
        `SELECT id, practice_id, name, metric_type, sort_order
         FROM metrics
         WHERE active = 1 AND practice_id IN (${practiceIds.map(() => '?').join(',')})
         ORDER BY sort_order`,
        practiceIds,
      )
    : [];
  const firstMetricByPractice = new Map<string, (typeof metricRows)[number]>();
  for (const metric of metricRows) {
    if (!firstMetricByPractice.has(metric.practice_id)) {
      firstMetricByPractice.set(metric.practice_id, metric);
    }
  }
  const blockerRows = practiceIds.length
    ? await db.getAllAsync<{ practice_id: string; blocker_id: string; enabled: number }>(
        `SELECT practice_id, blocker_id, enabled FROM practice_blockers WHERE practice_id IN (${practiceIds.map(() => '?').join(',')})`,
        practiceIds,
      )
    : [];
  const blockersByPractice = new Map<string, string[]>();
  const customizedBlockerPractices = new Set<string>();
  for (const row of blockerRows) {
    customizedBlockerPractices.add(row.practice_id);
    if (row.enabled === 1) {
      const list = blockersByPractice.get(row.practice_id) ?? [];
      list.push(row.blocker_id);
      blockersByPractice.set(row.practice_id, list);
    }
  }
  return rows.map((row) => ({
    ...row,
    metricId: firstMetricByPractice.get(row.practiceId)?.id ?? null,
    metricName: firstMetricByPractice.get(row.practiceId)?.name ?? null,
    metricType: firstMetricByPractice.get(row.practiceId)?.metric_type ?? null,
    blockerIds: blockersByPractice.get(row.practiceId) ?? [],
    blockersConfigured: customizedBlockerPractices.has(row.practiceId) ? 1 : 0,
    protectedFromRemoval: isHomeFunctionPractice({ id: row.practiceId, name: row.name, domainId: row.domainId }) ? 1 : 0,
  }));
}

export async function getRoutineTasks(routineId: string) {
  const db = await getDb();
  return db.getAllAsync<{
    routinePracticeId: string;
    practiceName: string;
    domainName: string;
    reviewSectionName: string;
    metricName: string | null;
    metricType: string | null;
    required: number;
    enabled: number;
  }>(
    `SELECT
      rp.id as routinePracticeId,
      p.name as practiceName,
      d.name as domainName,
      rs.name as reviewSectionName,
      m.name as metricName,
      m.metric_type as metricType,
      rp.required,
      rp.enabled
     FROM routine_practices rp
     JOIN practices p ON p.id = rp.practice_id
     JOIN domains d ON d.id = p.domain_id
     JOIN review_sections rs ON rs.id = rp.review_section_id
     LEFT JOIN metrics m ON m.practice_id = p.id AND m.active = 1 AND m.sort_order = (
       SELECT MIN(sort_order) FROM metrics WHERE practice_id = p.id AND active = 1
     )
     WHERE rp.routine_template_id = ? AND rp.enabled = 1
      AND rp.archived_from IS NULL
     ORDER BY rs.sort_order, rp.sort_order`,
    routineId,
  );
}

export async function updateTask(input: {
  routinePracticeId: string;
  practiceId: string;
  metricId?: string | null;
  name: string;
  description?: string | null;
  domainId: string;
  routineId: string;
  reviewSectionId: string;
  metricKind: 'completed' | 'quality' | 'number' | 'text';
  enabled: boolean;
  allowNote: boolean;
  markable: boolean;
  weeklyTarget?: number | null;
  blockerIds?: string[];
}) {
  const db = await getDb();
  const metric =
    input.metricKind === 'completed'
      ? { name: 'Completed', type: 'boolean', min: null, max: null }
      : input.metricKind === 'quality'
        ? { name: 'Quality', type: 'scale', min: 1, max: 5 }
        : input.metricKind === 'number'
          ? { name: 'Number', type: 'number', min: null, max: null }
          : { name: 'Text', type: 'text', min: null, max: null };
  const currentPlacement = await db.getFirstAsync<{
    routine_template_id: string;
    review_section_id: string;
    sort_order: number;
  }>('SELECT routine_template_id, review_section_id, sort_order FROM routine_practices WHERE id = ?', input.routinePracticeId);
  const sortOrder =
    currentPlacement?.routine_template_id === input.routineId && currentPlacement.review_section_id === input.reviewSectionId
      ? currentPlacement.sort_order
      : await getNextTaskSortOrder(db, input.routineId, input.reviewSectionId, input.domainId, input.name);

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE practices SET name = ?, description = ?, domain_id = ?, allow_note = ?, markable = ?, weekly_target = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      input.name.trim(),
      input.description?.trim() || null,
      input.domainId,
      input.allowNote ? 1 : 0,
      input.markable ? 1 : 0,
      normalizeWeeklyTarget(input.weeklyTarget),
      input.practiceId,
    );
    await db.runAsync(
      `UPDATE routine_practices
       SET routine_template_id = ?, review_section_id = ?, sort_order = ?, required = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      input.routineId,
      input.reviewSectionId,
      sortOrder,
      0,
      input.enabled ? 1 : 0,
      input.routinePracticeId,
    );
    if (input.metricId) {
      await db.runAsync(
        `UPDATE metrics
         SET name = ?, metric_type = ?, scale_min = ?, scale_max = ?, required = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        metric.name,
        metric.type,
        metric.min,
        metric.max,
        0,
        input.metricId,
      );
    } else {
      await db.runAsync(
        `INSERT INTO metrics (id, practice_id, name, metric_type, scale_min, scale_max, required, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        makeId('metric'),
        input.practiceId,
        metric.name,
        metric.type,
        metric.min,
        metric.max,
        0,
      );
    }
    await replacePracticeBlockers(db, input.practiceId, input.blockerIds);
    if (!input.allowNote) {
      await db.runAsync('UPDATE daily_entries SET note = NULL, updated_at = CURRENT_TIMESTAMP WHERE practice_id = ?', input.practiceId);
    }
    if (!input.markable) {
      await db.runAsync('UPDATE daily_entries SET remind_tomorrow = 0, updated_at = CURRENT_TIMESTAMP WHERE practice_id = ?', input.practiceId);
    }
  });
}

export async function createTask(input: {
  name: string;
  description?: string;
  domainId: string;
  routineId: string;
  reviewSectionId: string;
  metricKind: 'completed' | 'quality' | 'number' | 'text';
  enabled?: boolean;
  allowNote: boolean;
  markable: boolean;
  weeklyTarget?: number | null;
  blockerIds?: string[];
}) {
  const db = await getDb();
  const practiceId = makeId('practice');
  const metricId = makeId('metric');
  const routinePracticeId = makeId('routine_practice');
  const sortOrder = await getNextTaskSortOrder(db, input.routineId, input.reviewSectionId, input.domainId, input.name);
  const metric =
    input.metricKind === 'completed'
      ? { name: 'Completed', type: 'boolean', min: null, max: null }
      : input.metricKind === 'quality'
        ? { name: 'Quality', type: 'scale', min: 1, max: 5 }
        : input.metricKind === 'number'
          ? { name: 'Number', type: 'number', min: null, max: null }
          : { name: 'Text', type: 'text', min: null, max: null };

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO practices (id, user_id, domain_id, name, description, allow_note, markable, weekly_target) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      practiceId,
      LOCAL_USER_ID,
      input.domainId,
      input.name.trim(),
      input.description?.trim() || null,
      input.allowNote ? 1 : 0,
      input.markable ? 1 : 0,
      normalizeWeeklyTarget(input.weeklyTarget),
    );
    await db.runAsync(
      `INSERT INTO metrics (id, practice_id, name, metric_type, scale_min, scale_max, required, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      metricId,
      practiceId,
      metric.name,
      metric.type,
      metric.min,
      metric.max,
      0,
    );
    await db.runAsync(
      `INSERT INTO routine_practices
        (id, routine_template_id, practice_id, review_section_id, sort_order, required, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      routinePracticeId,
      input.routineId,
      practiceId,
      input.reviewSectionId,
      sortOrder,
      0,
      input.enabled === false ? 0 : 1,
    );
    await replacePracticeBlockers(db, practiceId, input.blockerIds);
  });
}

export async function removeTaskFromTodayForward(routinePracticeId: string, fromDate = todayIsoDate()) {
  const db = await getDb();
  const practice = await db.getFirstAsync<{ id: string; name: string; domain_id: string }>(
    `SELECT p.id, p.name, p.domain_id
     FROM routine_practices rp
     JOIN practices p ON p.id = rp.practice_id
     WHERE rp.id = ?`,
    routinePracticeId,
  );
  if (practice && isHomeFunctionPractice(practice)) {
    throw new Error('This practice supports the Home page. Mark it inactive instead of removing it.');
  }
  await db.runAsync(
    'UPDATE routine_practices SET archived_from = ?, enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    fromDate,
    routinePracticeId,
  );
}

function normalizeWeeklyTarget(value: number | null | undefined) {
  if (value == null) return null;
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < 1) return null;
  return Math.min(7, rounded);
}

export async function moveTaskWithinReviewSection(routinePracticeId: string, direction: 'up' | 'down') {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const current = await db.getFirstAsync<{
      id: string;
      routine_template_id: string;
      review_section_id: string;
    }>(
      'SELECT id, routine_template_id, review_section_id FROM routine_practices WHERE id = ? AND archived_from IS NULL',
      routinePracticeId,
    );
    if (!current) return;

    const rows = await db.getAllAsync<{ id: string }>(
      `SELECT rp.id
       FROM routine_practices rp
       JOIN practices p ON p.id = rp.practice_id
       WHERE rp.review_section_id = ?
        AND rp.routine_template_id = ?
        AND rp.archived_from IS NULL
       ORDER BY rp.sort_order, p.name`,
      current.review_section_id,
      current.routine_template_id,
    );
    const currentIndex = rows.findIndex((row) => row.id === current.id);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= rows.length) return;

    const reordered = [...rows];
    [reordered[currentIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[currentIndex]];
    for (const [index, row] of reordered.entries()) {
      await db.runAsync(
        'UPDATE routine_practices SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        (index + 1) * 10,
        row.id,
      );
    }
  });
}

async function replacePracticeBlockers(db: Awaited<ReturnType<typeof getDb>>, practiceId: string, blockerIds?: string[]) {
  const allIds = (await db.getAllAsync<{ id: string }>('SELECT id FROM blockers WHERE active = 1 ORDER BY name')).map((row) => row.id);
  const ids = blockerIds ?? allIds;
  await db.runAsync('DELETE FROM practice_blockers WHERE practice_id = ?', practiceId);
  for (const blockerId of allIds) {
    await db.runAsync(
      'INSERT INTO practice_blockers (practice_id, blocker_id, enabled) VALUES (?, ?, ?)',
      practiceId,
      blockerId,
      ids.includes(blockerId) ? 1 : 0,
    );
  }
}

export async function getReviewStatusMap(startDate: string, endDate: string) {
  const db = await getDb();
  const rows = await db.getAllAsync<{ review_date: string }>(
    `SELECT review_date
     FROM daily_review_sessions
     WHERE user_id = ?
      AND review_date >= ?
      AND review_date <= ?
      AND completed_at IS NOT NULL`,
    LOCAL_USER_ID,
    startDate,
    endDate,
  );
  return new Set(rows.map((row) => row.review_date));
}

export async function getCurrentReviewStreak() {
  const savedDates = await getReviewStatusMap(addDaysIso(todayIsoDate(), -365), todayIsoDate());
  let streak = 0;
  let cursor = savedDates.has(todayIsoDate()) ? todayIsoDate() : addDaysIso(todayIsoDate(), -1);
  while (savedDates.has(cursor)) {
    streak += 1;
    cursor = addDaysIso(cursor, -1);
  }
  return streak;
}

export async function getDomainEditorRows() {
  const db = await getDb();
  return db.getAllAsync<{ id: string; name: string; description: string | null; active: number; inUse: number }>(
    `SELECT d.id, d.name, d.description, d.active,
      CASE WHEN EXISTS (SELECT 1 FROM practices p WHERE p.domain_id = d.id AND p.active = 1) THEN 1 ELSE 0 END as inUse
     FROM domains d
     WHERE d.active = 1
     ORDER BY d.sort_order`,
  );
}

export async function updateDomain(input: { id: string; name: string; description?: string | null; active?: boolean }) {
  const db = await getDb();
  await db.runAsync(
    'UPDATE domains SET name = ?, description = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    input.name.trim(),
    input.description?.trim() || null,
    input.active === false ? 0 : 1,
    input.id,
  );
}

export async function createDomain(input: { name: string; description?: string | null }) {
  const db = await getDb();
  const maxSort = await db.getFirstAsync<{ max_sort: number | null }>('SELECT MAX(sort_order) as max_sort FROM domains');
  const id = makeId('domain');
  await db.runAsync(
    'INSERT INTO domains (id, user_id, name, description, sort_order, active) VALUES (?, ?, ?, ?, ?, 1)',
    id,
    LOCAL_USER_ID,
    input.name.trim(),
    input.description?.trim() || null,
    (maxSort?.max_sort ?? 0) + 10,
  );
  return id;
}

export async function deactivateDomain(domainId: string) {
  const db = await getDb();
  const inUse = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM practices WHERE domain_id = ? AND active = 1',
    domainId,
  );
  if ((inUse?.count ?? 0) > 0) {
    throw new Error('This domain is in use. Move or remove its tasks before deleting it.');
  }
  await db.runAsync('UPDATE domains SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', domainId);
}

export async function getBlockerEditorRows() {
  const db = await getDb();
  return db.getAllAsync<{ id: string; name: string; description: string | null; active: number }>(
    'SELECT id, name, description, active FROM blockers ORDER BY name',
  );
}

export async function updateBlocker(input: { id: string; name: string; description?: string | null; active: boolean }) {
  const db = await getDb();
  await db.runAsync(
    'UPDATE blockers SET name = ?, description = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    input.name.trim(),
    input.description?.trim() || null,
    input.active ? 1 : 0,
    input.id,
  );
}

export async function createBlocker(input: { name: string; description?: string | null }) {
  const db = await getDb();
  const id = makeId('blocker');
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO blockers (id, user_id, name, description, active) VALUES (?, ?, ?, ?, 1)',
      id,
      LOCAL_USER_ID,
      input.name.trim(),
      input.description?.trim() || null,
    );
    const practices = await db.getAllAsync<{ id: string }>('SELECT id FROM practices WHERE active = 1');
    for (const practice of practices) {
      await db.runAsync(
        'INSERT OR IGNORE INTO practice_blockers (practice_id, blocker_id, enabled) VALUES (?, ?, 1)',
        practice.id,
        id,
      );
    }
    await db.runAsync(
      `UPDATE practice_blockers
       SET enabled = 0,
        updated_at = CURRENT_TIMESTAMP
       WHERE blocker_id = ?
        AND practice_id IN ('practice_gratitude', 'practice_daily_avodah', 'practice_weekly_avodah', 'practice_daily_thoughts')`,
      id,
    );
  });
  return id;
}

async function getNextTaskSortOrder(
  db: Awaited<ReturnType<typeof getDb>>,
  _routineId: string,
  reviewSectionId: string,
  domainId: string,
  taskName: string,
) {
  const isOverview = reviewSectionId === 'section_overall';
  const band = isOverview ? overviewSortBand(domainId, taskName) : 0;
  const min = isOverview ? band : 0;
  const max = isOverview ? band + 89 : 9999;
  const row = await db.getFirstAsync<{ max_sort: number | null }>(
    `SELECT MAX(sort_order) as max_sort
     FROM routine_practices
     WHERE review_section_id = ?
      AND sort_order >= ?
      AND sort_order <= ?`,
    reviewSectionId,
    min,
    max,
  );
  return (row?.max_sort ?? band) + 10;
}

function overviewSortBand(domainId: string, taskName: string) {
  const name = taskName.toLowerCase();
  if (domainId === 'domain_health' || name.includes('phone') || name.includes('computer')) return 0;
  if (domainId === 'domain_tefillah_brachot') return 100;
  if (domainId === 'domain_middos') return 200;
  return 300;
}

export async function exportAllData() {
  const db = await getDb();
  const payload: Record<string, unknown[]> = {};
  for (const tableName of exportTableNames) {
    payload[tableName] = await db.getAllAsync(`SELECT * FROM ${tableName}`);
  }
  return JSON.stringify({ exportedAt: new Date().toISOString(), tables: payload }, null, 2);
}

export async function importAllData(exportJson: string) {
  const parsed = JSON.parse(exportJson) as { tables?: Record<string, Record<string, unknown>[]> };
  if (!parsed.tables) {
    throw new Error('Import file does not include tables.');
  }
  const db = await getDb();
  await db.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    const columnMap = await getImportColumnMap();
    await db.withTransactionAsync(async () => {
      for (const tableName of [...exportTableNames].reverse()) {
        await db.runAsync(`DELETE FROM ${tableName}`);
      }
      for (const tableName of exportTableNames) {
        for (const row of parsed.tables?.[tableName] ?? []) {
          const columns = Object.keys(row).filter((column) => columnMap[tableName]?.has(column));
          if (columns.length === 0) continue;
          const placeholders = columns.map(() => '?').join(', ');
          await db.runAsync(
            `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
            columns.map((column) => normalizeImportValue(row[column])),
          );
        }
      }
    });
    await normalizeQualityScale(db);
    await normalizeReviewCompletionState(db);
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
  await ensureRoshChodeshRoutine(db);
  await ensureReflectionDefaults(db);
}

export async function shareExportJson() {
  const json = await exportAllData();
  const path = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory}cheshbon-export-${Date.now()}.json`;
  await FileSystem.writeAsStringAsync(path, json);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Export cheshbon data' });
  }
  return { path, json };
}

function normalizeImportValue(value: unknown) {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return value as string | number | null;
}

async function getImportColumnMap() {
  const db = await getDb();
  const columnMap: Partial<Record<(typeof exportTableNames)[number], Set<string>>> = {};
  for (const tableName of exportTableNames) {
    const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName})`);
    columnMap[tableName] = new Set(columns.map((column) => column.name));
  }
  return columnMap;
}

async function clearRequiredFlags(db: Awaited<ReturnType<typeof getDb>>) {
  await db.runAsync('UPDATE routine_practices SET required = 0');
  await db.runAsync('UPDATE metrics SET required = 0');
}

const exportTableNames = [
  'domains',
  'review_sections',
  'practices',
  'metrics',
  'metric_options',
  'routine_templates',
  'routine_schedules',
  'routine_exceptions',
  'blockers',
  'routine_practices',
  'daily_review_sessions',
  'daily_entries',
  'entry_metric_values',
  'practice_blockers',
  'entry_blockers',
  'weekly_reviews',
  'app_preferences',
] as const;
