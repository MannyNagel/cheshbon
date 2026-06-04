import { Bell, CalendarDays, Flame, LogIn, NotebookPen } from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/src/components/ui';
import { getHomeSummary, getOnboardingStatus, getReminderPreferences, type HomeSummary, type ReminderPreferences } from '@/src/repositories/cheshbonRepo';
import { getCloudStatus, type CloudStatus } from '@/src/services/cloudSyncService';
import { addDaysIso, dayName, monthDay, todayIsoDate } from '@/src/utils/dates';

export default function HomeScreen() {
  const today = todayIsoDate();
  const yesterday = addDaysIso(today, -1);
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [reminderPreferences, setReminderPreferences] = useState<ReminderPreferences | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      Promise.all([
        getHomeSummary(today),
        getReminderPreferences(),
        getOnboardingStatus(),
        getCloudStatus().catch(() => ({ configured: true, signedIn: false, email: null, name: null, lastSyncedAt: null })),
      ])
        .then(([nextSummary, nextReminderPreferences, nextOnboardingStatus, nextCloudStatus]) => {
          if (active) {
            if (nextOnboardingStatus.needsOnboarding) {
              router.replace('/welcome');
              return;
            }
            setSummary(nextSummary);
            setReminderPreferences(nextReminderPreferences);
            setCloudStatus(nextCloudStatus);
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [today]),
  );

  useEffect(() => {
    if (!summary || !reminderPreferences?.morningReminderEnabled) return;
    const body = morningReminderText(summary);
    if (!body || typeof window === 'undefined' || !('Notification' in window)) return;
    const storageKey = `cheshbon_morning_reminder_${today}`;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const showNotification = () => {
      if (window.localStorage.getItem(storageKey)) return;
      window.localStorage.setItem(storageKey, 'shown');
      new Notification('Good morning', { body });
    };

    const attemptNotification = () => {
      const now = new Date();
      const target = morningReminderTarget(now, reminderPreferences.morningReminderTime);
      const cutoff = new Date(target);
      cutoff.setHours(12, 0, 0, 0);
      if (now < target) {
        timer = setTimeout(attemptNotification, target.getTime() - now.getTime());
        return;
      }
      if (now > cutoff || window.localStorage.getItem(storageKey)) return;
      if (Notification.permission === 'granted') {
        showNotification();
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') showNotification();
        });
      }
    };

    attemptNotification();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [reminderPreferences, summary, today]);

  if (loading || !summary || !reminderPreferences || !cloudStatus) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.blue} />
      </View>
    );
  }

  const hasMorningReminder = reminderPreferences.morningReminderEnabled && Boolean(summary.morningReminder.dailyAvodah || summary.morningReminder.markedPractices.length);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {!cloudStatus.signedIn ? (
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

      <View style={styles.primaryPanel}>
        <View style={styles.primaryText}>
          <Text style={styles.panelTitle}>{summary.reviewComplete ? 'Review Complete' : 'Nightly Review'}</Text>
          <Text style={styles.panelCopy}>
            {summary.reviewComplete
              ? 'Your Daily Cheshbon is complete for today. You can still edit it if something important comes back to mind.'
              : summary.reviewStarted
                ? 'Progress is saved. Continue when you are ready, then mark it complete.'
                : 'Reviewing your day cultivates real time awareness and helps you stay mindful.'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => openReview(today)}
          style={[styles.reviewButton, summary.reviewComplete && styles.editReviewButton]}
        >
          <NotebookPen color="#FFFFFF" size={18} />
          <Text style={styles.reviewButtonText}>
            {summary.reviewComplete ? 'Edit review' : summary.reviewStarted ? 'Continue review' : 'Start nightly review'}
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

      {summary.currentAvodah.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Avodah</Text>
          {summary.currentAvodah.map((item) => (
            <GoalCard
              key={`${item.practiceId}-${item.date}`}
              title={`${item.practiceName} · ${monthDay(item.date)}`}
              text={item.text}
              empty=""
            />
          ))}
        </View>
      ) : null}

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

function morningReminderText(summary: HomeSummary) {
  const lines: string[] = [];
  if (summary.morningReminder.dailyAvodah) {
    lines.push(`Today you wanted to work on: ${summary.morningReminder.dailyAvodah}`);
  }
  if (summary.morningReminder.markedPractices.length) {
    lines.push('Remember to focus on the following practices today:');
    summary.morningReminder.markedPractices.forEach((practice, index) => {
      lines.push(`${index + 1}. ${practice}`);
    });
  }
  return lines.join('\n');
}

function morningReminderTarget(now: Date, time = '05:30') {
  const [hours, minutes] = time.split(':').map(Number);
  const target = new Date(now);
  target.setHours(Number.isFinite(hours) ? hours : 5, Number.isFinite(minutes) ? minutes : 30, 0, 0);
  return target;
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
