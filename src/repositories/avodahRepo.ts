import { LOCAL_USER_ID } from '@/src/constants/seedData';
import { getDb } from '@/src/db/client';
import type {
  AvodahDailyEntry,
  AvodahDecision,
  AvodahExperiment,
  AvodahExperimentStatus,
  AvodahExperimentType,
  AvodahResponse,
} from '@/src/models/types';
import { addDaysIso, dayOfWeek, isIsoDate, todayIsoDate } from '@/src/utils/dates';
import { makeId } from '@/src/utils/ids';

type ExperimentRow = {
  id: string;
  experiment_type: AvodahExperimentType;
  title: string;
  goal: string;
  hypothesis: string | null;
  behavior: string;
  start_date: string;
  review_date: string;
  status: AvodahExperimentStatus;
  opportunity_prompt: string;
  response_prompt: string;
  reflection_prompt: string | null;
  positive_label: string;
  partial_label: string;
  negative_label: string;
  parent_experiment_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type DailyEntryRow = {
  id: string;
  experiment_id: string;
  review_date: string;
  opportunity: number | null;
  response: AvodahResponse | null;
  reflection: string | null;
};

export type AvodahExperimentInput = {
  id?: string | null;
  type: AvodahExperimentType;
  title: string;
  goal: string;
  hypothesis?: string | null;
  behavior: string;
  startDate: string;
  reviewDate: string;
  status: AvodahExperimentStatus;
  opportunityPrompt: string;
  responsePrompt: string;
  reflectionPrompt?: string | null;
  positiveLabel?: string | null;
  partialLabel?: string | null;
  negativeLabel?: string | null;
  parentExperimentId?: string | null;
};

export type AvodahStats = {
  reviewedDays: number;
  opportunities: number;
  noOpportunity: number;
  didWell: number;
  mixed: number;
  missed: number;
  evidence: Array<{ date: string; reflection: string; response: AvodahResponse | null }>;
};

export type AvodahExperimentWithStats = AvodahExperiment & { stats: AvodahStats; finalReviewDue: boolean };

export type WeeklyCheshbon = {
  weekStart: string;
  win: string;
  pattern: string;
  keep: string;
  change: string;
};

export type WeeklyAvodahReflection = {
  experimentId: string;
  learning: string;
  decision: AvodahDecision | null;
};

export type FinalAvodahReview = {
  helped: 'yes' | 'partially' | 'no' | null;
  whatChanged: string;
  learned: string;
  decision: AvodahDecision;
};

export async function listAvodahExperiments(): Promise<AvodahExperimentWithStats[]> {
  const db = await getDb();
  await refreshExperimentLifecycle(db);
  const rows = await db.getAllAsync<ExperimentRow>(
    `SELECT * FROM avodah_experiments
     WHERE user_id = ?
     ORDER BY
      CASE status WHEN 'active' THEN 0 WHEN 'reviewing' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END,
      review_date DESC,
      created_at DESC`,
    LOCAL_USER_ID,
  );
  const stats = await getStatsForExperiments(rows.map((row) => row.id));
  const today = todayIsoDate();
  return rows.map((row) => ({
    ...mapExperiment(row),
    stats: stats.get(row.id) ?? emptyStats(),
    finalReviewDue: row.status === 'active' && row.review_date <= today,
  }));
}

export async function getAvodahExperiment(id: string): Promise<AvodahExperimentWithStats | null> {
  const db = await getDb();
  await refreshExperimentLifecycle(db);
  const row = await db.getFirstAsync<ExperimentRow>('SELECT * FROM avodah_experiments WHERE id = ? AND user_id = ?', id, LOCAL_USER_ID);
  if (!row) return null;
  const stats = await getStatsForExperiments([id]);
  return {
    ...mapExperiment(row),
    stats: stats.get(id) ?? emptyStats(),
    finalReviewDue: row.status === 'active' && row.review_date <= todayIsoDate(),
  };
}

export async function getActiveAvodahExperimentsForDate(reviewDate: string): Promise<AvodahExperiment[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ExperimentRow>(
    `SELECT * FROM avodah_experiments
     WHERE user_id = ?
      AND status IN ('active', 'reviewing', 'graduated', 'modified', 'abandoned')
      AND start_date <= ?
      AND review_date >= ?
     ORDER BY CASE experiment_type WHEN 'avodah' THEN 0 ELSE 1 END, created_at`,
    LOCAL_USER_ID,
    reviewDate,
    reviewDate,
  );
  return rows.map(mapExperiment);
}

export async function getCurrentAvodahExperiments(): Promise<AvodahExperimentWithStats[]> {
  const all = await listAvodahExperiments();
  return all.filter((experiment) => experiment.status === 'active');
}

export async function saveAvodahExperiment(input: AvodahExperimentInput) {
  const values = normalizeExperimentInput(input);
  const db = await getDb();
  if (values.status === 'active') {
    const conflict = await db.getFirstAsync<{ id: string; title: string }>(
      `SELECT id, title FROM avodah_experiments
       WHERE user_id = ? AND experiment_type = ? AND status = 'active' AND id <> ?
       LIMIT 1`,
      LOCAL_USER_ID,
      values.type,
      values.id ?? '',
    );
    if (conflict) {
      throw new Error(`Only one Current ${values.type === 'middah' ? 'Middah' : 'Avodah'} can be active. Finish or move “${conflict.title}” to draft first.`);
    }
  }

  const id = values.id ?? makeId('avodah');
  await db.runAsync(
    `INSERT INTO avodah_experiments
      (id, user_id, experiment_type, title, goal, hypothesis, behavior, start_date, review_date,
       status, opportunity_prompt, response_prompt, reflection_prompt, positive_label, partial_label,
       negative_label, parent_experiment_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
      experiment_type = excluded.experiment_type,
      title = excluded.title,
      goal = excluded.goal,
      hypothesis = excluded.hypothesis,
      behavior = excluded.behavior,
      start_date = excluded.start_date,
      review_date = excluded.review_date,
      status = excluded.status,
      opportunity_prompt = excluded.opportunity_prompt,
      response_prompt = excluded.response_prompt,
      reflection_prompt = excluded.reflection_prompt,
      positive_label = excluded.positive_label,
      partial_label = excluded.partial_label,
      negative_label = excluded.negative_label,
      parent_experiment_id = COALESCE(avodah_experiments.parent_experiment_id, excluded.parent_experiment_id),
      updated_at = CURRENT_TIMESTAMP`,
    id,
    LOCAL_USER_ID,
    values.type,
    values.title,
    values.goal,
    values.hypothesis,
    values.behavior,
    values.startDate,
    values.reviewDate,
    values.status,
    values.opportunityPrompt,
    values.responsePrompt,
    values.reflectionPrompt,
    values.positiveLabel,
    values.partialLabel,
    values.negativeLabel,
    values.parentExperimentId,
  );
  return id;
}

export async function getAvodahEntriesForDate(reviewDate: string) {
  const db = await getDb();
  const rows = await db.getAllAsync<DailyEntryRow>(
    `SELECT id, experiment_id, review_date, opportunity, response, reflection
     FROM avodah_daily_entries
     WHERE user_id = ? AND review_date = ?`,
    LOCAL_USER_ID,
    reviewDate,
  );
  return Object.fromEntries(rows.map((row) => [row.experiment_id, mapDailyEntry(row)]));
}

export async function getWeeklyCheshbon(weekStart = halachicWeekStart(todayIsoDate())) {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    what_went_well: string | null;
    pattern_noticed: string | null;
    keep_doing: string | null;
    change_next_week: string | null;
  }>(
    `SELECT what_went_well, pattern_noticed, keep_doing, change_next_week
     FROM weekly_reviews WHERE user_id = ? AND week_start_date = ?`,
    LOCAL_USER_ID,
    weekStart,
  );
  return {
    weekStart,
    win: row?.what_went_well ?? '',
    pattern: row?.pattern_noticed ?? '',
    keep: row?.keep_doing ?? '',
    change: row?.change_next_week ?? '',
  } satisfies WeeklyCheshbon;
}

