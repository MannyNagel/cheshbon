# Cheshbon Hanefesh App — Codex Project Spec

## 1. Project Summary

Build a personal **cheshbon hanefesh** tracking app. This is not a generic habit tracker. The app tracks both:

1. **Completion** — Did I do the practice?
2. **Quality** — How well did I do it?
3. **Context** — What helped or blocked me?
4. **Reflection** — What patterns should I notice and act on?

The current proof of concept is a Google Form / Google Sheet. The app is the next evolution: more flexible organization, scheduled routines, reminders, better metrics, trend analysis, and a more thoughtful nightly review flow.

The user fills out the app **at night**, reviewing the day in chronological order. The app should therefore optimize for a calm nightly review experience rather than real-time habit check-ins throughout the day.

## 2. Core Product Philosophy

This app should support honest spiritual growth, not obsessive self-judgment.

Design principles:

- The goal is **clarity**, not guilt.
- Avoid gamification that cheapens avodas Hashem.
- Avoid one simplistic “spiritual score” in v1.
- Track both objective completion and subjective quality.
- Let the user notice patterns over time.
- Make notes optional so daily use stays low-friction.
- Let routines change by life context: yeshiva zman, summer, Shabbos, Yom Tov, travel, sick day, etc.
- Keep practices stable over time so historical data remains meaningful.
- Treat all data as highly private.

Good analogy: this app is like a **siddur with inserts**. There is a year-round core, and then overlays for special contexts like Shabbos, Yom Tov, yeshiva zman, summer, travel, or low-capacity days.

## 3. Recommended Stack

Use this stack for v1:

- **Expo**
- **React Native**
- **TypeScript**
- **Expo Router**
- **SQLite local database first**
- **Supabase later for auth, sync, backup, and cross-device use**
- **Expo Notifications later for reminders**
- **Charts later for metrics and trends**

Do not start with Supabase authentication until the local app flow works.

Do not start with AI summaries. Add them only after the schema and UX are stable, and only with explicit privacy design.

## 4. Important Architectural Rule

Separate these concepts:

```text
Practices = permanent things the user may track
Routines = contextual packages of practices
Schedules = when routines apply
Review sections = chronological order for nightly review
Domains = spiritual/analytic categories
Metrics = how a practice is measured
Entries = what happened on a given date
```

This separation is crucial.

Example:

```text
Practice: Shacharit
Domain: Tefillah & Brachot
Routine: Year-Round Core
Review Section: Morning
Metrics: status, quality, kavannah, on_time
```

Another example:

```text
Practice: Morning Seder
Domain: Torah Learning
Routine: Yeshiva Zman
Schedule: Sunday–Thursday during yeshiva dates
Review Section: Morning
Metrics: completed, focus_quality, phone_responsibility, note
```

Do not hard-code categories directly into screens. Use seed data.

## 5. Current Google Form Concepts to Preserve

Visible current items from the proof-of-concept form include:

- Said Kriat Shema al hamitah
- Said Modeh Ani
- Did not snooze alarm
- Did not check phone in bed
- Shacharit quality
- Mincha quality
- Maariv quality
- Eating quality
- Brachot quality
- Phone/computer use quality

These should become seed practices and metrics.

Important definitions from the current form:

- Eating quality includes health, portioning, and timing.
- Brachot quality includes saying brachot with kavannah and remembering after-brachot.
- Phone/computer use includes staying off the phone as much as possible and avoiding distractions.

## 6. Data Model Overview

The schema should support:

- Master practice library
- Flexible metrics per practice
- Enum metric options
- Scheduled routine overlays
- Routine exceptions
- Chronological nightly review sections
- Daily review sessions
- Daily practice entries
- Flexible metric values
- Blockers
- Weekly reviews

Tables:

```text
domains
practices
metrics
metric_options
routine_templates
routine_schedules
routine_exceptions
review_sections
routine_practices
daily_review_sessions
daily_entries
entry_metric_values
blockers
entry_blockers
weekly_reviews
```

