export const LOCAL_USER_ID = 'local_user';

export const domains = [
  ['domain_tefillah_brachot', 'Tefillah & Brachot', 'Prayer, blessings, and attention before Hashem'],
  ['domain_torah', 'Torah Learning', 'Learning blocks, chavrusa, seder, and preparation'],
  ['domain_technology', 'Technology & Kedushah', 'Phone, computer, distraction, and digital boundaries'],
  ['domain_health', 'Health & Self-Mastery', 'Eating, sleep, exercise, and self-command'],
  ['domain_middos', 'Middos', 'Character work and emotional responsibility'],
  ['domain_chaveiro', "Bein Adam L'chaveiro", 'Interpersonal obligations and presence'],
  ['domain_family', 'Marriage / Family', 'Home, family, and close relationships'],
  ['domain_foundations', 'Morning & Night Foundations', 'Anchors at the edges of the day'],
  ['domain_current_avodah', 'Current Avodah', 'The present point of growth for today and this week'],
  ['domain_other', 'Other', 'General thoughts, reflections, and uncategorized practices'],
  ['domain_seasonal', 'Seasonal Avodah', 'Avodah that changes by calendar and context'],
] as const;
export const reviewSections = [
  ['section_morning', 'Morning', 'First anchors and the start of the day'],
  ['section_afternoon', 'Afternoon', 'Middle of the day and practical avodah'],
  ['section_night', 'Night', 'Closing the day with clarity'],
  ['section_overall', 'Overview', 'All-day practices'],
] as const;
export const routines = [
  ['routine_core', 'Weekly Core', 'The stable core for regular review days', 'core', 0, true],
  ['routine_shabbos', 'Shabbos', 'Shabbos review overlay', 'shabbos', 20, true],
  ['routine_vacation', 'Vacation', 'A lighter structure for vacation or travel periods', 'travel', 30, false],
  ['routine_work', 'Work', 'Regular weekday work structure', 'custom', 40, true],
] as const;

export const schedules = [
  ['schedule_core_week', 'routine_core', null, null, [0, 1, 2, 3, 4, 5]],
  ['schedule_shabbos', 'routine_shabbos', null, null, [6]],
  ['schedule_vacation_all', 'routine_vacation', null, null, [0, 1, 2, 3, 4, 5, 6]],
  ['schedule_work_weekdays', 'routine_work', null, null, [1, 2, 3, 4, 5]],
] as const;

export type PracticeSeed = {
  id: string;
  domainId: string;
  name: string;
  description?: string;
  metrics: Array<{
    id: string;
    name: string;
    metricType: 'boolean' | 'scale' | 'number' | 'text' | 'enum';
    scaleMin?: number;
    scaleMax?: number;
    required?: boolean;
    helpText?: string;
    options?: Array<[string, string, string]>;
  }>;
};

