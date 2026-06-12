import { getDb } from '@/src/db/client';
import { LOCAL_USER_ID } from '@/src/constants/seedData';
import type { NightlyReviewItem, NightlyReviewSection, RoutineTemplate } from '@/src/models/types';
import { getMetricsForPracticeIds, getReminderPreferences } from '@/src/repositories/cheshbonRepo';
import { addDaysIso, dayOfWeek } from '@/src/utils/dates';

type RoutineRow = {
  id: string;
  name: string;
  description: string | null;
  routine_type: RoutineTemplate['routineType'];
  priority: number;
  active: number;
};

type ScheduleRow = {
  routine_template_id: string;
  start_date: string | null;
  end_date: string | null;
  days_of_week: string;
  active: number;
};

type ExceptionRow = {
  routine_template_id: string;
  action: 'enable' | 'disable';
};

type ReviewItemRow = {
  routine_practice_id: string;
  routine_id: string;
  routine_name: string;
  routine_priority: number;
  practice_id: string;
  practice_name: string;
  practice_description: string | null;
  allow_note: number;
  markable: number;
  weekly_target: number | null;
  display_name_override: string | null;
  help_text_override: string | null;
  domain_id: string;
  domain_name: string;
  review_section_id: string;
  review_section_name: string;
  review_section_description: string | null;
  section_sort_order: number;
  sort_order: number;
  required: number;
};

type AvodahContextRow = {
  entry_date: string;
  text: string | null;
};

export async function getActiveRoutinesForDate(reviewDate: string): Promise<RoutineTemplate[]> {
  const db = await getDb();
  const [routineRows, scheduleRows, exceptionRows] = await Promise.all([
    db.getAllAsync<RoutineRow>('SELECT * FROM routine_templates WHERE active = 1'),
    db.getAllAsync<ScheduleRow>('SELECT * FROM routine_schedules WHERE active = 1'),
    db.getAllAsync<ExceptionRow>('SELECT routine_template_id, action FROM routine_exceptions WHERE exception_date = ?', reviewDate),
  ]);

  const weekday = dayOfWeek(reviewDate);
  const exceptionsByRoutine = new Map(exceptionRows.map((exception) => [exception.routine_template_id, exception.action]));

  const active = routineRows.filter((routine) => {
    const exception = exceptionsByRoutine.get(routine.id);
    if (exception === 'enable') return true;
    if (exception === 'disable') return false;
    if (routine.id === 'routine_rosh_chodesh' && isFirstRoshChodeshDate(reviewDate)) return true;
    return scheduleRows
      .filter((schedule) => schedule.routine_template_id === routine.id)
      .some((schedule) => {
        const startsBefore = !schedule.start_date || schedule.start_date <= reviewDate;
        const endsAfter = !schedule.end_date || schedule.end_date >= reviewDate;
        const days = JSON.parse(schedule.days_of_week) as number[];
        return startsBefore && endsAfter && days.includes(weekday);
      });
  });

  return active
    .sort((a, b) => a.priority - b.priority)
    .map((routine) => ({
      id: routine.id,
      name: routine.name,
      description: routine.description,
      routineType: routine.routine_type,
      priority: routine.priority,
      active: routine.active === 1,
    }));
}