Use SQLite-compatible SQL for v1. Booleans should use INTEGER values: 0 = false, 1 = true. Dates should use ISO `YYYY-MM-DD` strings. Timestamps can use SQLite `CURRENT_TIMESTAMP`.

## 7. Schema

### 7.1 domains

Domains are used for analytics and spiritual grouping. They are not the same thing as chronological review order.

```sql
CREATE TABLE domains (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  name TEXT NOT NULL,
  description TEXT,

  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Initial domains:

```text
Tefillah & Brachot
Torah Learning
Technology & Kedushah
Health & Self-Mastery
Middos
Bein Adam L’chaveiro
Marriage / Family
Morning & Night Foundations
Seasonal Avodah
```

### 7.2 practices

Practices are the permanent task library. A practice should not be duplicated just because it appears in multiple routines.

```sql
CREATE TABLE practices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  domain_id TEXT NOT NULL,

  name TEXT NOT NULL,
  description TEXT,

  default_frequency TEXT NOT NULL DEFAULT 'daily',
  active INTEGER NOT NULL DEFAULT 1,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (domain_id) REFERENCES domains(id)
);
```

Example practices:

```text
Modeh Ani
Shacharit
Mincha
Maariv
Kriat Shema al hamitah
Brachot
Eating
Phone & computer use
Morning seder
Afternoon seder
Night seder
Exercise
Sefirat HaOmer
Simchat Yom Tov
```

### 7.3 metrics

Metrics define how a practice is measured.

```sql
CREATE TABLE metrics (
  id TEXT PRIMARY KEY,
  practice_id TEXT NOT NULL,

  name TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  -- boolean, scale, number, text, enum

  scale_min INTEGER,
  scale_max INTEGER,

  required INTEGER NOT NULL DEFAULT 0,
  help_text TEXT,

  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,

  FOREIGN KEY (practice_id) REFERENCES practices(id)
);
```

Metric types:

```text
boolean
scale
number
text
enum
```

Examples:

```text
For Modeh Ani:
- completed: boolean

For Shacharit:
- status: enum
- quality: scale 1–10
- kavannah: scale 1–10
- on_time: boolean

For Eating:
- quality: scale 1–10
- note: text

For Phone & Computer Use:
- quality: scale 1–10
- note: text
```

### 7.4 metric_options

Used for enum-style metrics.

```sql
CREATE TABLE metric_options (
  id TEXT PRIMARY KEY,
  metric_id TEXT NOT NULL,

  label TEXT NOT NULL,
  value TEXT NOT NULL,

  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,

  FOREIGN KEY (metric_id) REFERENCES metrics(id)
);
```

Recommended status options:

```text
done
partial
missed
not_applicable
skipped
```

Definitions:

```text
done = I did it
partial = I did it incompletely
missed = I should have done it and did not
not_applicable = it genuinely did not apply today
skipped = I chose not to track it today
```

### 7.5 routine_templates

A routine is a context of life.

```sql
CREATE TABLE routine_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  name TEXT NOT NULL,
  description TEXT,

  routine_type TEXT NOT NULL DEFAULT 'custom',
  -- core, zman, seasonal, holiday, shabbos, travel, custom

  priority INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Initial routines:

```text
Year-Round Core
Yeshiva Zman
Summer
Shabbos / Yom Tov
Travel / Disrupted Schedule
Sick Day / Low Capacity
```

Priority rule:

```text
Higher-priority routines can override display names/help text from lower-priority routines.
```

Suggested priority order:

```text
Year-Round Core: 0
Yeshiva Zman / Summer / Bein Hazmanim: 10
Shabbos / Yom Tov: 20
Travel / Disrupted Schedule: 40
Sick Day / Low Capacity: 50
```

### 7.6 routine_schedules

