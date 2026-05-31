import type { SQLiteDatabase } from 'expo-sqlite';

import { todayIsoDate } from '@/src/utils/dates';

export async function normalizeReviewCompletionState(db: SQLiteDatabase) {
  await db.runAsync(
    `UPDATE daily_review_sessions
     SET completed_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
     WHERE completed_at IS NULL
      AND review_date < ?`,
    todayIsoDate(),
  );
}