export async function getWeeklyAvodahData(weekStart = halachicWeekStart(todayIsoDate())) {
  const db = await getDb();
  const weekEnd = addDaysIso(weekStart, 6);
  const experiments = await db.getAllAsync<ExperimentRow>(
    `SELECT * FROM avodah_experiments
     WHERE user_id = ?
      AND start_date <= ?
      AND review_date >= ?
      AND status IN ('active', 'reviewing', 'graduated', 'modified', 'abandoned')
     ORDER BY CASE experiment_type WHEN 'avodah' THEN 0 ELSE 1 END`,
    LOCAL_USER_ID,
    weekEnd,
    weekStart,
  );
  const weeklyRows = await db.getAllAsync<{ experiment_id: string; learning: string | null; decision: AvodahDecision | null }>(
    `SELECT experiment_id, learning, decision FROM avodah_weekly_reviews
     WHERE user_id = ? AND week_start_date = ?`,
    LOCAL_USER_ID,
    weekStart,
  );
  const reflections = new Map(weeklyRows.map((row) => [row.experiment_id, row]));
  const stats = await getStatsForExperiments(experiments.map((row) => row.id), weekStart, weekEnd);
  return experiments.map((row) => ({
    experiment: mapExperiment(row),
    stats: stats.get(row.id) ?? emptyStats(),
    learning: reflections.get(row.id)?.learning ?? '',
    decision: reflections.get(row.id)?.decision ?? null,
  }));
}