Schedules determine when a routine applies.

```sql
CREATE TABLE routine_schedules (
  id TEXT PRIMARY KEY,
  routine_template_id TEXT NOT NULL,

  start_date TEXT,
  end_date TEXT,

  days_of_week TEXT NOT NULL,
  -- JSON array:
  -- 0 = Sunday
  -- 1 = Monday
  -- 2 = Tuesday
  -- 3 = Wednesday
  -- 4 = Thursday
  -- 5 = Friday
  -- 6 = Saturday / Shabbos

  active INTEGER NOT NULL DEFAULT 1,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (routine_template_id) REFERENCES routine_templates(id)
);
```

Example: Yeshiva Sunday–Thursday during a zman:

```json
{
  "routine": "Yeshiva Zman",
  "start_date": "2026-09-01",
  "end_date": "2026-12-20",
  "days_of_week": [0, 1, 2, 3, 4]
}
```

Example: Year-Round Core every day:

```json
{
  "routine": "Year-Round Core",
  "start_date": null,
  "end_date": null,
  "days_of_week": [0, 1, 2, 3, 4, 5, 6]
}
```

### 7.7 routine_exceptions

One-off routine overrides.

```sql
CREATE TABLE routine_exceptions (
  id TEXT PRIMARY KEY,
  routine_template_id TEXT NOT NULL,

  exception_date TEXT NOT NULL,

  action TEXT NOT NULL,
  -- enable or disable

  reason TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (routine_template_id) REFERENCES routine_templates(id),

  UNIQUE(routine_template_id, exception_date)
);
```

Examples:

```text
Disable Yeshiva Zman on a travel day
Disable Yeshiva Zman during Pesach break
Enable Travel / Disrupted Schedule for one day
Enable Sick Day / Low Capacity for one day
```

### 7.8 review_sections

Review sections control the chronological order of the nightly review.

```sql
CREATE TABLE review_sections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  name TEXT NOT NULL,
  description TEXT,

  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);
```

Initial review sections:

```text
Morning
Afternoon
Evening
Night
Overall Reflection
```

Avoid over-segmenting in v1. The app can add more sections later.

### 7.9 routine_practices

Connects practices to routines and controls where they appear in the nightly review.

```sql
CREATE TABLE routine_practices (
  id TEXT PRIMARY KEY,

  routine_template_id TEXT NOT NULL,
  practice_id TEXT NOT NULL,
  review_section_id TEXT NOT NULL,

  sort_order INTEGER NOT NULL DEFAULT 0,

  required INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,

  display_name_override TEXT,
  help_text_override TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (routine_template_id) REFERENCES routine_templates(id),
  FOREIGN KEY (practice_id) REFERENCES practices(id),
  FOREIGN KEY (review_section_id) REFERENCES review_sections(id),

  UNIQUE(routine_template_id, practice_id)
);
```

Example mapping:

```text
Year-Round Core | Modeh Ani | Morning | required
Year-Round Core | Shacharit | Morning | required
Year-Round Core | Mincha | Afternoon | required
Year-Round Core | Maariv | Evening | required
Year-Round Core | Kriat Shema al hamitah | Night | required
Yeshiva Zman | Morning seder | Morning | required
Yeshiva Zman | Night seder | Evening | required
Summer | Exercise | Afternoon | optional
Pesach | Sefirat HaOmer | Night | required
```

### 7.10 daily_review_sessions

Since the user fills everything out at night, each day should have a review session. This is the overall daily reflection.

```sql
CREATE TABLE daily_review_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  review_date TEXT NOT NULL,

  general_day_rating INTEGER,
  main_win TEXT,
  main_struggle TEXT,
  pattern_noticed TEXT,
  adjustment_for_tomorrow TEXT,
  note TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, review_date)
);
```

### 7.11 daily_entries

A practice entry for a given date.

```sql
CREATE TABLE daily_entries (
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
```

