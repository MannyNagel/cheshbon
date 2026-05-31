import type { SQLiteDatabase } from 'expo-sqlite';

export async function normalizeQualityScale(db: SQLiteDatabase) {
  const legacyScaleRows = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM metrics
     WHERE metric_type = 'scale'
      AND COALESCE(scale_max, 10) > 5`,
  );

  if ((legacyScaleRows?.count ?? 0) > 0) {
    await db.runAsync(
      `UPDATE entry_metric_values
       SET value_number = MIN(5, MAX(1, ROUND(value_number / 2.0)))
       WHERE value_number IS NOT NULL
        AND metric_id IN (
          SELECT id FROM metrics WHERE metric_type = 'scale'
        )`,
    );
  }

  await db.runAsync(
    `UPDATE metrics
     SET scale_min = 1,
      scale_max = 5,
      updated_at = CURRENT_TIMESTAMP
     WHERE metric_type = 'scale'`,
  );
}
