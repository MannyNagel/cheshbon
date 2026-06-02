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
  ['routine_rosh_chodesh', 'Rosh Chodesh', 'Monthly reflection for Rosh Chodesh', 'seasonal', 50, true],
] as const;

export const roshChodeshDates = [
  '2026-01-19',
  '2026-02-17',
  '2026-03-19',
  '2026-04-17',
  '2026-05-17',
  '2026-06-15',
  '2026-07-15',
  '2026-08-13',
  '2026-10-11',
  '2026-11-10',
  '2026-12-10',
  '2027-01-09',
  '2027-02-07',
  '2027-03-09',
  '2027-04-08',
  '2027-05-07',
  '2027-06-06',
  '2027-07-05',
  '2027-08-04',
  '2027-09-02',
  '2027-10-31',
  '2027-11-30',
  '2027-12-30',
  '2028-01-29',
  '2028-02-27',
  '2028-03-28',
  '2028-04-26',
  '2028-05-26',
  '2028-06-24',
  '2028-07-24',
  '2028-08-22',
  '2028-10-20',
  '2028-11-19',
  '2028-12-18',
  '2029-01-17',
  '2029-02-15',
  '2029-03-17',
  '2029-04-15',
  '2029-05-15',
  '2029-06-13',
  '2029-07-13',
  '2029-08-11',
  '2029-10-09',
  '2029-11-08',
  '2029-12-07',
  '2030-01-05',
  '2030-02-03',
  '2030-03-05',
  '2030-04-04',
  '2030-05-03',
  '2030-06-02',
  '2030-07-01',
  '2030-07-31',
  '2030-08-29',
  '2030-10-27',
  '2030-11-26',
  '2030-12-26',
  '2031-01-25',
  '2031-02-23',
  '2031-03-25',
  '2031-04-23',
  '2031-05-23',
  '2031-06-21',
  '2031-07-21',
  '2031-08-19',
  '2031-10-17',
  '2031-11-16',
  '2031-12-15',
  '2032-01-14',
  '2032-02-12',
  '2032-03-13',
  '2032-04-11',
  '2032-05-11',
  '2032-06-09',
  '2032-07-09',
  '2032-08-07',
  '2032-10-05',
  '2032-11-04',
  '2032-12-03',
  '2033-01-01',
  '2033-01-30',
  '2033-03-01',
  '2033-03-31',
  '2033-04-29',
  '2033-05-29',
  '2033-06-27',
  '2033-07-27',
  '2033-08-25',
  '2033-10-23',
  '2033-11-22',
  '2033-12-22',
  '2034-01-21',
  '2034-02-19',
  '2034-03-21',
  '2034-04-19',
  '2034-05-19',
  '2034-06-17',
  '2034-07-17',
  '2034-08-15',
  '2034-10-13',
  '2034-11-12',
  '2034-12-12',
  '2035-01-11',
  '2035-02-09',
  '2035-03-11',
  '2035-04-10',
  '2035-05-09',
  '2035-06-08',
  '2035-07-07',
  '2035-08-06',
  '2035-09-04',
  '2035-11-02',
  '2035-12-02',
  '2035-12-31',
] as const;

type ScheduleSeed = readonly [string, string, string | null, string | null, readonly number[]];
const allDays = [0, 1, 2, 3, 4, 5, 6] as const;

export const schedules = [
  ['schedule_core_week', 'routine_core', null, null, [0, 1, 2, 3, 4, 5]],
  ['schedule_shabbos', 'routine_shabbos', null, null, [6]],
  ['schedule_vacation_all', 'routine_vacation', null, null, [0, 1, 2, 3, 4, 5, 6]],
  ['schedule_work_weekdays', 'routine_work', null, null, [1, 2, 3, 4, 5]],
  ...roshChodeshDates.map<ScheduleSeed>((date) => [
    `schedule_rosh_chodesh_${date.replace(/-/g, '_')}`,
    'routine_rosh_chodesh',
    date,
    date,
    allDays,
  ]),
] as const satisfies readonly ScheduleSeed[];

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
    id: 'practice_rosh_chodesh_past_month',
    domainId: 'domain_current_avodah',
    name: 'Past month avodas Hashem',
    description: 'How was your avodas Hashem this past month?',
    metrics: [
      {
        id: 'metric_rosh_chodesh_past_month_text',
        name: 'Past month',
        metricType: 'text',
        helpText: 'How was your avodas Hashem this past month?',
      },
    ],
  },
  {
    id: 'practice_rosh_chodesh_improvement',
    domainId: 'domain_current_avodah',
    name: 'Rosh Chodesh improvement',
    description: 'Where can you improve and how?',
    metrics: [
      {
        id: 'metric_rosh_chodesh_improvement_text',
        name: 'Improvement',
        metricType: 'text',
        helpText: 'Where can you improve and how?',
      },
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
  [
    'rp_rosh_chodesh_past_month',
    'routine_rosh_chodesh',
    'practice_rosh_chodesh_past_month',
    'section_overall',
    10,
    0,
    null,
    'How was your avodas Hashem this past month?',
  ],
  [
    'rp_rosh_chodesh_improvement',
    'routine_rosh_chodesh',
    'practice_rosh_chodesh_improvement',
    'section_overall',
    20,
    0,
    null,
    'Where can you improve and how?',
  ],
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