Important: Entries should be tied to `practices`, not `routine_practices`. That way, historical data remains stable even if routines change.

### 7.12 entry_metric_values

Stores flexible metric answers.

```sql
CREATE TABLE entry_metric_values (
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
```

Examples:

```text
Shacharit quality: 7
Shacharit kavannah: 6
On time: false
Eating quality: 8
Phone/computer use quality: 5
```

### 7.13 blockers

Reusable obstacles.

```sql
CREATE TABLE blockers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  name TEXT NOT NULL,
  description TEXT,

  active INTEGER NOT NULL DEFAULT 1,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Initial blockers:

```text
Tired
Rushed
Phone
Unstructured time
Mood
Travel
Stress
Forgot
Social situation
Lack of planning
Yom Tov schedule
Overeating
```

### 7.14 entry_blockers

Many-to-many connection between entries and blockers.

```sql
CREATE TABLE entry_blockers (
  entry_id TEXT NOT NULL,
  blocker_id TEXT NOT NULL,

  PRIMARY KEY (entry_id, blocker_id),

  FOREIGN KEY (entry_id) REFERENCES daily_entries(id),
  FOREIGN KEY (blocker_id) REFERENCES blockers(id)
);
```

This supports insights like:

```text
Your Shacharit quality drops most often when “rushed” is selected.
Your phone/computer score is lowest on days marked “unstructured time.”
Your eating quality is most affected by “stress” and “tired.”
```

### 7.15 weekly_reviews

Weekly cheshbon.

```sql
CREATE TABLE weekly_reviews (
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
```

## 8. Recommended Indexes

```sql
CREATE INDEX idx_practices_user_id
ON practices(user_id);

CREATE INDEX idx_practices_domain_id
ON practices(domain_id);

CREATE INDEX idx_metrics_practice_id
ON metrics(practice_id);

CREATE INDEX idx_metric_options_metric_id
ON metric_options(metric_id);

CREATE INDEX idx_routine_schedules_routine_id
ON routine_schedules(routine_template_id);

CREATE INDEX idx_routine_exceptions_routine_date
ON routine_exceptions(routine_template_id, exception_date);

CREATE INDEX idx_routine_practices_routine_id
ON routine_practices(routine_template_id);

CREATE INDEX idx_routine_practices_practice_id
ON routine_practices(practice_id);

CREATE INDEX idx_daily_review_sessions_user_date
ON daily_review_sessions(user_id, review_date);

CREATE INDEX idx_daily_entries_user_date
ON daily_entries(user_id, entry_date);

CREATE INDEX idx_daily_entries_practice_date
ON daily_entries(practice_id, entry_date);

CREATE INDEX idx_entry_metric_values_entry_id
ON entry_metric_values(entry_id);

CREATE INDEX idx_entry_blockers_entry_id
ON entry_blockers(entry_id);
```

## 9. Active Routine Algorithm

For a selected `review_date`:

```text
1. Load all active routine_templates.
2. For each routine, check its routine_schedules.
3. A schedule matches if:
   - active = 1
   - review_date is within start_date/end_date, treating null as unbounded
   - day of week is included in days_of_week JSON array
4. Apply routine_exceptions:
   - disable removes routine for that date
   - enable adds routine for that date
5. Sort active routines by priority ascending or descending as needed.
6. Load routine_practices from all active routines.
7. Deduplicate by practice_id.
8. If duplicate practices exist, use the highest-priority routine's:
   - display_name_override
   - help_text_override
   - review_section_id if appropriate
   - sort_order if appropriate
9. Group by review_sections.
10. Sort by review_sections.sort_order, then routine_practices.sort_order.
```

Example: Monday during yeshiva zman.

```text
Active routines:
- Year-Round Core
- Yeshiva Zman

Nightly review:

Morning:
- Modeh Ani
- Didn’t snooze
- Didn’t check phone in bed
- Shacharit
- Morning seder

Afternoon:
- Eating
- Brachot
- Mincha

Evening:
- Night seder
- Maariv

Night:
- Phone & computer use
- Kriat Shema al hamitah

Overall Reflection:
- Main win
- Main struggle
- Adjustment for tomorrow
```

Example: Friday during yeshiva zman.

```text
Active routines:
- Year-Round Core

Yeshiva Zman does not apply because its schedule is Sunday–Thursday.
```

Example: Sick day.

```text
Active routines:
- Year-Round Core
- Sick Day / Low Capacity

Potential behavior:
- Sick Day routine may add low-capacity prompts.
- It may also override help text to reduce unrealistic expectations.
```

## 10. Initial Seed Data

### 10.1 Domains

```text
Tefillah & Brachot
Torah Learning
Technology & Kedushah
Health & Self-Mastery
Middos
Bein Adam L’chaveiro
Marriage / Family
Morning & Night Foundations
Seasonal Avodah
```

### 10.2 Review Sections

```text
Morning
Afternoon
Evening
Night
Overall Reflection
```

### 10.3 Routines

```text
Year-Round Core
Yeshiva Zman
Summer
Shabbos
Yom Tov
Travel / Disrupted Schedule
Sick Day / Low Capacity
```

Do not start v1 by overbuilding separate Pesach, Shavuos, and Sukkos routines. Add those once the generic Yom Tov flow works.

### 10.4 Year-Round Core Practices

```text
Modeh Ani
Didn’t snooze alarm
Didn’t check phone in bed
Shacharit
Mincha
Maariv
Eating
Brachot
Phone & computer use
Kriat Shema al hamitah
```

Suggested mappings:

```text
Modeh Ani
- Domain: Morning & Night Foundations
- Section: Morning
- Metric: completed boolean

Didn’t snooze alarm
- Domain: Morning & Night Foundations
- Section: Morning
- Metric: completed boolean

Didn’t check phone in bed
- Domain: Technology & Kedushah
- Section: Morning
- Metric: completed boolean

Shacharit
- Domain: Tefillah & Brachot
- Section: Morning
- Metrics: status enum, quality scale 1–10, kavannah scale 1–10, on_time boolean

Mincha
- Domain: Tefillah & Brachot
- Section: Afternoon
- Metrics: status enum, quality scale 1–10, kavannah scale 1–10

Maariv
- Domain: Tefillah & Brachot
- Section: Evening
- Metrics: status enum, quality scale 1–10, kavannah scale 1–10

Eating
- Domain: Health & Self-Mastery
- Section: Afternoon
- Metrics: quality scale 1–10, note text
- Help text: Healthy, portioned, timed.

Brachot
- Domain: Tefillah & Brachot
- Section: Afternoon
- Metrics: quality scale 1–10, note text
- Help text: Said brachot with kavannah and remembered after-brachot.

Phone & computer use
- Domain: Technology & Kedushah
- Section: Night
- Metrics: quality scale 1–10, note text
- Help text: Stayed off phone as much as possible and avoided distractions.

Kriat Shema al hamitah
- Domain: Tefillah & Brachot
- Section: Night
- Metric: completed boolean
```

### 10.5 Yeshiva Zman Practices

```text
Morning seder
Afternoon seder
Night seder
Came to seder on time
Used phone responsibly during seder
Prepared for chavrusa
```

Suggested schedule:

```text
Yeshiva Zman
- days_of_week: [0, 1, 2, 3, 4]
- meaning: Sunday through Thursday
```

### 10.6 Summer Practices

```text
Morning learning block
Exercise
Work/productivity block
Used free time well
```

### 10.7 Shabbos Practices

```text
Prepared for Shabbos calmly
Davening quality
Seudah presence
Divrei Torah / learning
Menuchas Shabbos
Avoided weekday distraction
```

### 10.8 Yom Tov Practices

```text
Simchat Yom Tov
Tefillah quality
Learning
Helped with Yom Tov responsibilities
Maintained patience despite schedule disruption
```

### 10.9 Travel / Disrupted Schedule Practices

```text
Kept core priorities despite disruption
Maintained tefillah schedule as best as possible
Avoided phone drift during downtime
Protected basic health: food, sleep, movement
```

### 10.10 Sick Day / Low Capacity Practices

```text
Did what was realistic without spiraling
Protected rest
Maintained minimum tefillah/connection
Avoided unnecessary guilt
```

## 11. Screens for v1

Build only these first.

### 11.1 Nightly Review Screen

The main screen.

Behavior:

- User selects or defaults to today’s date.
- App computes active routines for that date.
- App displays practices grouped by review section.
- User fills out statuses, metrics, blockers, and notes.
- Overall reflection appears at the end.

Sections:

```text
Morning
Afternoon
Evening
Night
Overall Reflection
```

### 11.2 Practice Entry Component

For each practice:

- Show display name.
- Show help text if present.
- Show status field if applicable.
- Show metric inputs based on metric definitions.
- Show optional blockers.
- Show optional note.

This should be generated from metadata, not hard-coded per practice.

### 11.3 Trends Screen

V1 metrics:

- 7-day average by domain
- 30-day average by domain
- Completion rate by practice
- Quality average by practice
- Most common blockers
- Recent trend direction

Avoid a single overall spiritual score in v1.

### 11.4 Routines Screen

Manage routines:

- List routines
- Toggle routine active/inactive
- Edit schedules
- Add exception for today
- See which routines are active for a given date

### 11.5 Practices / Settings Screen

Manage:

- Domains
- Practices
- Metrics
- Review sections
- Blockers

## 12. Implementation Milestones

### Milestone 1 — Project Scaffold

- Create Expo React Native TypeScript app.
- Use Expo Router.
- Set up folder structure.
- Add placeholder screens:
  - Nightly Review
  - Trends
  - Routines
  - Settings

### Milestone 2 — Local Database

- Add SQLite.
- Create schema.
- Add migrations or initialization script.
- Add seed data.
- Add simple repository functions.

### Milestone 3 — Active Routine Engine

Implement:

```text
getActiveRoutinesForDate(date)
getNightlyReviewItems(date)
```

These functions should compute active routines, apply exceptions, collect routine practices, deduplicate practices, and group them by review section.

### Milestone 4 — Nightly Review UX

- Render grouped practices.
- Generate metric inputs dynamically.
- Save daily_review_sessions.
- Save daily_entries.
- Save entry_metric_values.
- Save entry_blockers.

### Milestone 5 — Trends

- Domain averages
- Practice completion rates
- Practice quality averages
- Common blockers
- Last 7/30 day comparison

### Milestone 6 — Routine Management

- Create/edit routines.
- Create/edit schedules.
- Add/disable one-day exceptions.
- Toggle routines active/inactive.

### Milestone 7 — Export / Backup

- Export data to CSV or JSON.
- Import seed data or previous data.
- Do not add Supabase until local version is useful.

### Milestone 8 — Reminders

- Add configurable nightly review reminder.
- Add optional weekly review reminder.
- Do not add noisy reminders for every practice in v1.

## 13. Suggested Folder Structure

```text
app/
  _layout.tsx
  index.tsx
  review/
    [date].tsx
  trends.tsx
  routines.tsx
  settings.tsx

src/
  db/
    schema.ts
    migrations.ts
    seed.ts
    client.ts
  models/
    domain.ts
    practice.ts
    metric.ts
    routine.ts
    review.ts
  repositories/
    domainsRepo.ts
    practicesRepo.ts
    routinesRepo.ts
    reviewsRepo.ts
    entriesRepo.ts
  services/
    activeRoutineService.ts
    nightlyReviewService.ts
    trendsService.ts
  components/
    PracticeEntryCard.tsx
    MetricInput.tsx
    ReviewSection.tsx
    BlockerSelector.tsx
  constants/
    seedData.ts
  utils/
    dates.ts
    ids.ts
```

## 14. TypeScript Model Sketch

```ts
export type MetricType = 'boolean' | 'scale' | 'number' | 'text' | 'enum';

export type EntryStatus =
  | 'done'
  | 'partial'
  | 'missed'
  | 'not_applicable'
  | 'skipped';

export type RoutineType =
  | 'core'
  | 'zman'
  | 'seasonal'
  | 'holiday'
  | 'shabbos'
  | 'travel'
  | 'custom';

export type RoutineExceptionAction = 'enable' | 'disable';

export interface Domain {
  id: string;
  userId: string;
  name: string;
  description?: string;
  sortOrder: number;
  active: boolean;
}

export interface Practice {
  id: string;
  userId: string;
  domainId: string;
  name: string;
  description?: string;
  defaultFrequency: string;
  active: boolean;
}

export interface Metric {
  id: string;
  practiceId: string;
  name: string;
  metricType: MetricType;
  scaleMin?: number;
  scaleMax?: number;
  required: boolean;
  helpText?: string;
  sortOrder: number;
  active: boolean;
}

export interface RoutineTemplate {
  id: string;
  userId: string;
  name: string;
  description?: string;
  routineType: RoutineType;
  priority: number;
  active: boolean;
}

export interface RoutineSchedule {
  id: string;
  routineTemplateId: string;
  startDate?: string;
  endDate?: string;
  daysOfWeek: number[];
  active: boolean;
}

export interface RoutinePractice {
  id: string;
  routineTemplateId: string;
  practiceId: string;
  reviewSectionId: string;
  sortOrder: number;
  required: boolean;
  enabled: boolean;
  displayNameOverride?: string;
  helpTextOverride?: string;
}
```

## 15. Important Product Decisions

### 15.1 Use 1–10 scales for now

The Google Form already uses 1–10. Keep that for continuity.

Later, consider whether 1–5 is emotionally cleaner and easier to use.

### 15.2 Notes should be optional

Do not make the nightly review too heavy. The user should be able to complete it quickly.

### 15.3 Blockers should be reusable

The point of blockers is pattern detection.

Example:

```text
Rushed
Tired
Phone
Unstructured time
Stress
Forgot
Travel
```

### 15.4 Routines should overlay, not replace

A given day can have multiple active routines.

Example:

```text
Year-Round Core + Yeshiva Zman
Year-Round Core + Shabbos
Year-Round Core + Yom Tov
Year-Round Core + Travel
```

### 15.5 Core practices should not be copied into every routine

Modeh Ani, Shacharit, Mincha, Maariv, Brachot, etc. belong in Year-Round Core.

Seasonal routines should add or override, not duplicate.

### 15.6 Entries belong to practices, not routines

This prevents data loss or confusion when routines change.

### 15.7 Date logic should be simple in v1

Use civil dates in v1. Do not overbuild Hebrew date / sunset logic yet.

Leave room to add this later.

Potential future field:

```text
date_logic:
- civil_day
- jewish_day_evening_start
- manual
```

## 16. Privacy Requirements

This data is extremely personal.

V1:

- Store locally.
- Avoid external analytics.
- Avoid logging raw reflections.
- Avoid AI summaries unless explicitly added later.
- Do not send spiritual notes to any external API by default.

Later Supabase version:

- Use Row Level Security.
- Make export/delete easy.
- Consider encryption for particularly sensitive notes.

## 17. Suggested AGENTS.md

Place this at the repository root as `AGENTS.md`.

```md
# AGENTS.md

## Project

This is a personal cheshbon hanefesh tracking app built with Expo React Native and TypeScript.

It is not a generic habit tracker. It tracks completion, quality, blockers, routines, and reflective growth.

## Product Principles

- The goal is clarity, not guilt.
- Do not create a simplistic overall spiritual score in v1.
- Do not hard-code spiritual categories into UI logic.
- Use seed data and database-driven rendering.
- Notes should be optional.
- Preserve user privacy.
- Do not add AI or external sync until the local app is useful.

## Stack

- Expo
- React Native
- TypeScript
- Expo Router
- SQLite local database first
- Supabase later
- Expo Notifications later

## Schema Concepts

Use:
- domains
- practices
- metrics
- metric_options
- routine_templates
- routine_schedules
- routine_exceptions
- review_sections
- routine_practices
- daily_review_sessions
- daily_entries
- entry_metric_values
- blockers
- entry_blockers
- weekly_reviews

## Architecture Rules

- Practices are permanent and should not be duplicated across routines.
- Routines are scheduled overlays.
- Year-Round Core should be active every day.
- Yeshiva Zman should be schedulable, e.g. Sunday–Thursday only.
- Entries should be tied to practices, not routine_practices.
- The nightly screen should be generated by active routines for the selected date.
- Higher-priority routines may override display names/help text.
- Keep components small and typed.
- Prefer readable code over clever code.

## Verification

After changes:
- Run TypeScript checks.
- Run lint if configured.
- Manually test the nightly review flow.
- Test active routine calculation for at least:
  - normal weekday
  - yeshiva Sunday–Thursday
  - Friday during yeshiva
  - Shabbos
  - travel exception
```

## 18. First Codex Prompt

Use this as the first prompt after creating the repo:

```text
Read PROJECT_SPEC.md and AGENTS.md. Build the initial Expo React Native TypeScript app for this cheshbon hanefesh project.

Start with:
1. Expo Router scaffold.
2. SQLite database setup.
3. Schema creation.
4. Seed data for domains, review sections, routines, Year-Round Core practices, and basic metrics.
5. Placeholder screens for Nightly Review, Trends, Routines, and Settings.
6. Implement activeRoutineService with getActiveRoutinesForDate(date) and getNightlyReviewItems(date).

Do not add Supabase yet.
Do not add AI summaries yet.
Do not hard-code the nightly review items in the UI; generate them from routine_practices and active routines.
```

## 19. Follow-up Codex Tickets

### Ticket 1: Build Nightly Review UI

```text
Build the Nightly Review screen. It should accept a date, compute active routines, load grouped review items, and render practices by review section. Each practice should render its metrics dynamically based on the metrics table.
```

### Ticket 2: Save Entries

```text
Implement saving for daily_review_sessions, daily_entries, entry_metric_values, and entry_blockers. Make sure repeated saves update existing rows instead of creating duplicates.
```

### Ticket 3: Build Routines Screen

```text
Build a Routines screen that lists routine_templates, shows their schedules, and allows enabling/disabling routines and adding one-day routine exceptions.
```

### Ticket 4: Build Trends

```text
Build basic trends: 7-day and 30-day averages by domain, completion rate by practice, quality average by practice, and most common blockers.
```

### Ticket 5: Add Export

```text
Add export-to-JSON and export-to-CSV for all local cheshbon data.
```

## 20. Non-Goals for v1

Do not build these in v1:

```text
Full Supabase sync
Social sharing
Gamified badges
AI-generated mussar
Complex Hebrew calendar support
Sunset-based halachic day logic
Multi-user family accounts
Community templates
```

These can come later after the personal local version works well.

## 21. Definition of Done for v1

The v1 app is successful if the user can:

```text
1. Open the app at night.
2. See the correct practices for that date based on active routines.
3. Review the day chronologically.
4. Enter completion, quality, blockers, and optional notes.
5. Save the nightly review.
6. See simple trends over time.
7. Toggle or schedule routines like Yeshiva Zman Sunday–Thursday.
8. Export the data.
```

That is enough for a serious first version.
