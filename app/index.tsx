import { CheckCircle2, CircleAlert, Flame, NotebookPen } from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/src/components/ui';
import { getHomeSummary, type HomeSummary } from '@/src/repositories/cheshbonRepo';
import { dayName, monthDay, todayIsoDate } from '@/src/utils/dates';

export default function HomeScreen() {
  const today = todayIsoDate();
  const [summary, setSummary] = useState<HomeSummary | null>(null);
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

  if (loading || !summary) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.blue} />
      </View>
    );
  }

  const statusColor = summary.reviewComplete ? colors.green : colors.amber;
  const statusBackground = summary.reviewComplete ? colors.greenSoft : colors.amberSoft;

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
          onPress={() => router.push(`/review/${today}`)}
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
          <Text style={styles.statLabel}>practices reviewed</Text>
        </View>
      </View>

      <View style={styles.activityPanel}>
        <Text style={styles.sectionTitle}>Today&apos;s reflection</Text>
        <View style={styles.activityRows}>
          <ActivityLine value={summary.reviewedPractices} label="practices reviewed" />
          <ActivityLine value={summary.notesAdded} label="notes added" />
          <ActivityLine value={summary.patternsWorthNoticing} label="patterns worth noticing" />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current goals</Text>
        <GoalCard title="What I wanted to work on today" text={summary.workOnToday} empty="No focus from yesterday yet." />
        <GoalCard title="What I wanted to work on this week" text={summary.workOnThisWeek} empty="No weekly focus saved yet." />
      </View>

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

function ActivityLine({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.activityLine}>
      <Text style={styles.activityValue}>{value}</Text>
      <Text style={styles.activityLabel}>{label}</Text>
    </View>
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
  activityLabel: {
    color: colors.muted,
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'left',
  },
  activityLine: {
    alignItems: 'center',
    borderTopColor: colors.softLine,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  activityPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  activityRows: {
    gap: 0,
  },
  activityValue: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '900',
    minWidth: 34,
    textAlign: 'left',
  },
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
