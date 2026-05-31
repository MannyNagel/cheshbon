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

export type MetricOption = {
  id: string;
  metricId: string;
  label: string;
  value: string;
  sortOrder: number;
};

export type Metric = {
  id: string;
  practiceId: string;
  name: string;
  metricType: MetricType;
  scaleMin?: number | null;
  scaleMax?: number | null;
  required: boolean;
  helpText?: string | null;
  sortOrder: number;
  options: MetricOption[];
};

export type Blocker = {
  id: string;
  name: string;
  description?: string | null;
  active: boolean;
};

export type ReviewSection = {
  id: string;
  name: string;
  description?: string | null;
  sortOrder: number;
};

export type RoutineTemplate = {
  id: string;
  name: string;
  description?: string | null;
  routineType: RoutineType;
  priority: number;
  active: boolean;
};

export type NightlyReviewItem = {
  routinePracticeId: string;
  routineId: string;
  routineName: string;
  routinePriority: number;
  practiceId: string;
  practiceName: string;
  displayName: string;
  helpText?: string | null;
  domainId: string;
  domainName: string;
  reviewSectionId: string;
  reviewSectionName: string;
  sectionSortOrder: number;
  sortOrder: number;
  required: boolean;
  metrics: Metric[];
  allowedBlockerIds?: string[] | null;
  allowNote: boolean;
};

export type NightlyReviewSection = ReviewSection & {
  items: NightlyReviewItem[];
};

export type MetricValueDraft = {
  metricId: string;
  valueBoolean?: boolean | null;
  valueNumber?: number | null;
  valueText?: string | null;
  valueJson?: string | null;
};

export type EntryDraft = {
  practiceId: string;
  status?: EntryStatus | null;
  note?: string | null;
  metricValues: Record<string, MetricValueDraft>;
  blockerIds: string[];
};

export type ReviewSessionDraft = {
  generalDayRating?: number | null;
  bedTime?: string | null;
  wakeTime?: string | null;
  mainWin?: string | null;
  mainStruggle?: string | null;
  patternNoticed?: string | null;
  adjustmentForTomorrow?: string | null;
  note?: string | null;
  completedAt?: string | null;
};

export type NightlyReviewDraft = {
  session: ReviewSessionDraft;
  entries: Record<string, EntryDraft>;
};

export type TrendSummary = {
  domainInsights: Array<{
    domainId: string;
    domainName: string;
    score7: number | null;
    score30: number | null;
    trackedPractices: number;
    direction: 'up' | 'down' | 'steady' | 'insufficient';
  }>;
  prayerUnit: {
    score7: number | null;
    score30: number | null;
    parts: Array<{
      practiceId: string;
      practiceName: string;
      score7: number | null;
      score30: number | null;
    }>;
  } | null;
  practiceTrends: Array<{
    practiceId: string;
    practiceName: string;
    domainName: string;
    metricName: string;
    metricKind: 'complete' | 'number' | 'quality' | 'text';
    unitLabel: string;
    week: TrendWindow;
    month: TrendWindow;
    allTime: TrendWindow;
    recentEntries: Array<{ date: string; text: string }>;
  }>;
  commonBlockers: Array<{
    blockerId: string;
    blockerName: string;
    count: number;
  }>;
};

export type TrendPoint = {
  label: string;
  value: number | null;
};

export type TrendWindow = {
  average: number | null;
  sampleSize: number;
  points: TrendPoint[];
};
