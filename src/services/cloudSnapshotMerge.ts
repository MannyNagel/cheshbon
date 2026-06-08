type Row = Record<string, unknown>;

export type SnapshotPayload = {
  exportedAt?: string;
  tables?: Partial<Record<TableName, Row[]>>;
};

type Snapshot = {
  exportedAt: string;
  tables: Record<TableName, Row[]>;
};

type TableName = (typeof tableNames)[number];

const tableNames = [
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
  'weekly_reports',
  'app_preferences',
] as const;

const logicalKeyColumns: Partial<Record<TableName, string[]>> = {
  routine_exceptions: ['routine_template_id', 'exception_date'],
  routine_practices: ['routine_template_id', 'practice_id'],
  daily_review_sessions: ['user_id', 'review_date'],
  daily_entries: ['user_id', 'practice_id', 'entry_date'],
  entry_metric_values: ['entry_id', 'metric_id'],
  practice_blockers: ['practice_id', 'blocker_id'],
  entry_blockers: ['entry_id', 'blocker_id'],
  weekly_reviews: ['user_id', 'week_start_date'],
  weekly_reports: ['user_id', 'week_start_date'],
  app_preferences: ['key'],
};

export function mergeCloudSnapshots(localInput: SnapshotPayload, cloudInput: SnapshotPayload | null | undefined): SnapshotPayload {
  const local = normalizeSnapshot(localInput);
  const cloud = cloudInput ? normalizeSnapshot(cloudInput) : emptySnapshot();
  const merged = emptySnapshot();

  const sessionMerge = mergeRows('daily_review_sessions', cloud.tables.daily_review_sessions, local.tables.daily_review_sessions);
  merged.tables.daily_review_sessions = sessionMerge.rows.map(mergeCompletedAtByReviewDate(cloud.tables.daily_review_sessions, local.tables.daily_review_sessions));

  const cloudEntries = remapRows(cloud.tables.daily_entries, 'review_session_id', sessionMerge.aliases);
  const localEntries = remapRows(local.tables.daily_entries, 'review_session_id', sessionMerge.aliases);
  const entryMerge = mergeRows('daily_entries', cloudEntries, localEntries);
  merged.tables.daily_entries = entryMerge.rows;

  const entryAliases = entryMerge.aliases;
  const mergedEntryUpdatedAt = new Map(
    merged.tables.daily_entries.map((row) => [stringValue(row.id), timestampForRow(row)]),
  );

  for (const tableName of tableNames) {
    if (tableName === 'daily_review_sessions' || tableName === 'daily_entries') continue;

    let cloudRows = cloud.tables[tableName];
    let localRows = local.tables[tableName];
    if (tableName === 'entry_metric_values' || tableName === 'entry_blockers') {
      cloudRows = remapRows(cloudRows, 'entry_id', entryAliases);
      localRows = remapRows(localRows, 'entry_id', entryAliases);
    }

    merged.tables[tableName] = mergeRows(tableName, cloudRows, localRows, (row) => {
      if ((tableName === 'entry_metric_values' || tableName === 'entry_blockers') && row.entry_id) {
        return mergedEntryUpdatedAt.get(stringValue(row.entry_id)) ?? 0;
      }
      return timestampForRow(row);
    }).rows;
  }

  merged.exportedAt = new Date().toISOString();
  return merged;
}

function normalizeSnapshot(input: SnapshotPayload): Snapshot {
  const normalized = emptySnapshot();
  normalized.exportedAt = typeof input.exportedAt === 'string' ? input.exportedAt : normalized.exportedAt;
  for (const tableName of tableNames) {
    const rows = input.tables?.[tableName];
    normalized.tables[tableName] = Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [];
  }
  return normalized;
}

function emptySnapshot(): Snapshot {
  const tables = {} as Record<TableName, Row[]>;
  for (const tableName of tableNames) {
    tables[tableName] = [];
  }
  return {
    exportedAt: new Date(0).toISOString(),
    tables,
  };
}

function mergeRows(
  tableName: TableName,
  cloudRows: Row[],
  localRows: Row[],
  timestampOverride?: (row: Row) => number,
) {
  const byKey = new Map<string, Row>();
  const candidates = [...cloudRows, ...localRows];

  for (const row of candidates) {
    const key = rowKey(tableName, row);
    const current = byKey.get(key);
    if (!current || compareRows(row, current, timestampOverride) >= 0) {
      byKey.set(key, { ...row });
    }
  }

  const aliases = new Map<string, string>();
  for (const row of candidates) {
    const id = stringValue(row.id);
    if (!id) continue;
    const winnerId = stringValue(byKey.get(rowKey(tableName, row))?.id);
    if (winnerId) aliases.set(id, winnerId);
  }

  return { rows: Array.from(byKey.values()), aliases };
}

function rowKey(tableName: TableName, row: Row) {
  const columns = logicalKeyColumns[tableName];
  if (columns) {
    const values = columns.map((column) => stringValue(row[column]));
    if (values.every(Boolean)) return values.join('|');
  }
  return stringValue(row.id) || stringValue(row.key) || JSON.stringify(row);
}

function compareRows(next: Row, current: Row, timestampOverride?: (row: Row) => number) {
  const nextTime = timestampOverride?.(next) ?? timestampForRow(next);
  const currentTime = timestampOverride?.(current) ?? timestampForRow(current);
  if (nextTime !== currentTime) return nextTime - currentTime;
  return 1;
}

function timestampForRow(row: Row) {
  return Math.max(
    timestampValue(row.updated_at),
    timestampValue(row.completed_at),
    timestampValue(row.created_at),
  );
}

function timestampValue(value: unknown) {
  if (typeof value !== 'string' || !value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function stringValue(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function remapRows(rows: Row[], column: string, aliases: Map<string, string>) {
  return rows.map((row) => {
    const current = stringValue(row[column]);
    const next = aliases.get(current);
    return next && next !== current ? { ...row, [column]: next } : { ...row };
  });
}

function mergeCompletedAtByReviewDate(cloudRows: Row[], localRows: Row[]) {
  const latestCompletedAt = new Map<string, string>();
  for (const row of [...cloudRows, ...localRows]) {
    const completedAt = stringValue(row.completed_at);
    if (!completedAt) continue;
    const key = rowKey('daily_review_sessions', row);
    const current = latestCompletedAt.get(key);
    if (!current || timestampValue(completedAt) > timestampValue(current)) {
      latestCompletedAt.set(key, completedAt);
    }
  }

  return (row: Row) => {
    const completedAt = latestCompletedAt.get(rowKey('daily_review_sessions', row));
    return completedAt ? { ...row, completed_at: completedAt } : row;
  };
}