export async function getNightlyReviewItems(reviewDate: string): Promise<NightlyReviewSection[]> {
  const db = await getDb();
  const reminderPreferences = await getReminderPreferences();
  const activeRoutines = await getActiveRoutinesForDate(reviewDate);
  if (activeRoutines.length === 0) return [];

  const activeRoutineIds = activeRoutines.map((routine) => routine.id);
  const rows = await db.getAllAsync<ReviewItemRow>(
    `SELECT
      rp.id as routine_practice_id,
      rt.id as routine_id,
      rt.name as routine_name,
      rt.priority as routine_priority,
      p.id as practice_id,
      p.name as practice_name,
      p.description as practice_description,
      p.allow_note,
      p.markable,
      p.weekly_target,
      rp.display_name_override,
      rp.help_text_override,
      d.id as domain_id,
      d.name as domain_name,
      rs.id as review_section_id,
      rs.name as review_section_name,
      rs.description as review_section_description,
      rs.sort_order as section_sort_order,
      rp.sort_order,
      rp.required
    FROM routine_practices rp
    JOIN routine_templates rt ON rt.id = rp.routine_template_id
    JOIN practices p ON p.id = rp.practice_id
    JOIN domains d ON d.id = p.domain_id
    JOIN review_sections rs ON rs.id = rp.review_section_id
    WHERE rp.enabled = 1
      AND (rp.archived_from IS NULL OR rp.archived_from > ?)
      AND p.active = 1
      AND rs.active = 1
      AND rp.routine_template_id IN (${activeRoutineIds.map(() => '?').join(',')})
    ORDER BY rs.sort_order, rp.sort_order`,
    [reviewDate, ...activeRoutineIds],
  );

  const winningItems = new Map<string, ReviewItemRow>();
  for (const row of rows) {
    const existing = winningItems.get(row.practice_id);
    if (!existing || row.routine_priority > existing.routine_priority) {
      winningItems.set(row.practice_id, row);
    }
  }

  const winners = [...winningItems.values()];
  const metricsByPractice = await getMetricsForPracticeIds(winners.map((item) => item.practice_id));
  const avodahContextByReviewPractice = await getAvodahReviewContext(reviewDate, winners.map((item) => item.practice_id));
  const weeklyGoalProgress = await getWeeklyGoalProgress(
    reviewDate,
    winners.filter((item) => item.weekly_target != null && item.weekly_target > 0).map((item) => item.practice_id),
  );
  const blockerRows = winners.length
    ? await db.getAllAsync<{ practice_id: string; blocker_id: string; enabled: number }>(
        `SELECT practice_id, blocker_id, enabled
         FROM practice_blockers
         WHERE practice_id IN (${winners.map(() => '?').join(',')})`,
        winners.map((item) => item.practice_id),
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
  const sectionMap = new Map<string, NightlyReviewSection>();

  for (const row of winners.sort((a, b) => a.section_sort_order - b.section_sort_order || a.sort_order - b.sort_order)) {
    const section = sectionMap.get(row.review_section_id) ?? {
      id: row.review_section_id,
      name: row.review_section_name,
      description: row.review_section_description,
      sortOrder: row.section_sort_order,
      items: [],
    };
    const item: NightlyReviewItem = {
      routinePracticeId: row.routine_practice_id,
      routineId: row.routine_id,
      routineName: row.routine_name,
      routinePriority: row.routine_priority,
      practiceId: row.practice_id,
      practiceName: row.practice_name,
      displayName: row.display_name_override ?? row.practice_name,
      helpText: appendHelpText(row.help_text_override ?? row.practice_description, avodahContextByReviewPractice.get(row.practice_id)),
      domainId: row.domain_id,
      domainName: row.domain_name,
      reviewSectionId: row.review_section_id,
      reviewSectionName: row.review_section_name,
      sectionSortOrder: row.section_sort_order,
      sortOrder: row.sort_order,
      required: row.required === 1,
      metrics: metricsByPractice.get(row.practice_id) ?? [],
      allowedBlockerIds: customizedBlockerPractices.has(row.practice_id) ? blockersByPractice.get(row.practice_id) ?? [] : null,
      allowNote: row.allow_note === 1,
      markable: reminderPreferences.taskRemindersEnabled && row.markable === 1,
      weeklyGoal:
        row.weekly_target != null && row.weekly_target > 0 && (metricsByPractice.get(row.practice_id) ?? []).some((metric) => metric.metricType === 'boolean')
          ? {
              target: row.weekly_target,
              completedBeforeToday: weeklyGoalProgress.get(row.practice_id) ?? 0,
            }
          : null,
    };
    section.items.push(item);
    sectionMap.set(row.review_section_id, section);
  }

  return [...sectionMap.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

async function getAvodahReviewContext(reviewDate: string, practiceIds: string[]) {
  const context = new Map<string, string>();
  const needsDailyContext = practiceIds.includes('practice_daily_avodah_review');
  const needsWeeklyContext = practiceIds.includes('practice_weekly_avodah_review');
  if (!needsDailyContext && !needsWeeklyContext) return context;

  const db = await getDb();
  const [dailyAvodah, weeklyAvodah] = await Promise.all([
    needsDailyContext ? getLatestPracticeTextBeforeDate(db, 'practice_daily_avodah', reviewDate) : Promise.resolve(null),
    needsWeeklyContext ? getLatestPracticeTextBeforeDate(db, 'practice_weekly_avodah', reviewDate) : Promise.resolve(null),
  ]);

  if (dailyAvodah?.text?.trim()) {
    context.set('practice_daily_avodah_review', `Most recent Daily Avodah (${dailyAvodah.entry_date}): ${dailyAvodah.text.trim()}`);
  }
  if (weeklyAvodah?.text?.trim()) {
    context.set('practice_weekly_avodah_review', `Most recent Weekly Avodah (${weeklyAvodah.entry_date}): ${weeklyAvodah.text.trim()}`);
  }
  return context;
}

async function getLatestPracticeTextBeforeDate(
  db: Awaited<ReturnType<typeof getDb>>,
  practiceId: string,
  reviewDate: string,
) {
  return db.getFirstAsync<AvodahContextRow>(
    `SELECT de.entry_date,
      COALESCE(NULLIF(TRIM(emv.value_text), ''), NULLIF(TRIM(de.note), '')) as text
     FROM daily_entries de
     LEFT JOIN metrics m ON m.practice_id = de.practice_id
      AND m.metric_type = 'text'
      AND m.active = 1
     LEFT JOIN entry_metric_values emv ON emv.entry_id = de.id
      AND emv.metric_id = m.id
     WHERE de.user_id = ?
      AND de.practice_id = ?
      AND de.entry_date < ?
      AND COALESCE(NULLIF(TRIM(emv.value_text), ''), NULLIF(TRIM(de.note), '')) IS NOT NULL
     ORDER BY de.entry_date DESC
     LIMIT 1`,
    LOCAL_USER_ID,
    practiceId,
    reviewDate,
  );
}

function appendHelpText(baseHelpText: string | null | undefined, contextText: string | undefined) {
  if (!contextText) return baseHelpText;
  const base = baseHelpText?.trim();
  return base ? `${base}\n${contextText}` : contextText;
}

async function getWeeklyGoalProgress(reviewDate: string, practiceIds: string[]) {
  const progress = new Map<string, number>();
  if (practiceIds.length === 0) return progress;

  const db = await getDb();
  const weekStart = halachicWeekStart(reviewDate);
  const rows = await db.getAllAsync<{ practice_id: string; completed: number }>(
    `SELECT de.practice_id, COUNT(DISTINCT de.entry_date) as completed
     FROM daily_entries de
     JOIN entry_metric_values emv ON emv.entry_id = de.id
      AND emv.value_boolean = 1
     JOIN metrics m ON m.id = emv.metric_id
      AND m.practice_id = de.practice_id
      AND m.metric_type = 'boolean'
      AND m.active = 1
     WHERE de.user_id = ?
      AND de.practice_id IN (${practiceIds.map(() => '?').join(',')})
      AND de.entry_date >= ?
      AND de.entry_date < ?
     GROUP BY de.practice_id`,
    [LOCAL_USER_ID, ...practiceIds, weekStart, reviewDate],
  );
  for (const row of rows) {
    progress.set(row.practice_id, row.completed);
  }
  return progress;
}

function halachicWeekStart(isoDate: string) {
  const delta = (dayOfWeek(isoDate) - 6 + 7) % 7;
  return addDaysIso(isoDate, -delta);
}

function isFirstRoshChodeshDate(isoDate: string) {
  const today = getHebrewDateParts(isoDate);
  if (!today || isTishrei(today.month)) return false;

  const next = getHebrewDateParts(addDaysIso(isoDate, 1));
  if (today.day === 30 && next?.day === 1 && !isTishrei(next.month)) return true;

  const previous = getHebrewDateParts(addDaysIso(isoDate, -1));
  return today.day === 1 && previous?.day !== 30;
}

function getHebrewDateParts(isoDate: string) {
  try {
    const date = new Date(`${isoDate}T12:00:00`);
    const parts = new Intl.DateTimeFormat('en-u-ca-hebrew', {
      day: 'numeric',
      month: 'long',
    }).formatToParts(date);
    const day = Number(parts.find((part) => part.type === 'day')?.value);
    const month = parts.find((part) => part.type === 'month')?.value ?? '';
    return Number.isFinite(day) ? { day, month } : null;
  } catch {
    return null;
  }
}

function isTishrei(month: string) {
  return month.toLowerCase().startsWith('tish');
}