export const practices: PracticeSeed[] = [
  {
    id: 'practice_sleep',
    domainId: 'domain_health',
    name: 'Sleep',
    description: 'Notice the quality of sleep and how it affected the day.',
    metrics: [{ id: 'metric_sleep_quality', name: 'Quality', metricType: 'scale', scaleMin: 1, scaleMax: 5 }],
  },
  {
    id: 'practice_modeh_ani',
    domainId: 'domain_foundations',
    name: 'Modeh Ani',
    metrics: [{ id: 'metric_modeh_ani_completed', name: 'Completed', metricType: 'boolean', required: true }],
  },
  {
    id: 'practice_no_snooze',
    domainId: 'domain_foundations',
    name: "Didn't snooze alarm",
    metrics: [{ id: 'metric_no_snooze_completed', name: 'Completed', metricType: 'boolean' }],
  },
  {
    id: 'practice_no_phone_bed',
    domainId: 'domain_technology',
    name: "Didn't check phone in bed",
    metrics: [{ id: 'metric_no_phone_bed_completed', name: 'Completed', metricType: 'boolean' }],
  },
  {
    id: 'practice_shacharit',
    domainId: 'domain_tefillah_brachot',
    name: 'Shacharis',
    metrics: [
      { id: 'metric_shacharit_quality', name: 'Quality', metricType: 'scale', scaleMin: 1, scaleMax: 5 },
      { id: 'metric_shacharit_on_time', name: 'On time', metricType: 'boolean' },
    ],
  },
  {
    id: 'practice_mincha',
    domainId: 'domain_tefillah_brachot',
    name: 'Mincha',
    metrics: [
      { id: 'metric_mincha_quality', name: 'Quality', metricType: 'scale', scaleMin: 1, scaleMax: 5 },
    ],
  },
  {
    id: 'practice_maariv',
    domainId: 'domain_tefillah_brachot',
    name: 'Maariv',
    metrics: [
      { id: 'metric_maariv_quality', name: 'Quality', metricType: 'scale', scaleMin: 1, scaleMax: 5 },
    ],
  },
  {
    id: 'practice_eating',
    domainId: 'domain_health',
    name: 'Eating',
    description: 'Healthy, portioned, timed.',
    metrics: [
      { id: 'metric_eating_quality', name: 'Quality', metricType: 'scale', scaleMin: 1, scaleMax: 5 },
    ],
  },
  {
    id: 'practice_brachot',
    domainId: 'domain_tefillah_brachot',
    name: 'Brachot',
    description: 'Said brachot with kavannah and remembered after-brachot.',
    metrics: [
      { id: 'metric_brachot_quality', name: 'Quality', metricType: 'scale', scaleMin: 1, scaleMax: 5 },
    ],
  },
  {
    id: 'practice_phone_computer',
    domainId: 'domain_technology',
    name: 'Phone & computer use',
    description: 'Stayed off phone as much as possible and avoided distractions.',
    metrics: [
      { id: 'metric_phone_quality', name: 'Quality', metricType: 'scale', scaleMin: 1, scaleMax: 5 },
    ],
  },
  {
    id: 'practice_shiur',
    domainId: 'domain_torah',
    name: 'Shiur',
    metrics: [
      {
        id: 'metric_shiur_applicable',
        name: 'Shiur today?',
        metricType: 'enum',
        required: true,
        options: [
          ['yes', 'Yes', 'yes'],
          ['not_applicable', 'N/A', 'not_applicable'],
        ],
      },
      { id: 'metric_shiur_completed', name: 'Completed', metricType: 'boolean' },
      { id: 'metric_shiur_focus', name: 'Focus quality', metricType: 'scale', scaleMin: 1, scaleMax: 5 },
    ],
  },
  {
    id: 'practice_positivity',
    domainId: 'domain_middos',
    name: 'Positive',
    metrics: [
      { id: 'metric_positivity_quality', name: 'Quality', metricType: 'scale', scaleMin: 1, scaleMax: 5 },
    ],
  },
  {
    id: 'practice_complimentary',
    domainId: 'domain_middos',
    name: 'Complimentary',
    metrics: [
      { id: 'metric_complimentary_quality', name: 'Quality', metricType: 'scale', scaleMin: 1, scaleMax: 5 },
    ],
  },
  {
    id: 'practice_gratitude',
    domainId: 'domain_middos',
    name: 'Gratitude',
    description: 'Name something you are grateful for from the day.',
    metrics: [
      { id: 'metric_gratitude_text', name: 'Gratitude', metricType: 'text' },
    ],
  },
  {
    id: 'practice_daily_avodah',
    domainId: 'domain_current_avodah',
    name: 'Daily Avodah',
    description: 'Choose one thing to work on tomorrow.',
    metrics: [
      { id: 'metric_daily_avodah_text', name: 'Current avodah', metricType: 'text' },
    ],
  },
  {
    id: 'practice_weekly_avodah',
    domainId: 'domain_current_avodah',
    name: 'Weekly Avodah',
    description: 'Choose one thing to work on this week.',
    metrics: [
      { id: 'metric_weekly_avodah_text', name: 'Current avodah', metricType: 'text' },
    ],
  },
  {
    id: 'practice_reflection',
    domainId: 'domain_middos',
    name: 'Reflection',
    description: 'A short honest thought from the day.',
    metrics: [
      { id: 'metric_reflection_text', name: 'Reflection', metricType: 'text' },
    ],
  },
  {
    id: 'practice_daily_thoughts',
    domainId: 'domain_other',
    name: 'Thoughts and Reflections',
    description: 'Anything from the day that feels worth remembering or thinking through.',
    metrics: [
      { id: 'metric_daily_thoughts_text', name: 'Thoughts and reflections', metricType: 'text' },
    ],
  },
  {
    id: 'practice_shema_al_hamitah',
    domainId: 'domain_tefillah_brachot',
    name: 'Kriat Shema al hamitah',
    metrics: [{ id: 'metric_shema_completed', name: 'Completed', metricType: 'boolean', required: true }],
  },
  {
    id: 'practice_morning_seder',
    domainId: 'domain_torah',
    name: 'Morning seder',
    metrics: [
      { id: 'metric_morning_seder_completed', name: 'Completed', metricType: 'boolean' },
      { id: 'metric_morning_seder_focus', name: 'Focus quality', metricType: 'scale', scaleMin: 1, scaleMax: 5 },
    ],
  },
  {
    id: 'practice_afternoon_seder',
    domainId: 'domain_torah',
    name: 'Afternoon seder',
    metrics: [
      { id: 'metric_afternoon_seder_completed', name: 'Completed', metricType: 'boolean' },
      { id: 'metric_afternoon_seder_focus', name: 'Focus quality', metricType: 'scale', scaleMin: 1, scaleMax: 5 },
    ],
  },
  {
    id: 'practice_night_seder',
    domainId: 'domain_torah',
    name: 'Night seder',
    metrics: [
      { id: 'metric_night_seder_completed', name: 'Completed', metricType: 'boolean' },
      { id: 'metric_night_seder_focus', name: 'Focus quality', metricType: 'scale', scaleMin: 1, scaleMax: 5 },
    ],
  },
  {
    id: 'practice_exercise',
    domainId: 'domain_health',
    name: 'Exercise',
    metrics: [
      { id: 'metric_exercise_completed', name: 'Completed', metricType: 'boolean' },
      { id: 'metric_exercise_note', name: 'Note', metricType: 'text' },
    ],
  },
  {
    id: 'practice_low_capacity',
    domainId: 'domain_middos',
    name: 'Did what was realistic without spiraling',
    metrics: [
      { id: 'metric_low_capacity_quality', name: 'Quality', metricType: 'scale', scaleMin: 1, scaleMax: 5 },
      { id: 'metric_low_capacity_note', name: 'Note', metricType: 'text' },
    ],
  },
];