export async function saveWeeklyCheshbon(
  review: WeeklyCheshbon,
  experimentReviews: WeeklyAvodahReflection[],
) {
  const db = await getDb();
  let successorId: string | null = null;
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO weekly_reviews
        (id, user_id, week_start_date, what_went_well, pattern_noticed, keep_doing, change_next_week)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, week_start_date) DO UPDATE SET
        what_went_well = excluded.what_went_well,
        pattern_noticed = excluded.pattern_noticed,
        keep_doing = excluded.keep_doing,
        change_next_week = excluded.change_next_week,
        updated_at = CURRENT_TIMESTAMP`,
      makeId('weekly_review'),
      LOCAL_USER_ID,
      review.weekStart,
      clean(review.win),
      clean(review.pattern),
      clean(review.keep),
      clean(review.change),
    );
    for (const item of experimentReviews) {
      const nextSuccessor = item.decision === 'modify' ? await cloneExperimentAsDraft(db, item.experimentId) : null;
      successorId = successorId ?? nextSuccessor;
      await db.runAsync(
        `INSERT INTO avodah_weekly_reviews
          (id, user_id, experiment_id, week_start_date, learning, decision, successor_experiment_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, experiment_id, week_start_date) DO UPDATE SET
          learning = excluded.learning,
          decision = excluded.decision,
          successor_experiment_id = COALESCE(excluded.successor_experiment_id, avodah_weekly_reviews.successor_experiment_id),
          updated_at = CURRENT_TIMESTAMP`,
        makeId('avodah_weekly'),
        LOCAL_USER_ID,
        item.experimentId,
        review.weekStart,
        clean(item.learning),
        item.decision,
        nextSuccessor,
      );
      await applyDecision(db, item.experimentId, item.decision);
    }
  });
  return { successorId };
}

export async function getFinalAvodahReview(experimentId: string) {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    helped: 'yes' | 'partially' | 'no' | null;
    what_changed: string | null;
    learned: string | null;
    decision: AvodahDecision;
  }>('SELECT helped, what_changed, learned, decision FROM avodah_final_reviews WHERE user_id = ? AND experiment_id = ?', LOCAL_USER_ID, experimentId);
  return row ? {
    helped: row.helped,
    whatChanged: row.what_changed ?? '',
    learned: row.learned ?? '',
    decision: row.decision,
  } : null;
}

export async function saveFinalAvodahReview(experimentId: string, review: FinalAvodahReview) {
  const db = await getDb();
  let successorId: string | null = null;
  await db.withTransactionAsync(async () => {
    successorId = review.decision === 'modify' ? await cloneExperimentAsDraft(db, experimentId) : null;
    await db.runAsync(
      `INSERT INTO avodah_final_reviews
        (id, user_id, experiment_id, helped, what_changed, learned, decision, successor_experiment_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, experiment_id) DO UPDATE SET
        helped = excluded.helped,
        what_changed = excluded.what_changed,
        learned = excluded.learned,
        decision = excluded.decision,
        successor_experiment_id = COALESCE(excluded.successor_experiment_id, avodah_final_reviews.successor_experiment_id),
        updated_at = CURRENT_TIMESTAMP`,
      makeId('avodah_final'),
      LOCAL_USER_ID,
      experimentId,
      review.helped,
      clean(review.whatChanged),
      clean(review.learned),
      review.decision,
      successorId,
    );
    await applyDecision(db, experimentId, review.decision);
  });
  return { successorId };
}

export async function continueAvodahExperiment(experimentId: string, nextReviewDate: string) {
  if (!isIsoDate(nextReviewDate) || nextReviewDate <= todayIsoDate()) throw new Error('Choose a future review date.');
  const db = await getDb();
  const experiment = await getAvodahExperiment(experimentId);
  if (!experiment) throw new Error('Avodah experiment not found.');
  const conflict = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM avodah_experiments
     WHERE user_id = ? AND experiment_type = ? AND status = 'active' AND id <> ?`,
    LOCAL_USER_ID,
    experiment.type,
    experimentId,
  );
  if (conflict) throw new Error(`Another Current ${experiment.type === 'middah' ? 'Middah' : 'Avodah'} is already active.`);
  await db.runAsync(
    `UPDATE avodah_experiments
     SET status = 'active', review_date = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND user_id = ?`,
    nextReviewDate,
    experimentId,
    LOCAL_USER_ID,
  );
}

