import { getDb } from '@/src/db/client';
import type { TrendSummary } from '@/src/models/types';
import { daysAgoIso } from '@/src/utils/dates';

type DomainAverageRow = {
  domain_id: string;
  domain_name: string;
  avg_value: number | null;
};

export async function getTrendSummary(): Promise<TrendSummary> {
  const db = await getDb();
  const start7 = daysAgoIso(6);
  const start30 = daysAgoIso(29);

  const [avg7, avg30, completionByPractice, qualityByPractice, commonBlockers] = await Promise.all([
    db.getAllAsync<DomainAverageRow>(domainAverageSql, start7),
    db.getAllAsync<DomainAverageRow>(domainAverageSql, start30),
    db.getAllAsync<{
      practice_id: string;
      practice_name: string;
      completed: number;
      tracked: number;
    }>(
      `SELECT p.id as practice_id, p.name as practice_name,
        SUM(CASE WHEN de.status = 'done' OR emv.value_boolean = 1 THEN 1 ELSE 0 END) as completed,
        COUNT(DISTINCT de.id) as tracked
       FROM daily_entries de
       JOIN practices p ON p.id = de.practice_id
       LEFT JOIN entry_metric_values emv ON emv.entry_id = de.id
       WHERE de.entry_date >= ?
       GROUP BY p.id, p.name
       HAVING tracked > 0
       ORDER BY practice_name`,
      start30,
    ),
    db.getAllAsync<{
      practice_id: string;
      practice_name: string;
      average: number;
      sample_size: number;
    }>(
      `SELECT p.id as practice_id, p.name as practice_name, AVG(emv.value_number) as average, COUNT(*) as sample_size
       FROM entry_metric_values emv
       JOIN metrics m ON m.id = emv.metric_id
       JOIN practices p ON p.id = m.practice_id
       JOIN daily_entries de ON de.id = emv.entry_id
       WHERE emv.value_number IS NOT NULL
        AND m.metric_type = 'scale'
        AND lower(m.name) LIKE '%quality%'
        AND de.entry_date >= ?
       GROUP BY p.id, p.name
       ORDER BY average DESC`,
      start30,
    ),
    db.getAllAsync<{
      blocker_id: string;
      blocker_name: string;
      count: number;
    }>(
      `SELECT b.id as blocker_id, b.name as blocker_name, COUNT(*) as count
       FROM entry_blockers eb
       JOIN blockers b ON b.id = eb.blocker_id
       JOIN daily_entries de ON de.id = eb.entry_id
       WHERE de.entry_date >= ?
       GROUP BY b.id, b.name
       ORDER BY count DESC, b.name
       LIMIT 8`,
      start30,
    ),
  ]);

  const avg30ByDomain = new Map(avg30.map((row) => [row.domain_id, row]));
  const domainAverages = avg7.map((row) => {
    const thirty = avg30ByDomain.get(row.domain_id);
    const seven = row.avg_value == null ? null : round1(row.avg_value);
    const thirtyValue = thirty?.avg_value == null ? null : round1(thirty.avg_value);
    const direction: 'up' | 'down' | 'steady' | 'insufficient' =
      seven == null || thirtyValue == null
        ? 'insufficient'
        : Math.abs(seven - thirtyValue) < 0.25
          ? 'steady'
          : seven > thirtyValue
            ? 'up'
            : 'down';
    return {
      domainId: row.domain_id,
      domainName: row.domain_name,
      average7: seven,
      average30: thirtyValue,
      direction,
    };
  });

  return {
    domainAverages,
    completionByPractice: completionByPractice.map((row) => ({
      practiceId: row.practice_id,
      practiceName: row.practice_name,
      completionRate: row.tracked ? Math.round((row.completed / row.tracked) * 100) : 0,
      trackedCount: row.tracked,
    })),
    qualityByPractice: qualityByPractice.map((row) => ({
      practiceId: row.practice_id,
      practiceName: row.practice_name,
      average: round1(row.average),
      sampleSize: row.sample_size,
    })),
    commonBlockers: commonBlockers.map((row) => ({
      blockerId: row.blocker_id,
      blockerName: row.blocker_name,
      count: row.count,
    })),
  };
}

const domainAverageSql = `
  SELECT d.id as domain_id, d.name as domain_name, AVG(emv.value_number) as avg_value
  FROM entry_metric_values emv
  JOIN metrics m ON m.id = emv.metric_id
  JOIN practices p ON p.id = m.practice_id
  JOIN domains d ON d.id = p.domain_id
  JOIN daily_entries de ON de.id = emv.entry_id
  WHERE emv.value_number IS NOT NULL
    AND m.metric_type = 'scale'
    AND de.entry_date >= ?
  GROUP BY d.id, d.name
  ORDER BY d.sort_order
`;

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
