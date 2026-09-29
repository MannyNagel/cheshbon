import { Bell, CalendarDays, FlaskConical, Flame, LogIn, NotebookPen, RotateCcw } from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/src/components/ui';
import { getCurrentAvodahExperiments, type AvodahExperimentWithStats } from '@/src/repositories/avodahRepo';
import { getHomeSummary, getOnboardingStatus, getReminderPreferences, type HomeSummary, type ReminderPreferences } from '@/src/repositories/cheshbonRepo';
import { getNightlyReviewItems } from '@/src/services/activeRoutineService';
import { getCloudStatus, type CloudStatus } from '@/src/services/cloudSyncService';
import { addDaysIso, dayName, monthDay, todayIsoDate } from '@/src/utils/dates';

export default function HomeScreen() {
  const today = todayIsoDate();
  const yesterday = addDaysIso(today, -1);
  const primaryReviewDate = isBeforeNoon() ? yesterday : today;
  const primaryReviewIsYesterday = primaryReviewDate === yesterday;
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [primaryReviewStatus, setPrimaryReviewStatus] = useState<Pick<HomeSummary, 'reviewStarted' | 'reviewComplete'> | null>(null);
  const [reminderPreferences, setReminderPreferences] = useState<ReminderPreferences | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus | null>(null);
  const [experiments, setExperiments] = useState<AvodahExperimentWithStats[]>([]);
  const [foundationDomains, setFoundationDomains] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      Promise.all([
        getHomeSummary(today),
        primaryReviewDate === today ? Promise.resolve(null) : getHomeSummary(primaryReviewDate),
        getReminderPreferences(),
        getOnboardingStatus(),
        getCurrentAvodahExperiments(),
        getNightlyReviewItems(today),
      ])
        .then(([nextSummary, nextPrimaryReviewSummary, nextReminderPreferences, nextOnboardingStatus, nextExperiments, reviewSections]) => {
          if (active) {
            if (nextOnboardingStatus.needsOnboarding) {
              router.replace('/welcome');
              return;
            }
            setSummary(nextSummary);
            setPrimaryReviewStatus(nextPrimaryReviewSummary ?? nextSummary);
            setReminderPreferences(nextReminderPreferences);
            setExperiments(nextExperiments);
            setFoundationDomains([...new Set(reviewSections.flatMap((section) => section.items.flatMap((item) => [item.domainName, ...item.subPractices.map((child) => child.domainName)])))].filter(Boolean));
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      getCloudStatus()
        .then((nextCloudStatus) => {
          if (active) setCloudStatus(nextCloudStatus);
        })
        .catch(() => {
          if (active) {
            setCloudStatus((current) => current ?? {
              configured: true,
              signedIn: true,
              email: null,
              name: null,
              lastSyncedAt: null,
            });
          }
        });
      return () => {
        active = false;
      };
    }, [primaryReviewDate, today]),
  );

  if (loading || !summary || !primaryReviewStatus || !reminderPreferences) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.blue} />
      </View>
    );
  }

  const hasMorningReminder = Boolean(summary.morningReminder.dailyAvodah || summary.morningReminder.markedPractices.length);
  const reviewStarted = primaryReviewStatus.reviewStarted;
  const reviewComplete = primaryReviewStatus.reviewComplete;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {cloudStatus && !cloudStatus.signedIn ? (
        <View style={styles.accountPrompt}>
          <View style={styles.accountPromptText}>
            <Text style={styles.accountPromptTitle}>Sign in to your account</Text>
            <Text style={styles.accountPromptCopy}>Keep Daily Cheshbon available on your phone and computer.</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/settings')} style={styles.accountButton}>
            <LogIn color="#FFFFFF" size={17} />
            <Text style={styles.accountButtonText}>Sign in</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Image
            accessibilityIgnoresInvertColors
            accessible
            accessibilityLabel="Daily Cheshbon logo"
            resizeMode="contain"
            source={require('@/assets/daily-cheshbon-logo.png')}
            style={styles.logoMark}
          />
          <View style={styles.brandText}>
            <Text style={styles.title}>Daily Cheshbon</Text>
            <Text style={styles.tagline}>A nightly cheshbon hanefesh for intentional growth.</Text>
          </View>
        </View>
        <Text style={styles.eyebrow}>{dayName(today)}</Text>
        <Text style={styles.hebrewDate}>{formatEnglishDate(today)} | {formatHebrewDate(today)}</Text>
      </View>

      <View style={styles.avodahSection}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionTitleText}>
            <Text style={styles.avodahEyebrow}>Deliberate growth</Text>
            <Text style={styles.sectionTitle}>Current Avodah</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/avodah')} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Manage</Text>
          </Pressable>
        </View>
        {experiments.length ? experiments.map((experiment) => (
          <Pressable accessibilityRole="button" key={experiment.id} onPress={() => router.push({ pathname: '/avodah/edit', params: { id: experiment.id } })} style={styles.avodahCard}>
            <View style={styles.avodahCardHeader}>
              <View style={styles.avodahCardTitleBlock}>
                <Text style={styles.avodahCardEyebrow}>{experiment.type === 'middah' ? 'Current Middah' : 'Current Avodah'}</Text>
                <Text style={styles.avodahCardTitle}>{experiment.title}</Text>
              </View>
              <FlaskConical color={colors.amber} size={20} />
            </View>
            <Text style={styles.avodahGoal}>{experiment.goal}</Text>
            <Text style={styles.avodahBehavior}>{experiment.behavior}</Text>
            <Text style={styles.avodahMeta}>Review {monthDay(experiment.reviewDate)} · {experiment.stats.opportunities} opportunities noticed</Text>
          </Pressable>
        )) : (
          <Pressable accessibilityRole="button" onPress={() => router.push('/avodah/edit')} style={styles.emptyAvodah}>
            <FlaskConical color={colors.amber} size={20} />
            <View style={styles.emptyAvodahText}><Text style={styles.emptyAvodahTitle}>Begin a focused experiment</Text><Text style={styles.emptyText}>Choose one behavior to practice for a defined period.</Text></View>
          </Pressable>
        )}
      </View>

      <View style={styles.foundationBand}>
        <Text style={styles.foundationEyebrow}>Foundations</Text>
        <Text style={styles.foundationTitle}>How you are living</Text>
        <View style={styles.domainRow}>{foundationDomains.map((domain) => <View key={domain} style={styles.domainChip}><Text style={styles.domainChipText}>{domain}</Text></View>)}</View>
      </View>

      <View style={styles.primaryPanel}>
        <View style={styles.primaryText}>
          <Text style={styles.panelTitle}>
            {reviewComplete
              ? 'Review Complete'
              : primaryReviewIsYesterday
                ? "Complete yesterday's review"
                : 'Nightly Review'}
          </Text>
          <Text style={styles.panelCopy}>
            {reviewComplete
              ? `Your Daily Cheshbon is complete for ${primaryReviewIsYesterday ? 'yesterday' : 'today'}. You can still edit it if something important comes back to mind.`
              : reviewStarted
                ? 'Progress is saved. Continue when you are ready, then mark it complete.'
                : 'Reviewing your day cultivates real time awareness and helps you stay mindful.'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => openReview(primaryReviewDate)}
          style={[styles.reviewButton, reviewComplete && styles.editReviewButton]}
        >
          <NotebookPen color="#FFFFFF" size={18} />
          <Text style={styles.reviewButtonText}>
            {reviewComplete
              ? 'Edit review'
              : reviewStarted
                ? 'Continue review'
                : primaryReviewIsYesterday
                  ? "Complete yesterday's review"
                  : 'Start nightly review'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.statBox}>
        <View style={styles.statHeader}>
          <Flame color={colors.green} size={18} />
          <Text style={styles.statValue}>{summary.streak}</Text>
        </View>
        <Text style={styles.statLabel}>day streak</Text>
      </View>

      <Pressable accessibilityRole="button" onPress={() => router.push('/reset')} style={styles.resetButton}>
        <RotateCcw color={colors.green} size={16} />
        <Text style={styles.resetButtonText}>I need to reset</Text>
      </Pressable>

      {hasMorningReminder ? (
        <View style={styles.reminderPanel}>
          <View style={styles.reminderHeader}>
            <Bell color={colors.blue} size={18} />
            <Text style={styles.sectionTitle}>Good morning</Text>
          </View>
          {summary.morningReminder.dailyAvodah ? (
            <Text style={styles.reminderText}>
              Today you wanted to work on: <Text style={styles.reminderStrong}>{summary.morningReminder.dailyAvodah}</Text>
            </Text>
          ) : null}
          {summary.morningReminder.markedPractices.length ? (
            <View style={styles.markedList}>
              <Text style={styles.reminderText}>Remember to focus on:</Text>
              {summary.morningReminder.markedPractices.map((practice, index) => (
                <Text key={practice} style={styles.markedItem}>
                  {index + 1}. {practice}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Weekly Cheshbon</Text>
        <Text style={styles.panelCopy}>Notice a win, a pattern, and what you want to carry forward.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push('/weekly-cheshbon')} style={styles.secondaryButton}>
          <NotebookPen color={colors.ink} size={17} />
          <Text style={styles.secondaryButtonText}>Open weekly Cheshbon</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Past daily reviews</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => openReview(yesterday)}
          style={styles.secondaryButton}
        >
          <CalendarDays color={colors.ink} size={17} />
          <Text style={styles.secondaryButtonText}>Go to yesterday&apos;s review</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionTitleText}>
            <Text style={styles.sectionTitle}>Gratitude Journal</Text>
          </View>
          <JournalButton kind="gratitude" label="See all" />
        </View>
        {summary.recentGratitude.length ? (
          <View style={styles.gratitudeList}>
            {summary.recentGratitude.map((item) => (
              <View key={`${item.date}-${item.text}`} style={styles.gratitudeItem}>
                <Text style={styles.gratitudeDate}>{monthDay(item.date)}</Text>
                <Text style={styles.gratitudeText}>{item.text}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No recent gratitude notes yet.</Text>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionTitleText}>
            <Text style={styles.sectionTitle}>Thought Journal</Text>
          </View>
          <JournalButton kind="thoughts" label="See all" />
        </View>
        {summary.thoughtJournal.length ? (
          <View style={styles.journalList}>
            {summary.thoughtJournal.map((item) => (
              <View key={`${item.date}-${item.practiceName}-${item.text}`} style={styles.journalItem}>
                <View style={styles.journalHeader}>
                  <Text style={styles.gratitudeDate}>{monthDay(item.date)}</Text>
                  <Text style={styles.journalPractice}>{item.practiceName}</Text>
                </View>
                <Text style={styles.gratitudeText}>{item.text}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No previous thoughts yet.</Text>
        )}
      </View>

      <View style={styles.statBox}>
        <Text style={styles.statValue}>{summary.reviewedPractices}</Text>
        <Text style={styles.statLabel}>all-time practices reviewed</Text>
      </View>
    </ScrollView>
  );
}

function openReview(date: string) {
  router.push({ pathname: '/review/[date]', params: { date } });
}

function isBeforeNoon() {
  return new Date().getHours() < 12;
}

function JournalButton({ kind, label }: { kind: 'gratitude' | 'thoughts'; label: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/journal/[kind]', params: { kind } })}
      style={styles.secondaryButton}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function GoalCard({ title, text, empty }: { title: string; text: string | null; empty: string }) {
  return (
    <View style={styles.goalCard}>
      <Text style={styles.goalTitle}>{title}</Text>
      <Text style={text ? styles.goalText : styles.emptyText}>{text || empty}</Text>
    </View>
  );
}

function formatHebrewDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(year, month - 1, day);
  try {
    return new Intl.DateTimeFormat('en-u-ca-hebrew', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(value);
  } catch {
    return '';
  }
}

function formatEnglishDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

const styles = StyleSheet.create({
  avodahBehavior: { backgroundColor: colors.amberSoft, borderRadius: 8, color: colors.ink, fontSize: 14, fontWeight: '800', lineHeight: 20, padding: spacing.md, textAlign: 'left' },
  avodahCard: { backgroundColor: '#FFFCF6', borderColor: '#E7C98E', borderLeftColor: colors.amber, borderLeftWidth: 4, borderRadius: 8, borderWidth: 1, gap: spacing.sm, padding: spacing.lg },
  avodahCardEyebrow: { color: colors.amber, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  avodahCardHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  avodahCardTitle: { color: colors.ink, fontSize: 20, fontWeight: '900', textAlign: 'left' },
  avodahCardTitleBlock: { flex: 1, gap: spacing.xs },
  avodahEyebrow: { color: colors.amber, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  avodahGoal: { color: colors.ink, fontSize: 15, lineHeight: 21, textAlign: 'left' },
  avodahMeta: { color: colors.muted, fontSize: 12, fontWeight: '700', textAlign: 'left' },
  avodahSection: { gap: spacing.md },
  center: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    flex: 1,
    justifyContent: 'center',
  },
  container: {
    backgroundColor: colors.paper,
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: 96,
  },
  accountButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.blue,
    borderRadius: 8,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  accountButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'left',
  },
  accountPrompt: {
    alignItems: 'flex-start',
    backgroundColor: colors.blueSoft,
    borderColor: '#BFD2F7',
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  accountPromptCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'left',
  },
  accountPromptText: {
    gap: spacing.xs,
  },
  accountPromptTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'left',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'left',
  },
  emptyAvodah: { alignItems: 'flex-start', backgroundColor: '#FFFCF6', borderColor: '#E7C98E', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  emptyAvodahText: { flex: 1, gap: spacing.xs },
  emptyAvodahTitle: { color: colors.ink, fontSize: 16, fontWeight: '900', textAlign: 'left' },
  foundationBand: { backgroundColor: '#F2F5F8', borderColor: '#D8E0E8', borderRadius: 8, borderWidth: 1, gap: spacing.sm, padding: spacing.lg },
  foundationEyebrow: { color: '#52677D', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  foundationTitle: { color: colors.ink, fontSize: 18, fontWeight: '900', textAlign: 'left' },
  domainRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  domainChip: { backgroundColor: colors.surface, borderColor: '#C9D4DE', borderRadius: 8, borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  domainChipText: { color: '#52677D', fontSize: 12, fontWeight: '800' },
  eyebrow: {
    color: colors.green,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'left',
    textTransform: 'uppercase',
  },
  goalCard: {
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  goalText: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'left',
  },
  goalTitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'left',
    textTransform: 'uppercase',
  },
  markedItem: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'left',
  },
  markedList: {
    gap: spacing.xs,
  },
  gratitudeDate: {
    color: colors.green,
    fontSize: 13,
    fontWeight: '900',
    minWidth: 72,
    textAlign: 'left',
  },
  gratitudeItem: {
    alignItems: 'flex-start',
    borderTopColor: colors.softLine,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  gratitudeList: {
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
  },
  gratitudeText: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'left',
  },
  header: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  brandText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  hebrewDate: {
    color: colors.muted,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'left',
  },
  panelCopy: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'left',
  },
  panelTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'left',
  },
  reminderHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  reminderPanel: {
    backgroundColor: colors.blueSoft,
    borderColor: '#BFD2F7',
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  reminderStrong: {
    color: colors.ink,
    fontWeight: '900',
  },
  reminderText: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'left',
  },
  primaryPanel: {
    alignItems: 'flex-start',
    backgroundColor: colors.greenSoft,
    borderColor: '#CBE8DA',
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  primaryText: {
    gap: spacing.xs,
  },
  reviewButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.green,
    borderRadius: 8,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  editReviewButton: {
    backgroundColor: colors.blue,
  },
  reviewButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'left',
  },
  resetButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 40,
    paddingHorizontal: spacing.md,
  },
  resetButtonText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'left',
  },
  journalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  journalItem: {
    borderTopColor: colors.softLine,
    borderTopWidth: 1,
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  journalList: {
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
  },
  journalPractice: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'left',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  secondaryButtonText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'left',
  },
  section: {
    gap: spacing.md,
  },
  sectionMeta: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
    marginTop: -spacing.sm,
    textAlign: 'left',
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'left',
  },
  sectionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  sectionTitleText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 180,
  },
  statBox: {
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    minHeight: 86,
    padding: spacing.lg,
  },
  statHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'left',
  },
  statValue: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'left',
  },
  title: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 38,
    textAlign: 'left',
  },
  logoMark: {
    borderRadius: 8,
    height: 76,
    width: 76,
  },
  tagline: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
    textAlign: 'left',
  },
});