export function halachicWeekStart(date: string) {
  const delta = (dayOfWeek(date) - 6 + 7) % 7;
  return addDaysIso(date, -delta);
}

async function refreshExperimentLifecycle(db: Awaited<ReturnType<typeof getDb>>) {
  await db.runAsync(
    `UPDATE avodah_experiments
     SET status = 'reviewing', updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ? AND status = 'active' AND review_date < ?`,
    LOCAL_USER_ID,
    todayIsoDate(),
  );
}

async function getStatsForExperiments(ids: string[], startDate?: string, endDate?: string) {
  const stats = new Map<string, AvodahStats>();
  if (!ids.length) return stats;
  const db = await getDb();
  const filters = [
    `experiment_id IN (${ids.map(() => '?').join(',')})`,
    startDate ? 'review_date >= ?' : null,
    endDate ? 'review_date <= ?' : null,
  ].filter(Boolean).join(' AND ');
  const params: Array<string> = [...ids];
  if (startDate) params.push(startDate);
  if (endDate) params.push(endDate);
  const rows = await db.getAllAsync<DailyEntryRow>(
    `SELECT id, experiment_id, review_date, opportunity, response, reflection
     FROM avodah_daily_entries WHERE ${filters}
     ORDER BY review_date DESC`,
    params,
  );
  for (const id of ids) stats.set(id, emptyStats());
  for (const row of rows) {
    const item = stats.get(row.experiment_id) ?? emptyStats();
    item.reviewedDays += 1;
    if (row.opportunity === 1) item.opportunities += 1;
    if (row.opportunity === 0) item.noOpportunity += 1;
    if (row.response === 'did_well') item.didWell += 1;
    if (row.response === 'mixed') item.mixed += 1;
    if (row.response === 'missed') item.missed += 1;
    if (row.reflection?.trim()) item.evidence.push({ date: row.review_date, reflection: row.reflection.trim(), response: row.response });
    stats.set(row.experiment_id, item);
  }
  return stats;
}

