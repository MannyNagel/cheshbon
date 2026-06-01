import { Bell, CalendarDays, CheckCircle2, CircleAlert, Flame, NotebookPen } from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, spacing } from '@/src/components/ui';
import { getHomeSummary, type HomeSummary } from '@/src/repositories/cheshbonRepo';
import { addDaysIso, dayName, monthDay, todayIsoDate } from '@/src/utils/dates';

export default function HomeScreen() {
  const today = todayIsoDate();
  const yesterday = addDaysIso(today, -1);
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [reviewDate, setReviewDate] = useState(yesterday);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getHomeSummary(today)
        .then((nextSummary) => {
          if (active) setSummary(nextSummary);
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
    if (!summary) return;
    const body = morningReminderText(summary);
    if (!body || typeof window === 'undefined' || !('Notification' in window)) return;
    const hour = new Date().getHours();
    if (hour < 5 || hour > 11) return;
    const storageKey = `cheshbon_morning_reminder_${today}`;
    if (window.localStorage.getItem(storageKey)) return;
    const showNotification = () => {
      window.localStorage.setItem(storageKey, 'shown');
      new Notification('Good morning', { body });
    };
    if (Notification.permission === 'granted') {
      showNotification();
    } else if (Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') showNotification();
      });
    }
  }, [summary, today]);

  if (loading || !summary) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.blue} />
      </View>
    );
  }

  const statusColor = summary.reviewComplete ? colors.green : colors.amber;
  const statusBackground = summary.reviewComplete ? colors.greenSoft : colors.amberSoft;
  const hasMorningReminder = Boolean(summary.morningReminder.dailyAvodah || summary.morningReminder.markedPractices.length);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{dayName(today)}</Text>
        <Text style={styles.title}>{formatEnglishDate(today)}</Text>
        <Text style={styles.hebrewDate}>{formatHebrewDate(today)}</Text>
        <View style={[styles.statusPill, { backgroundColor: statusBackground }]}>
          {summary.reviewComplete ? <CheckCircle2 color={statusColor} size={18} /> : <CircleAlert color={statusColor} size={18} />}
          <Text style={[styles.statusText, { color: statusColor }]}>
            Today&apos;s review: {summary.reviewComplete ? 'complete' : 'incomplete'}
          </Text>
        </View>
      </View>

      <View style={styles.primaryPanel}>
        <View style={styles.primaryText}>
          <Text style={styles.panelTitle}>{summary.reviewComplete ? 'Review complete' : 'Nightly review'}</Text>
          <Text style={styles.panelCopy}>
            {summary.reviewComplete
              ? 'The day has been reviewed. You can still edit it if something important comes back to mind.'
              : summary.reviewStarted
                ? 'Progress is saved. Continue when you are ready, then mark it complete.'
                : 'Start with the facts of the day, then notice what deserves attention.'}
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

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <View style={styles.statHeader}>
            <Flame color={colors.green} size={18} />
            <Text style={styles.statValue}>{summary.streak}</Text>
          </View>
          <Text style={styles.statLabel}>day streak</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{summary.reviewedPractices}</Text>
          <Text style={styles.statLabel}>all-time practices reviewed</Text>
        </View>
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Past daily reviews</Text>
        <View style={styles.reviewPicker}>
          <Pressable
            accessibilityRole="button"
            onPress={() => openReview(yesterday)}
            style={styles.secondaryButton}
          >
            <CalendarDays color={colors.ink} size={17} />
            <Text style={styles.secondaryButtonText}>Yesterday</Text>
          </Pressable>
          <View style={styles.dateJump}>
            <TextInput
              onChangeText={setReviewDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
              style={styles.dateInput}
              value={reviewDate}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => openReview(reviewDate.trim() || yesterday)}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Open date</Text>
            </Pressable>
          </View>
        </View>
      </View>

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
        <Text style={styles.sectionTitle}>What I have been grateful for recently</Text>
        <Text style={styles.sectionMeta}>Past 7 days</Text>
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
    </ScrollView>
  );
}

function openReview(date: string) {
  router.push({ pathname: '/review/[date]', params: { date } });
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
  dateInput: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    minHeight: 44,
    minWidth: 150,
    paddingHorizontal: spacing.md,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  dateJump: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    minWidth: 220,
  },
  reviewPicker: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statValue: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'left',
  },
  statusPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 8,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'left',
  },
  title: {
    color: colors.ink,
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 42,
    textAlign: 'left',
  },
});
