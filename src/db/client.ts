import * as SQLite from 'expo-sqlite';

import {
  blockerNames,
  domains,
  LOCAL_USER_ID,
  practices,
  reviewSections,
  routinePractices,
  routines,
  schedules,
} from '@/src/constants/seedData';
import { schemaSql } from '@/src/db/schema';
import { normalizeQualityScale } from '@/src/db/qualityScale';
import { normalizeReviewCompletionState } from '@/src/db/reviewCompletion';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('cheshbon_hanefesh.db');
  }
  const db = await dbPromise;
  await db.execAsync('PRAGMA foreign_keys = ON;');
  return db;
}

export async function initializeDatabase() {
  const db = await getDb();
  await db.execAsync(schemaSql);
  await ensureColumn(db, 'daily_review_sessions', 'bed_time', 'TEXT');
  await ensureColumn(db, 'daily_review_sessions', 'wake_time', 'TEXT');
  await ensureColumn(db, 'daily_review_sessions', 'completed_at', 'TEXT');
  await ensureColumn(db, 'metrics', 'created_at', 'TEXT');
  await ensureColumn(db, 'metrics', 'updated_at', 'TEXT');
  await ensureColumn(db, 'routine_practices', 'archived_from', 'TEXT');
  await ensureColumn(db, 'practices', 'allow_note', 'INTEGER NOT NULL DEFAULT 1');
  await ensureColumn(db, 'practices', 'markable', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db, 'daily_entries', 'remind_tomorrow', 'INTEGER NOT NULL DEFAULT 0');
  const existing = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM domains');
  if (!existing?.count) {
    await seedDatabase(db);
  }
  await ensureRoshChodeshRoutine(db);
  await normalizeQualityScale(db);
  await normalizeReviewCompletionState(db);
}

async function ensureColumn(db: SQLite.SQLiteDatabase, tableName: string, columnName: string, definition: string) {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName})`);
  if (!columns.some((column) => column.name === columnName)) {
    await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

async function seedDatabase(db: SQLite.SQLiteDatabase) {
  await db.withTransactionAsync(async () => {
    for (const [index, [id, name, description]] of domains.entries()) {
      await db.runAsync(
        'INSERT OR IGNORE INTO domains (id, user_id, name, description, sort_order) VALUES (?, ?, ?, ?, ?)',
        id,
        LOCAL_USER_ID,
        name,
        description,
        index + 1,
      );
    }

    for (const [index, [id, name, description]] of reviewSections.entries()) {
      await db.runAsync(
        'INSERT OR IGNORE INTO review_sections (id, user_id, name, description, sort_order) VALUES (?, ?, ?, ?, ?)',
        id,
        LOCAL_USER_ID,
        name,
        description,
        (index + 1) * 10,
      );
    }

    for (const [id, name, description, routineType, priority, active] of routines) {
      await db.runAsync(
        'INSERT OR IGNORE INTO routine_templates (id, user_id, name, description, routine_type, priority, active) VALUES (?, ?, ?, ?, ?, ?, ?)',
        id,
        LOCAL_USER_ID,
        name,
        description,
        routineType,
        priority,
        active ? 1 : 0,
      );
    }

    for (const [id, routineId, startDate, endDate, daysOfWeek] of schedules) {
      await db.runAsync(
        'INSERT OR IGNORE INTO routine_schedules (id, routine_template_id, start_date, end_date, days_of_week) VALUES (?, ?, ?, ?, ?)',
        id,
        routineId,
        startDate,
        endDate,
        JSON.stringify(daysOfWeek),
      );
    }

    for (const practice of practices) {
      await db.runAsync(
        'INSERT OR IGNORE INTO practices (id, user_id, domain_id, name, description) VALUES (?, ?, ?, ?, ?)',
        practice.id,
        LOCAL_USER_ID,
        practice.domainId,
        practice.name,
        practice.description ?? null,
      );

      for (const [index, metric] of practice.metrics.entries()) {
        await db.runAsync(
          `INSERT OR IGNORE INTO metrics
            (id, practice_id, name, metric_type, scale_min, scale_max, required, help_text, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          metric.id,
          practice.id,
          metric.name,
          metric.metricType,
          metric.scaleMin ?? null,
          metric.scaleMax ?? null,
          metric.required ? 1 : 0,
          metric.helpText ?? null,
          index + 1,
        );

        for (const [optionIndex, [value, label, optionValue]] of (metric.options ?? []).entries()) {
          await db.runAsync(
            'INSERT OR IGNORE INTO metric_options (id, metric_id, label, value, sort_order) VALUES (?, ?, ?, ?, ?)',
            `${metric.id}_${value}`,
            metric.id,
            label,
            optionValue,
            optionIndex + 1,
          );
        }
      }
    }

    for (const [id, routineId, practiceId, sectionId, sortOrder, required, displayName, helpText] of routinePractices) {
      await db.runAsync(
        `INSERT OR IGNORE INTO routine_practices
          (id, routine_template_id, practice_id, review_section_id, sort_order, required, display_name_override, help_text_override)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        routineId,
        practiceId,
        sectionId,
        sortOrder,
        required,
        displayName,
        helpText,
      );
    }

    for (const [index, name] of blockerNames.entries()) {
      const id = `blocker_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
      await db.runAsync(
        'INSERT OR IGNORE INTO blockers (id, user_id, name) VALUES (?, ?, ?)',
        id,
        LOCAL_USER_ID,
        name,
      );
      await db.runAsync('UPDATE blockers SET description = ? WHERE id = ?', `Common blocker #${index + 1}`, id);
    }
  });
}

