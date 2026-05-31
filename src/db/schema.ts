export const schemaSql = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS domains (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS practices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  domain_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  default_frequency TEXT NOT NULL DEFAULT 'daily',
  allow_note INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (domain_id) REFERENCES domains(id)
);

CREATE TABLE IF NOT EXISTS metrics (
  id TEXT PRIMARY KEY,
  practice_id TEXT NOT NULL,
  name TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  scale_min INTEGER,
  scale_max INTEGER,
  required INTEGER NOT NULL DEFAULT 0,
  help_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (practice_id) REFERENCES practices(id)
);

CREATE TABLE IF NOT EXISTS metric_options (
  id TEXT PRIMARY KEY,
  metric_id TEXT NOT NULL,
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (metric_id) REFERENCES metrics(id)
);

CREATE TABLE IF NOT EXISTS routine_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  routine_type TEXT NOT NULL DEFAULT 'custom',
  priority INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS routine_schedules (
  id TEXT PRIMARY KEY,
  routine_template_id TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  days_of_week TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (routine_template_id) REFERENCES routine_templates(id)
);

CREATE TABLE IF NOT EXISTS routine_exceptions (
  id TEXT PRIMARY KEY,
  routine_template_id TEXT NOT NULL,
  exception_date TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (routine_template_id) REFERENCES routine_templates(id),
  UNIQUE(routine_template_id, exception_date)
);

CREATE TABLE IF NOT EXISTS review_sections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS routine_practices (
  id TEXT PRIMARY KEY,
  routine_template_id TEXT NOT NULL,
  practice_id TEXT NOT NULL,
  review_section_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  required INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  archived_from TEXT,
  display_name_override TEXT,
  help_text_override TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (routine_template_id) REFERENCES routine_templates(id),
  FOREIGN KEY (practice_id) REFERENCES practices(id),
  FOREIGN KEY (review_section_id) REFERENCES review_sections(id),
  UNIQUE(routine_template_id, practice_id)
);

CREATE TABLE IF NOT EXISTS daily_review_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  review_date TEXT NOT NULL,
  general_day_rating INTEGER,
  bed_time TEXT,
  wake_time TEXT,
  main_win TEXT,
  main_struggle TEXT,
  pattern_noticed TEXT,
  adjustment_for_tomorrow TEXT,
  note TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, review_date)
);

CREATE TABLE IF NOT EXISTS daily_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  review_session_id TEXT NOT NULL,
  practice_id TEXT NOT NULL,
  entry_date TEXT NOT NULL,
  status TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (review_session_id) REFERENCES daily_review_sessions(id),
  FOREIGN KEY (practice_id) REFERENCES practices(id),
  UNIQUE(user_id, practice_id, entry_date)
);

CREATE TABLE IF NOT EXISTS entry_metric_values (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  metric_id TEXT NOT NULL,
  value_boolean INTEGER,
  value_number REAL,
  value_text TEXT,
  value_json TEXT,
  FOREIGN KEY (entry_id) REFERENCES daily_entries(id),
  FOREIGN KEY (metric_id) REFERENCES metrics(id),
  UNIQUE(entry_id, metric_id)
);

CREATE TABLE IF NOT EXISTS blockers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS practice_blockers (
  practice_id TEXT NOT NULL,
  blocker_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (practice_id, blocker_id),
  FOREIGN KEY (practice_id) REFERENCES practices(id),
  FOREIGN KEY (blocker_id) REFERENCES blockers(id)
);

CREATE TABLE IF NOT EXISTS entry_blockers (
  entry_id TEXT NOT NULL,
  blocker_id TEXT NOT NULL,
  PRIMARY KEY (entry_id, blocker_id),
  FOREIGN KEY (entry_id) REFERENCES daily_entries(id),
  FOREIGN KEY (blocker_id) REFERENCES blockers(id)
);

CREATE TABLE IF NOT EXISTS weekly_reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  week_start_date TEXT NOT NULL,
  what_went_well TEXT,
  what_needs_work TEXT,
  pattern_noticed TEXT,
  one_kabbalah TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_practices_user_id ON practices(user_id);
CREATE INDEX IF NOT EXISTS idx_practices_domain_id ON practices(domain_id);
CREATE INDEX IF NOT EXISTS idx_metrics_practice_id ON metrics(practice_id);
CREATE INDEX IF NOT EXISTS idx_metric_options_metric_id ON metric_options(metric_id);
CREATE INDEX IF NOT EXISTS idx_routine_schedules_routine_id ON routine_schedules(routine_template_id);
CREATE INDEX IF NOT EXISTS idx_routine_exceptions_routine_date ON routine_exceptions(routine_template_id, exception_date);
CREATE INDEX IF NOT EXISTS idx_routine_practices_routine_id ON routine_practices(routine_template_id);
CREATE INDEX IF NOT EXISTS idx_routine_practices_practice_id ON routine_practices(practice_id);
CREATE INDEX IF NOT EXISTS idx_daily_review_sessions_user_date ON daily_review_sessions(user_id, review_date);
CREATE INDEX IF NOT EXISTS idx_daily_entries_user_date ON daily_entries(user_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_daily_entries_practice_date ON daily_entries(practice_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_entry_metric_values_entry_id ON entry_metric_values(entry_id);
CREATE INDEX IF NOT EXISTS idx_practice_blockers_practice_id ON practice_blockers(practice_id);
CREATE INDEX IF NOT EXISTS idx_entry_blockers_entry_id ON entry_blockers(entry_id);
`;
