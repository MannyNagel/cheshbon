export type MetricType = 'boolean' | 'scale' | 'number' | 'text' | 'enum';

export type TrendWeekMode = 'sunday_to_date' | 'rolling_7_days';

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
  domainId?: string | null;
  domainName?: string | null;
  isPrimary: boolean;
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
  markable: boolean;
  weeklyGoal?: {
    target: number;
    completedBeforeToday: number;
  } | null;
  subPractices: NightlyReviewItem[];
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
  remindTomorrow?: boolean | null;
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

export type ResetOutcome = 'worked' | 'partially' | 'did_not_work';

export type ResetEvent = {
  id: string;
  resetDate: string;
  initiatedAt: string;
  trigger: string;
  triggerDetail?: string | null;
  whatMattersNext: string;
  firstAction?: string | null;
  outcome?: ResetOutcome | null;
  outcomeReflection?: string | null;
  reviewedAt?: string | null;
};

export type AvodahExperimentType = 'avodah' | 'middah';
export type AvodahExperimentStatus = 'draft' | 'active' | 'reviewing' | 'graduated' | 'modified' | 'abandoned';
export type AvodahResponse = 'did_well' | 'mixed' | 'missed';
export type AvodahDecision = 'continue' | 'modify' | 'graduate' | 'abandon';

export type AvodahExperiment = {
  id: string;
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
  positiveLabel: string;
  partialLabel: string;
  negativeLabel: string;
  parentExperimentId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type AvodahDailyEntry = {
  id?: string | null;
  experimentId: string;
  reviewDate: string;
  opportunity?: boolean | null;
  response?: AvodahResponse | null;
  reflection?: string | null;
};

export type NightlyReviewDraft = {
  session: ReviewSessionDraft;
  entries: Record<string, EntryDraft>;
  resets: ResetEvent[];
  avodahEntries: Record<string, AvodahDailyEntry>;
};

export type TrendSummary = {
  weekMode: TrendWeekMode;
  weekLabel: string;
  domainInsights: Array<{
    domainId: string;
    domainName: string;
    score7: number | null;
    score30: number | null;
    trackedPractices: number;
    direction: 'up' | 'down' | 'steady' | 'insufficient';
  }>;
  practiceTrends: Array<{
    practiceId: string;
    metricId: string;
    practiceName: string;
    domainId: string;
    domainName: string;
    metricName: string;
    isSubPractice: boolean;
    metricKind: 'choice' | 'complete' | 'number' | 'quality' | 'text';
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
  resetInsights: {
    total: number;
    worked: number;
    partially: number;
    didNotWork: number;
    unrated: number;
    recoveryRate: number | null;
    mostCommonTrigger: string | null;
    mostCommonTimeOfDay: string | null;
    triggerCounts: Array<{ trigger: string; count: number }>;
  };
};

export type QualitativeTrendSummary = {
  rangeLabel: string;
  succeeding: Array<{
    domainId: string;
    domainName: string;
    message: string;
    practices: string[];
  }>;
  needsAttention: Array<{
    domainId: string;
    domainName: string;
    message: string;
    practices: string[];
    blockers: string[];
  }>;
  recentNotes: Array<{
    date: string;
    practiceName: string;
    domainName: string;
    text: string;
  }>;
  blockerPatterns: Array<{
    blockerName: string;
    domainNames: string[];
    practiceNames: string[];
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