async function cloneExperimentAsDraft(db: Awaited<ReturnType<typeof getDb>>, experimentId: string) {
  const source = await db.getFirstAsync<ExperimentRow>('SELECT * FROM avodah_experiments WHERE id = ? AND user_id = ?', experimentId, LOCAL_USER_ID);
  if (!source) return null;
  const existing = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM avodah_experiments
     WHERE parent_experiment_id = ? AND status = 'draft'
     ORDER BY created_at DESC LIMIT 1`,
    experimentId,
  );
  if (existing) return existing.id;
  const id = makeId('avodah');
  const duration = Math.max(7, daysBetween(source.start_date, source.review_date));
  const startDate = todayIsoDate();
  await db.runAsync(
    `INSERT INTO avodah_experiments
      (id, user_id, experiment_type, title, goal, hypothesis, behavior, start_date, review_date,
       status, opportunity_prompt, response_prompt, reflection_prompt, positive_label, partial_label,
       negative_label, parent_experiment_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)`,
    id,
    LOCAL_USER_ID,
    source.experiment_type,
    source.title,
    source.goal,
    source.hypothesis,
    source.behavior,
    startDate,
    addDaysIso(startDate, duration),
    source.opportunity_prompt,
    source.response_prompt,
    source.reflection_prompt,
    source.positive_label,
    source.partial_label,
    source.negative_label,
    source.id,
  );
  return id;
}

async function applyDecision(db: Awaited<ReturnType<typeof getDb>>, experimentId: string, decision: AvodahDecision | null) {
  if (!decision || decision === 'continue') return;
  const status: AvodahExperimentStatus = decision === 'graduate' ? 'graduated' : decision === 'modify' ? 'modified' : 'abandoned';
  await db.runAsync(
    'UPDATE avodah_experiments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
    status,
    experimentId,
    LOCAL_USER_ID,
  );
}

function normalizeExperimentInput(input: AvodahExperimentInput) {
  const title = input.title.trim();
  const goal = input.goal.trim();
  const behavior = input.behavior.trim();
  const opportunityPrompt = input.opportunityPrompt.trim();
  const responsePrompt = input.responsePrompt.trim();
  if (!title || !goal || !behavior) throw new Error('Title, goal, and behavior are required.');
  if (!opportunityPrompt || !responsePrompt) throw new Error('Both daily review questions are required.');
  if (!isIsoDate(input.startDate) || !isIsoDate(input.reviewDate) || input.reviewDate < input.startDate) {
    throw new Error('Choose valid start and review dates.');
  }
  return {
    ...input,
    title,
    goal,
    behavior,
    hypothesis: clean(input.hypothesis),
    opportunityPrompt,
    responsePrompt,
    reflectionPrompt: clean(input.reflectionPrompt),
    positiveLabel: input.positiveLabel?.trim() || 'Did well',
    partialLabel: input.partialLabel?.trim() || 'Mixed',
    negativeLabel: input.negativeLabel?.trim() || 'Missed the opportunity',
    parentExperimentId: input.parentExperimentId || null,
  };
}

function mapExperiment(row: ExperimentRow): AvodahExperiment {
  return {
    id: row.id,
    type: row.experiment_type,
    title: row.title,
    goal: row.goal,
    hypothesis: row.hypothesis,
    behavior: row.behavior,
    startDate: row.start_date,
    reviewDate: row.review_date,
    status: row.status,
    opportunityPrompt: row.opportunity_prompt,
    responsePrompt: row.response_prompt,
    reflectionPrompt: row.reflection_prompt,
    positiveLabel: row.positive_label,
    partialLabel: row.partial_label,
    negativeLabel: row.negative_label,
    parentExperimentId: row.parent_experiment_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDailyEntry(row: DailyEntryRow): AvodahDailyEntry {
  return {
    id: row.id,
    experimentId: row.experiment_id,
    reviewDate: row.review_date,
    opportunity: row.opportunity == null ? null : row.opportunity === 1,
    response: row.response,
    reflection: row.reflection,
  };
}

function emptyStats(): AvodahStats {
  return { reviewedDays: 0, opportunities: 0, noOpportunity: 0, didWell: 0, mixed: 0, missed: 0, evidence: [] };
}

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function daysBetween(start: string, end: string) {
  const startDate = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);
  return Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000);
}
