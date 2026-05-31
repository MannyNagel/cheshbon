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
  ['domain_seasonal', 'Seasonal Avodah', 'Avodah that changes by calendar and context'],
] as const;
export const reviewSections = [
  ['section_morning', 'Morning', 'First anchors and the start of the day'],
  ['section_afternoon', 'Afternoon', 'Middle of the day and practical avodah'],
  ['section_night', 'Night', 'Closing the day with clarity'],
  ['section_overall', 'Overview', 'All-day patterns and reflection'],
] as const;
export const routines = [
  ['routine_core', 'Year-Round Core', 'The stable siddur-like core for every day', 'core', 0],
  ['routine_yeshiva_zman', 'Yeshiva Zman', 'Sunday through Thursday seder structure', 'zman', 10],
  ['routine_summer', 'Summer', 'Summer rhythm and open-time structure', 'seasonal', 10],
  ['routine_shabbos', 'Shabbos', 'Shabbos review overlay', 'shabbos', 20],
  ['routine_yom_tov', 'Yom Tov', 'Generic Yom Tov review overlay', 'holiday', 20],
  ['routine_travel', 'Travel / Disrupted Schedule', 'Disruption without losing the center', 'travel', 40],
  ['routine_sick', 'Sick Day / Low Capacity', 'Realistic avodah without unnecessary guilt', 'custom', 50],
] as const;

export const schedules = [
  ['schedule_core_all', 'routine_core', null, null, [0, 1, 2, 3, 4, 5, 6]],
  ['schedule_yeshiva_zman', 'routine_yeshiva_zman', null, null, [0, 1, 2, 3, 4]],
  ['schedule_shabbos', 'routine_shabbos', null, null, [6]],
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
    name: 'Shacharit',
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
    name: 'Positivity',
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
  ['rp_modeh_ani', 'routine_core', 'practice_modeh_ani', 'section_morning', 10, 1, null, null],
  ['rp_no_snooze', 'routine_core', 'practice_no_snooze', 'section_morning', 20, 0, null, null],
  ['rp_no_phone_bed', 'routine_core', 'practice_no_phone_bed', 'section_morning', 30, 0, null, null],
  ['rp_shacharit', 'routine_core', 'practice_shacharit', 'section_morning', 40, 1, null, null],
  ['rp_mincha', 'routine_core', 'practice_mincha', 'section_afternoon', 10, 1, null, null],
  ['rp_maariv', 'routine_core', 'practice_maariv', 'section_night', 10, 1, null, null],
  ['rp_shema', 'routine_core', 'practice_shema_al_hamitah', 'section_night', 20, 1, null, null],
  ['rp_eating', 'routine_core', 'practice_eating', 'section_overall', 10, 0, null, 'Healthy, portioned, timed.'],
  ['rp_phone', 'routine_core', 'practice_phone_computer', 'section_overall', 20, 0, null, 'Stayed off phone as much as possible and avoided distractions.'],
  ['rp_brachot', 'routine_core', 'practice_brachot', 'section_overall', 110, 1, null, 'Said brachot with kavannah and remembered after-brachot.'],
  ['rp_positivity', 'routine_core', 'practice_positivity', 'section_overall', 210, 0, null, null],
  ['rp_complimentary', 'routine_core', 'practice_complimentary', 'section_overall', 220, 0, null, null],
  ['rp_gratitude', 'routine_core', 'practice_gratitude', 'section_overall', 230, 0, null, null],
  ['rp_morning_seder', 'routine_yeshiva_zman', 'practice_morning_seder', 'section_morning', 50, 1, null, null],
  ['rp_shiur', 'routine_yeshiva_zman', 'practice_shiur', 'section_afternoon', 20, 1, null, null],
  ['rp_afternoon_seder', 'routine_yeshiva_zman', 'practice_afternoon_seder', 'section_afternoon', 30, 1, null, null],
  ['rp_exercise_summer', 'routine_summer', 'practice_exercise', 'section_afternoon', 50, 0, null, null],
  ['rp_low_capacity_sick', 'routine_sick', 'practice_low_capacity', 'section_overall', 10, 0, null, 'Name the realistic win, not the imagined perfect day.'],
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
