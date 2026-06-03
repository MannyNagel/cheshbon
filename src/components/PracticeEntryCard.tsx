import { Bell, StickyNote } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BlockerSelector } from '@/src/components/BlockerSelector';
import { MetricInput } from '@/src/components/MetricInput';
import { colors, spacing } from '@/src/components/ui';
import type { Blocker, EntryDraft, EntryStatus, MetricValueDraft, NightlyReviewItem } from '@/src/models/types';

type Props = {
  item: NightlyReviewItem;
  blockers: Blocker[];
  draft?: EntryDraft;
  onChange: (entry: EntryDraft) => void;
};

export function PracticeEntryCard({ item, blockers, draft, onChange }: Props) {
  const entry: EntryDraft =
    draft ?? {
      practiceId: item.practiceId,
      status: null,
      note: null,
      remindTomorrow: false,
      metricValues: {},
      blockerIds: [],
    };
  const [noteOpen, setNoteOpen] = useState(Boolean(entry.note && item.allowNote));

  function updateMetric(metricValue: MetricValueDraft) {
    const metric = item.metrics.find((candidate) => candidate.id === metricValue.metricId);
    if (metric?.metricType === 'enum' && metricValue.valueText === 'not_applicable') {
      onChange({
        ...entry,
        status: 'not_applicable',
        note: null,
        remindTomorrow: false,
        blockerIds: [],
        metricValues: {
          [metricValue.metricId]: metricValue,
        },
      });
      setNoteOpen(false);
      return;
    }

    onChange({
      ...entry,
      note: item.allowNote ? entry.note : null,
      status:
        metric?.name.toLowerCase() === 'status' && metricValue.valueText
          ? (metricValue.valueText as EntryStatus)
          : entry.status,
      metricValues: {
        ...entry.metricValues,
        [metricValue.metricId]: metricValue,
      },
    });
  }

  const collapseAfterNotApplicable = item.metrics.some(
    (metric) => metric.metricType === 'enum' && entry.metricValues[metric.id]?.valueText === 'not_applicable',
  );
  const visibleMetrics = collapseAfterNotApplicable
    ? item.metrics.filter((metric) => entry.metricValues[metric.id]?.valueText === 'not_applicable')
    : item.metrics;
  const visibleBlockers = Array.isArray(item.allowedBlockerIds)
    ? blockers.filter((blocker) => item.allowedBlockerIds?.includes(blocker.id))
    : blockers;
  const showBlockers = visibleBlockers.length > 0;
  const showNote = item.allowNote;
  const weeklyGoalMetric = item.weeklyGoal ? item.metrics.find((metric) => metric.metricType === 'boolean') : null;
  const completedThisReview = weeklyGoalMetric ? entry.metricValues[weeklyGoalMetric.id]?.valueBoolean === true : false;
  const weeklyGoalCompleted = item.weeklyGoal ? item.weeklyGoal.completedBeforeToday + (completedThisReview ? 1 : 0) : 0;
  const weeklyGoalRatio = item.weeklyGoal ? Math.min(1, weeklyGoalCompleted / item.weeklyGoal.target) : 0;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{item.displayName}</Text>
          <Text style={styles.meta}>{item.domainName}</Text>
        </View>
        {item.markable ? (
          <Pressable
            accessibilityRole="switch"
            onPress={() => onChange({ ...entry, remindTomorrow: !entry.remindTomorrow })}
            style={[styles.reminderButton, entry.remindTomorrow && styles.reminderButtonOn]}
          >
            <Bell color={entry.remindTomorrow ? colors.blue : colors.muted} size={15} />
            <Text style={[styles.reminderText, entry.remindTomorrow && styles.reminderTextOn]}>Remember</Text>
          </Pressable>
        ) : null}
      </View>
      {item.helpText ? <Text style={styles.help}>{item.helpText}</Text> : null}
      {item.weeklyGoal ? (
        <View style={styles.weeklyGoal}>
          <View style={styles.weeklyGoalRow}>
            <Text style={styles.weeklyGoalLabel}>Weekly goal</Text>
            <Text style={[styles.weeklyGoalCount, weeklyGoalCompleted >= item.weeklyGoal.target && styles.weeklyGoalMet]}>
              {weeklyGoalCompleted} of {item.weeklyGoal.target} since Shabbos
            </Text>
          </View>
          <View style={styles.weeklyGoalTrack}>
            <View style={[styles.weeklyGoalFill, { width: `${weeklyGoalRatio * 100}%` }]} />
          </View>
        </View>
      ) : null}
      <View style={styles.metrics}>
        {visibleMetrics.map((metric) => (
          <MetricInput
            key={metric.id}
            metric={metric}
            onChange={updateMetric}
            value={entry.metricValues[metric.id]}
          />
        ))}
      </View>
      {collapseAfterNotApplicable ? null : (
        <>
      <View style={styles.quickActions}>
        {showBlockers ? (
          <BlockerSelector
            blockers={visibleBlockers}
            onChange={(blockerIds) => onChange({ ...entry, blockerIds })}
            selectedIds={entry.blockerIds.filter((blockerId) => visibleBlockers.some((blocker) => blocker.id === blockerId))}
          />
        ) : null}
        {showNote ? (
          <Pressable accessibilityRole="button" onPress={() => setNoteOpen((value) => !value)} style={styles.noteButton}>
            <StickyNote color={colors.ink} size={17} />
            <Text style={styles.noteButtonText}>{entry.note ? 'Note added' : 'Add note'}</Text>
          </Pressable>
        ) : null}
      </View>
      {showNote && noteOpen ? (
        <TextInput
          onChangeText={(note) => onChange({ ...entry, note })}
          placeholder="Optional note"
          placeholderTextColor={colors.muted}
          style={styles.note}
          value={entry.note ?? ''}
        />
      ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  titleBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
  },
  help: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  weeklyGoal: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  weeklyGoalRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  weeklyGoalLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  weeklyGoalCount: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  weeklyGoalMet: {
    color: colors.green,
  },
  weeklyGoalTrack: {
    backgroundColor: colors.surface,
    borderRadius: 999,
    height: 7,
    overflow: 'hidden',
  },
  weeklyGoalFill: {
    backgroundColor: colors.green,
    borderRadius: 999,
    height: 7,
  },
  metrics: {
    gap: spacing.lg,
  },
  quickActions: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  noteButton: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 40,
    paddingHorizontal: spacing.md,
  },
  noteButtonText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  reminderButton: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 32,
    paddingHorizontal: spacing.sm,
  },
  reminderButtonOn: {
    backgroundColor: colors.blueSoft,
    borderColor: colors.blue,
  },
  reminderText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  reminderTextOn: {
    color: colors.blue,
  },
  note: {
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
});