export const routinePractices = [
  ['rp_no_phone_bed', 'routine_core', 'practice_no_phone_bed', 'section_morning', 10, 0, null, null],
  ['rp_modeh_ani', 'routine_core', 'practice_modeh_ani', 'section_morning', 20, 1, null, null],
  ['rp_shacharit', 'routine_core', 'practice_shacharit', 'section_morning', 30, 1, null, null],
  ['rp_eating', 'routine_core', 'practice_eating', 'section_overall', 10, 0, null, 'Healthy, portioned, timed.'],
  ['rp_brachot', 'routine_core', 'practice_brachot', 'section_overall', 110, 1, null, 'Said brachot with kavannah and remembered after-brachot.'],
  ['rp_positivity', 'routine_core', 'practice_positivity', 'section_overall', 210, 0, null, null],
  ['rp_gratitude', 'routine_core', 'practice_gratitude', 'section_overall', 220, 0, null, null],
  ['rp_daily_avodah', 'routine_core', 'practice_daily_avodah', 'section_overall', 310, 0, null, null],
  ['rp_daily_thoughts', 'routine_core', 'practice_daily_thoughts', 'section_overall', 320, 0, null, null],
  ['rp_weekly_avodah', 'routine_shabbos', 'practice_weekly_avodah', 'section_overall', 310, 0, null, null],
] as const;

export const blockerNames = [
  'Tired',
  'Rushed',
  'Phone',
  'Unstructured time',
  'Mood',
  'Travel',
  'Stress',
  'Forgot',
  'Social situation',
  'Lack of planning',
] as const;