export async function ensureRoshChodeshRoutine(db?: SQLite.SQLiteDatabase) {
  const targetDb = db ?? (await getDb());
  const currentAvodahDomain = domains.find(([id]) => id === 'domain_current_avodah');
  const overviewSection = reviewSections.find(([id]) => id === 'section_overall');
  const roshChodeshRoutine = routines.find(([id]) => id === 'routine_rosh_chodesh');
  const roshChodeshPracticeIds = new Set(['practice_rosh_chodesh_past_month', 'practice_rosh_chodesh_improvement']);
  const roshChodeshPractices = practices.filter((practice) => roshChodeshPracticeIds.has(practice.id));
  const roshChodeshRoutinePractices = routinePractices.filter(([, routineId]) => routineId === 'routine_rosh_chodesh');
  const roshChodeshSchedules = schedules.filter(([, routineId]) => routineId === 'routine_rosh_chodesh');

  await targetDb.withTransactionAsync(async () => {
    if (currentAvodahDomain) {
      const [id, name, description] = currentAvodahDomain;
      await targetDb.runAsync(
        'INSERT OR IGNORE INTO domains (id, user_id, name, description, sort_order) VALUES (?, ?, ?, ?, ?)',
        id,
        LOCAL_USER_ID,
        name,
        description,
        domains.findIndex(([domainId]) => domainId === id) + 1,
      );
    }

    if (overviewSection) {
      const [id, name, description] = overviewSection;
      await targetDb.runAsync(
        'INSERT OR IGNORE INTO review_sections (id, user_id, name, description, sort_order) VALUES (?, ?, ?, ?, ?)',
        id,
        LOCAL_USER_ID,
        name,
        description,
        (reviewSections.findIndex(([sectionId]) => sectionId === id) + 1) * 10,
      );
    }

    if (roshChodeshRoutine) {
      const [id, name, description, routineType, priority, active] = roshChodeshRoutine;
      await targetDb.runAsync(
        'INSERT OR IGNORE INTO routine_templates (id, user_id, name, description, routine_type, priority, active) VALUES (?, ?, ?, ?, ?, ?, ?)',
        id,
        LOCAL_USER_ID,
        name,
        description,
        routineType,
        priority,
        active ? 1 : 0,
      );
    }

    for (const [id, routineId, startDate, endDate, daysOfWeek] of roshChodeshSchedules) {
      await targetDb.runAsync(
        'INSERT OR IGNORE INTO routine_schedules (id, routine_template_id, start_date, end_date, days_of_week) VALUES (?, ?, ?, ?, ?)',
        id,
        routineId,
        startDate,
        endDate,
        JSON.stringify(daysOfWeek),
      );
    }

    for (const practice of roshChodeshPractices) {
      await targetDb.runAsync(
        'INSERT OR IGNORE INTO practices (id, user_id, domain_id, name, description, allow_note) VALUES (?, ?, ?, ?, ?, 0)',
        practice.id,
        LOCAL_USER_ID,
        practice.domainId,
        practice.name,
        practice.description ?? null,
      );

      for (const [index, metric] of practice.metrics.entries()) {
        await targetDb.runAsync(
          `INSERT OR IGNORE INTO metrics
            (id, practice_id, name, metric_type, scale_min, scale_max, required, help_text, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          metric.id,
          practice.id,
          metric.name,
          metric.metricType,
          metric.scaleMin ?? null,
          metric.scaleMax ?? null,
          metric.required ? 1 : 0,
          metric.helpText ?? null,
          index + 1,
        );
      }

      await targetDb.runAsync(
        `INSERT OR IGNORE INTO practice_blockers (practice_id, blocker_id, enabled)
         SELECT ?, id, 0
         FROM blockers
         WHERE active = 1`,
        practice.id,
      );
      await targetDb.runAsync(
        `UPDATE practice_blockers
         SET enabled = 0,
          updated_at = CURRENT_TIMESTAMP
         WHERE practice_id = ?`,
        practice.id,
      );
    }

    for (const [id, routineId, practiceId, sectionId, sortOrder, required, displayName, helpText] of roshChodeshRoutinePractices) {
      await targetDb.runAsync(
        `INSERT OR IGNORE INTO routine_practices
          (id, routine_template_id, practice_id, review_section_id, sort_order, required, display_name_override, help_text_override)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        routineId,
        practiceId,
        sectionId,
        sortOrder,
        required,
        displayName,
        helpText,
      );
    }
  });
}

export async function resetDatabaseToSeedDefaults() {
  const db = await getDb();
  await db.execAsync(schemaSql);
  await db.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    await db.withTransactionAsync(async () => {
      for (const tableName of [...resetTableNames].reverse()) {
        await db.runAsync(`DELETE FROM ${tableName}`);
      }
    });
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
  await seedDatabase(db);
  await normalizeQualityScale(db);
  await normalizeReviewCompletionState(db);
}

export async function syncSeedUpdates(db: SQLite.SQLiteDatabase) {
  return;
  await seedDatabase(db);
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "UPDATE routine_templates SET name = 'Weekly Core', description = 'The stable core for regular review days', active = 1, priority = 0 WHERE id = 'routine_core'",
    );
    await db.runAsync("UPDATE routine_templates SET active = 1, priority = 20 WHERE id = 'routine_shabbos'");
    await db.runAsync(
      "UPDATE routine_templates SET active = 0 WHERE id IN ('routine_yeshiva_zman', 'routine_summer', 'routine_yom_tov', 'routine_travel', 'routine_sick')",
    );
    await db.runAsync(
      "UPDATE routine_schedules SET start_date = NULL, end_date = NULL, days_of_week = '[0,1,2,3,4,5,6]' WHERE id = 'schedule_core_all'",
    );
    await db.runAsync(
      "UPDATE routine_schedules SET start_date = NULL, end_date = NULL, days_of_week = '[6]' WHERE id = 'schedule_shabbos'",
    );
    await db.runAsync(
      "UPDATE review_sections SET name = 'Overview', description = 'All-day practices', sort_order = 40, active = 1 WHERE id = 'section_overall'",
    );
    await db.runAsync("UPDATE review_sections SET sort_order = 30, active = 1 WHERE id = 'section_night'");
    await db.runAsync("UPDATE review_sections SET active = 0 WHERE id = 'section_evening'");
    await db.runAsync(
      "UPDATE domains SET name = 'Other', description = 'General thoughts, reflections, and uncategorized practices', active = 1 WHERE id = 'domain_other'",
    );

    await db.runAsync(
      "UPDATE routine_schedules SET start_date = NULL, end_date = NULL, days_of_week = '[0,1,2,3,4]' WHERE id = 'schedule_yeshiva_zman'",
    );
    await db.runAsync("UPDATE routine_templates SET active = 0 WHERE id = 'routine_yom_tov'");

    await db.runAsync(
      `UPDATE metrics SET active = 0
       WHERE id IN (
        'metric_shacharit_status',
        'metric_mincha_status',
        'metric_maariv_status',
        'metric_shacharit_kavannah',
        'metric_mincha_kavannah',
        'metric_maariv_kavannah',
        'metric_eating_note',
        'metric_brachot_note',
        'metric_phone_note'
       )`,
    );

    await db.runAsync("UPDATE blockers SET active = 0 WHERE name IN ('Overeating', 'Yom Tov schedule')");

    await db.runAsync("UPDATE practices SET name = 'Positive' WHERE id = 'practice_positivity'");
    await db.runAsync("UPDATE practices SET name = 'Shacharis' WHERE id = 'practice_shacharit'");
    await db.runAsync("UPDATE practices SET name = 'Daily Avodah' WHERE id = 'practice_daily_avodah'");
    await db.runAsync("UPDATE practices SET name = 'Weekly Avodah' WHERE id = 'practice_weekly_avodah'");
    await db.runAsync(
      "UPDATE practices SET name = 'Thoughts and Reflections', description = 'Anything from the day that feels worth remembering or thinking through.', domain_id = 'domain_other', active = 1 WHERE id = 'practice_daily_thoughts'",
    );
    await db.runAsync("UPDATE metrics SET name = 'Thoughts and reflections' WHERE id = 'metric_daily_thoughts_text'");
    await db.runAsync("UPDATE practices SET active = 0 WHERE id IN ('practice_sleep', 'practice_reflection')");
    await db.runAsync("UPDATE routine_practices SET review_section_id = 'section_morning', sort_order = 10, enabled = 1, archived_from = NULL WHERE id = 'rp_no_phone_bed'");
    await db.runAsync("UPDATE routine_practices SET review_section_id = 'section_morning', sort_order = 20, enabled = 1, archived_from = NULL WHERE id = 'rp_modeh_ani'");
    await db.runAsync("UPDATE routine_practices SET review_section_id = 'section_morning', sort_order = 30, enabled = 1, archived_from = NULL WHERE id = 'rp_shacharit'");
    await db.runAsync("UPDATE routine_practices SET review_section_id = 'section_overall', sort_order = 10 WHERE id = 'rp_eating'");
    await db.runAsync("UPDATE routine_practices SET review_section_id = 'section_overall', sort_order = 110 WHERE id = 'rp_brachot'");
    await db.runAsync("UPDATE routine_practices SET review_section_id = 'section_overall', sort_order = 210 WHERE id = 'rp_positivity'");
    await db.runAsync("UPDATE routine_practices SET review_section_id = 'section_overall', sort_order = 220 WHERE id = 'rp_gratitude'");
    await db.runAsync("UPDATE routine_practices SET review_section_id = 'section_overall', sort_order = 310 WHERE id = 'rp_daily_avodah'");
    await db.runAsync("UPDATE routine_practices SET review_section_id = 'section_overall', sort_order = 320, enabled = 1, archived_from = NULL WHERE id = 'rp_daily_thoughts'");
    await db.runAsync("UPDATE routine_practices SET review_section_id = 'section_overall', sort_order = 310 WHERE id = 'rp_weekly_avodah'");
    await db.runAsync(
      `UPDATE routine_practices
       SET enabled = 0,
        archived_from = COALESCE(archived_from, '2026-06-01'),
        updated_at = CURRENT_TIMESTAMP
       WHERE id IN (
        'rp_no_snooze',
        'rp_mincha',
        'rp_maariv',
        'rp_shema',
        'rp_sleep',
        'rp_phone',
        'rp_complimentary',
        'rp_reflection',
        'rp_morning_seder',
        'rp_shiur',
        'rp_afternoon_seder',
        'rp_exercise_summer',
        'rp_low_capacity_sick',
        'rp_night_seder'
       )`,
    );
    await db.runAsync("UPDATE metrics SET sort_order = 0 WHERE id = 'metric_shiur_applicable'");
    await db.runAsync("UPDATE metrics SET sort_order = 1 WHERE id = 'metric_shiur_completed'");
    await db.runAsync("UPDATE metrics SET sort_order = 2 WHERE id = 'metric_shiur_focus'");
    await db.runAsync(
      `INSERT OR IGNORE INTO metrics
        (id, practice_id, name, metric_type, required, sort_order)
       VALUES ('metric_shiur_applicable', 'practice_shiur', 'Shiur today?', 'enum', 1, 0)`,
    );
    await db.runAsync(
      `INSERT OR IGNORE INTO metric_options (id, metric_id, label, value, sort_order)
       VALUES ('metric_shiur_applicable_yes', 'metric_shiur_applicable', 'Yes', 'yes', 1)`,
    );
    await db.runAsync(
      `INSERT OR IGNORE INTO metric_options (id, metric_id, label, value, sort_order)
       VALUES ('metric_shiur_applicable_not_applicable', 'metric_shiur_applicable', 'N/A', 'not_applicable', 2)`,
    );
    await db.runAsync("DELETE FROM metric_options WHERE id = 'metric_shiur_applicable_na'");
    await db.runAsync(
      `INSERT OR IGNORE INTO practices (id, user_id, domain_id, name, description)
       VALUES ('practice_positivity', ?, 'domain_middos', 'Positivity', NULL)`,
      LOCAL_USER_ID,
    );
    await db.runAsync(
      `INSERT OR IGNORE INTO metrics
        (id, practice_id, name, metric_type, scale_min, scale_max, sort_order)
       VALUES ('metric_positivity_quality', 'practice_positivity', 'Quality', 'scale', 1, 5, 1)`,
    );
    await db.runAsync(
      `INSERT OR IGNORE INTO routine_practices
        (id, routine_template_id, practice_id, review_section_id, sort_order, required)
       VALUES ('rp_positivity', 'routine_core', 'practice_positivity', 'section_overall', 210, 0)`,
    );
    await db.runAsync(
      `INSERT OR IGNORE INTO practices (id, user_id, domain_id, name, description)
       VALUES ('practice_complimentary', ?, 'domain_middos', 'Complimentary', NULL)`,
      LOCAL_USER_ID,
    );
    await db.runAsync(
      `INSERT OR IGNORE INTO metrics
        (id, practice_id, name, metric_type, scale_min, scale_max, sort_order)
       VALUES ('metric_complimentary_quality', 'practice_complimentary', 'Quality', 'scale', 1, 5, 1)`,
    );
    await db.runAsync(
      `INSERT OR IGNORE INTO routine_practices
        (id, routine_template_id, practice_id, review_section_id, sort_order, required)
       VALUES ('rp_complimentary', 'routine_core', 'practice_complimentary', 'section_overall', 220, 0)`,
    );
    await db.runAsync(
      `INSERT OR IGNORE INTO routine_practices
        (id, routine_template_id, practice_id, review_section_id, sort_order, required)
       VALUES ('rp_shiur', 'routine_yeshiva_zman', 'practice_shiur', 'section_afternoon', 20, 1)`,
    );
    await db.runAsync("UPDATE routine_practices SET review_section_id = 'section_afternoon', sort_order = 30 WHERE id = 'rp_afternoon_seder'");
    await db.runAsync('UPDATE routine_practices SET required = 0');
    await db.runAsync('UPDATE metrics SET required = 0');
    await db.runAsync('UPDATE practices SET allow_note = 1 WHERE allow_note IS NULL');
    await db.runAsync(
      "UPDATE practices SET allow_note = 0 WHERE id IN ('practice_gratitude', 'practice_daily_avodah', 'practice_weekly_avodah', 'practice_reflection', 'practice_daily_thoughts')",
    );
    await db.runAsync(
      `INSERT OR IGNORE INTO practice_blockers (practice_id, blocker_id, enabled)
       SELECT practice_id, blocker_id, 0
       FROM (
        SELECT 'practice_gratitude' as practice_id, id as blocker_id FROM blockers WHERE active = 1
        UNION ALL
        SELECT 'practice_daily_avodah' as practice_id, id as blocker_id FROM blockers WHERE active = 1
        UNION ALL
        SELECT 'practice_weekly_avodah' as practice_id, id as blocker_id FROM blockers WHERE active = 1
        UNION ALL
        SELECT 'practice_reflection' as practice_id, id as blocker_id FROM blockers WHERE active = 1
        UNION ALL
        SELECT 'practice_daily_thoughts' as practice_id, id as blocker_id FROM blockers WHERE active = 1
       )`,
    );
    await db.runAsync(
      `UPDATE practice_blockers
       SET enabled = 0,
        updated_at = CURRENT_TIMESTAMP
       WHERE practice_id IN ('practice_gratitude', 'practice_daily_avodah', 'practice_weekly_avodah')`,
    );
    await db.runAsync(
      `INSERT OR IGNORE INTO domains (id, user_id, name, description, sort_order)
       VALUES ('domain_current_avodah', ?, 'Current Avodah', 'The present point of growth for today and this week', 8)`,
      LOCAL_USER_ID,
    );
    await db.runAsync(
      `INSERT OR IGNORE INTO practices (id, user_id, domain_id, name, description, allow_note)
       VALUES ('practice_daily_avodah', ?, 'domain_current_avodah', 'Tomorrow''s avodah', 'Choose one thing to work on tomorrow.', 0)`,
      LOCAL_USER_ID,
    );
    await db.runAsync(
      `INSERT OR IGNORE INTO metrics
        (id, practice_id, name, metric_type, sort_order)
       VALUES ('metric_daily_avodah_text', 'practice_daily_avodah', 'Current avodah', 'text', 1)`,
    );
    await db.runAsync(
      `INSERT OR IGNORE INTO routine_practices
        (id, routine_template_id, practice_id, review_section_id, sort_order, required)
       VALUES ('rp_daily_avodah', 'routine_core', 'practice_daily_avodah', 'section_overall', 310, 0)`,
    );
    await db.runAsync(
      `INSERT OR IGNORE INTO practices (id, user_id, domain_id, name, description, allow_note)
       VALUES ('practice_weekly_avodah', ?, 'domain_current_avodah', 'Weekly avodah', 'Choose one thing to work on this week.', 0)`,
      LOCAL_USER_ID,
    );
    await db.runAsync(
      `INSERT OR IGNORE INTO metrics
        (id, practice_id, name, metric_type, sort_order)
       VALUES ('metric_weekly_avodah_text', 'practice_weekly_avodah', 'Current avodah', 'text', 1)`,
    );
    await db.runAsync(
      `INSERT OR IGNORE INTO routine_practices
        (id, routine_template_id, practice_id, review_section_id, sort_order, required)
       VALUES ('rp_weekly_avodah', 'routine_shabbos', 'practice_weekly_avodah', 'section_overall', 310, 0)`,
    );
    await db.runAsync(
      `INSERT OR IGNORE INTO practice_blockers (practice_id, blocker_id, enabled)
       SELECT 'practice_daily_avodah', id, 0
       FROM blockers
       WHERE active = 1`,
    );
    await db.runAsync(
      `INSERT OR IGNORE INTO practice_blockers (practice_id, blocker_id, enabled)
       SELECT 'practice_weekly_avodah', id, 0
       FROM blockers
       WHERE active = 1`,
    );
    await db.runAsync(
      `INSERT OR IGNORE INTO practice_blockers (practice_id, blocker_id, enabled)
       SELECT 'practice_reflection', id, 0
       FROM blockers
       WHERE active = 1`,
    );
    await db.runAsync(
      `INSERT OR IGNORE INTO practice_blockers (practice_id, blocker_id, enabled)
       SELECT 'practice_daily_thoughts', id, 0
       FROM blockers
       WHERE active = 1`,
    );
    await db.runAsync(
      `UPDATE practice_blockers
       SET enabled = 0,
        updated_at = CURRENT_TIMESTAMP
       WHERE practice_id IN ('practice_gratitude', 'practice_daily_avodah', 'practice_weekly_avodah', 'practice_reflection', 'practice_daily_thoughts')`,
    );
    await db.runAsync(
      `UPDATE routine_practices
       SET enabled = 0,
        archived_from = COALESCE(archived_from, '2026-06-01'),
        updated_at = CURRENT_TIMESTAMP
       WHERE id IN (
        'rp_no_snooze',
        'rp_mincha',
        'rp_maariv',
        'rp_shema',
        'rp_sleep',
        'rp_phone',
        'rp_complimentary',
        'rp_reflection',
        'rp_morning_seder',
        'rp_shiur',
        'rp_afternoon_seder',
        'rp_exercise_summer',
        'rp_low_capacity_sick',
        'rp_night_seder'
       )`,
    );
  });
}

const resetTableNames = [
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
