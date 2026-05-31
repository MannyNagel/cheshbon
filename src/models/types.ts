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
};

export type NightlyReviewDraft = {
  session: ReviewSessionDraft;
  entries: Record<string, EntryDraft>;
};

export type TrendSummary = {
  domainAverages: Array<{
    domainId: string;
    domainName: string;
    average7: number | null;
    average30: number | null;
    direction: 'up' | 'down' | 'steady' | 'insufficient';
  }>;
  completionByPractice: Array<{
    practiceId: string;
    practiceName: string;
    completionRate: number;
    trackedCount: number;
  }>;
  qualityByPractice: Array<{
    practiceId: string;
    practiceName: string;
    average: number;
    sampleSize: number;
  }>;
  commonBlockers: Array<{
    blockerId: string;
    blockerName: string;
    count: number;
  }>;
};
