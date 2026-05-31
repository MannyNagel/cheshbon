import { CalendarDays, CheckCircle2, Save, SkipBack, SkipForward } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ReviewSection } from '@/src/components/ReviewSection';
import { colors, spacing } from '@/src/components/ui';
import type { Blocker, EntryDraft, NightlyReviewDraft, NightlyReviewSection } from '@/src/models/types';
import { getActiveBlockers, getCurrentReviewStreak, getReviewDraft, getReviewStatusMap, saveNightlyReview } from '@/src/repositories/cheshbonRepo';
import { pushLocalDataToCloudIfSignedIn } from '@/src/services/cloudSyncService';
import { getNightlyReviewItems } from '@/src/services/activeRoutineService';
import { addDaysIso, dayName, dayOfMonth, monthDay, shortDayName, todayIsoDate } from '@/src/utils/dates';

type Props = {
  initialDate?: string;
};

export function NightlyReviewScreen({ initialDate = todayIsoDate() }: Props) {
  const [reviewDate, setReviewDate] = useState(initialDate);
  const [sections, setSections] = useState<NightlyReviewSection[]>([]);
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [draft, setDraft] = useState<NightlyReviewDraft>({ session: {}, entries: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [savedDates, setSavedDates] = useState<Set<string>>(new Set());
  const [streak, setStreak] = useState(0);
  const [calendarMode, setCalendarMode] = useState<'week' | 'month'>('week');

  const load = useCallback(async () => {
    setLoading(true);
    const range = getCalendarRange(reviewDate, calendarMode);
    const [reviewSections, activeBlockers, savedDraft] = await Promise.all([
      getNightlyReviewItems(reviewDate),
      getActiveBlockers(),
      getReviewDraft(reviewDate),
    ]);
    setSections(reviewSections);
    setBlockers(activeBlockers);
    setDraft(savedDraft);
    setLoading(false);
    const [nextSavedDates, nextStreak] = await Promise.all([
      getReviewStatusMap(range.start, range.end),
      getCurrentReviewStreak(),
    ]);
    setSavedDates(nextSavedDates);
    setStreak(nextStreak);
  }, [calendarMode, reviewDate]);

  useFocusEffect(
    useCallback(() => {
      load().catch((error) => {
        setMessage(error instanceof Error ? error.message : 'Could not load review');
        setLoading(false);
      });
    }, [load]),
  );

  function updateEntry(entry: EntryDraft) {
    setDraft((current) => ({
      ...current,
      entries: {
        ...current.entries,
        [entry.practiceId]: entry,
      },
    }));
  }

  async function save(complete = false) {
    setSaving(true);
    setMessage(null);
    try {
      await saveNightlyReview(reviewDate, draft, { complete });
      if (complete) {
        setDraft((current) => ({
          ...current,
          session: { ...current.session, completedAt: new Date().toISOString() },
        }));
      }
      let nextMessage = complete ? 'Review marked complete.' : 'Progress saved.';
      try {
        const syncedAt = await pushLocalDataToCloudIfSignedIn();
        if (syncedAt) nextMessage = complete ? 'Review completed and pushed to cloud.' : 'Progress saved and pushed to cloud.';
      } catch (syncError) {
        nextMessage = syncError instanceof Error ? `${nextMessage} Cloud push failed: ${syncError.message}` : `${nextMessage} Cloud push failed.`;
      }
      setMessage(nextMessage);
      const range = getCalendarRange(reviewDate, calendarMode);
      const [nextSavedDates, nextStreak] = await Promise.all([
        getReviewStatusMap(range.start, range.end),
        getCurrentReviewStreak(),
      ]);
      setSavedDates(nextSavedDates);
      setStreak(nextStreak);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save review');
    } finally {
      setSaving(false);
    }
  }

  const isComplete = Boolean(draft.session.completedAt);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Nightly review</Text>
        <Text style={styles.title}>Cheshbon Hanefesh</Text>
        <Text style={styles.subtitle}>
          {dayName(reviewDate)} | {monthDay(reviewDate)}
        </Text>
        <View style={[styles.completionPill, isComplete ? styles.completionPillComplete : styles.completionPillIncomplete]}>
          <Text style={[styles.completionText, isComplete ? styles.completionTextComplete : styles.completionTextIncomplete]}>
            {isComplete ? 'Complete' : 'Incomplete'}
          </Text>
        </View>
        <View style={styles.streakRow}>
          <Text style={styles.streakText}>{streak} day streak</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setCalendarMode((mode) => (mode === 'week' ? 'month' : 'week'))}
            style={styles.calendarToggle}
          >
            <CalendarDays color={colors.ink} size={17} />
            <Text style={styles.calendarToggleText}>{calendarMode === 'week' ? 'Month' : 'Week'}</Text>
          </Pressable>
        </View>
        <View style={calendarMode === 'week' ? styles.calendarStrip : styles.monthGrid}>
          {getCalendarDates(reviewDate, calendarMode).map((date) => {
            const selected = date === reviewDate;
            const saved = savedDates.has(date);
            const missed = date < todayIsoDate() && !saved;
            return (
              <Pressable
                accessibilityRole="button"
                key={date}
                onPress={() => setReviewDate(date)}
                style={[
                  calendarMode === 'week' ? styles.calendarDay : styles.monthDay,
                  saved && styles.calendarDaySaved,
                  missed && styles.calendarDayMissed,
                  selected && styles.calendarDaySelected,
                ]}
              >
                <Text style={[styles.calendarWeekday, selected && styles.calendarTextSelected]}>{shortDayName(date)}</Text>
                <Text style={[styles.calendarNumber, selected && styles.calendarTextSelected]}>{dayOfMonth(date)}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.dateRow}>
          <IconButton label="Previous day" onPress={() => setReviewDate(addDaysIso(reviewDate, -1))}>
            <SkipBack color={colors.ink} size={18} />
          </IconButton>
          <TextInput
            onChangeText={setReviewDate}
            style={styles.dateInput}
            value={reviewDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.muted}
          />
          <IconButton label="Next day" onPress={() => setReviewDate(addDaysIso(reviewDate, 1))}>
            <SkipForward color={colors.ink} size={18} />
          </IconButton>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.blue} />
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.sleepCard}>
            <Text style={styles.sleepTitle}>Sleep</Text>
            <View style={styles.sleepRow}>
              <View style={styles.sleepField}>
                <Text style={styles.inputLabel}>Bed last night</Text>
                <TextInput
                  onChangeText={(bedTime) =>
                    setDraft((current) => ({ ...current, session: { ...current.session, bedTime } }))
                  }
                  placeholder="10:45 PM"
                  placeholderTextColor={colors.muted}
                  style={styles.sleepInput}
                  value={draft.session.bedTime ?? ''}
                />
              </View>
              <View style={styles.sleepField}>
                <Text style={styles.inputLabel}>Got out of bed</Text>
                <TextInput
                  onChangeText={(wakeTime) =>
                    setDraft((current) => ({ ...current, session: { ...current.session, wakeTime } }))
                  }
                  placeholder="7:15 AM"
                  placeholderTextColor={colors.muted}
                  style={styles.sleepInput}
                  value={draft.session.wakeTime ?? ''}
                />
              </View>
            </View>
          </View>
          {sections.length === 0 ? (
            <Text style={styles.empty}>No routines are active for this date.</Text>
          ) : (
            sections.map((section) => (
              <ReviewSection
                blockers={blockers}
                entries={draft.entries}
                key={section.id}
                onEntryChange={updateEntry}
                section={section}
              />
            ))
          )}

          <View style={styles.actionRow}>
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => save(false)} style={styles.progressButton}>
              <Save color="#FFFFFF" size={18} />
              <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save progress'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => save(true)} style={styles.completeButton}>
              <CheckCircle2 color="#FFFFFF" size={18} />
              <Text style={styles.saveText}>{saving ? 'Saving...' : 'Complete'}</Text>
            </Pressable>
          </View>
          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>
      )}
    </ScrollView>
  );
}

function getCalendarDates(reviewDate: string, mode: 'week' | 'month') {
  if (mode === 'week') {
    return Array.from({ length: 7 }, (_, index) => addDaysIso(reviewDate, index - 3));
  }
  const [year, month] = reviewDate.split('-').map(Number);
  const first = new Date(year, month - 1, 1);
  const count = new Date(year, month, 0).getDate();
  const leading = first.getDay();
  const start = addDaysIso(`${year}-${String(month).padStart(2, '0')}-01`, -leading);
  const total = Math.ceil((leading + count) / 7) * 7;
  return Array.from({ length: total }, (_, index) => addDaysIso(start, index));
}

function getCalendarRange(reviewDate: string, mode: 'week' | 'month') {
  const dates = getCalendarDates(reviewDate, mode);
  return { start: dates[0], end: dates[dates.length - 1] };
}

function IconButton({ label, children, onPress }: { label: string; children: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={styles.iconButton}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.paper,
    paddingBottom: 96,
  },
  hero: {
    backgroundColor: '#EDF7F0',
    borderBottomColor: colors.softLine,
    borderBottomWidth: 1,
    gap: spacing.md,
    padding: spacing.xl,
  },
  eyebrow: {
    color: colors.green,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 23,
    maxWidth: 620,
  },
  completionPill: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  completionPillComplete: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  completionPillIncomplete: {
    backgroundColor: colors.amberSoft,
    borderColor: colors.amber,
  },
  completionText: {
    fontSize: 14,
    fontWeight: '900',
  },
  completionTextComplete: {
    color: colors.green,
  },
  completionTextIncomplete: {
    color: colors.amber,
  },
  calendarStrip: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  calendarDay: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    minHeight: 58,
    minWidth: 42,
    paddingVertical: spacing.sm,
  },
  calendarDaySelected: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  calendarDaySaved: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  calendarDayMissed: {
    backgroundColor: colors.roseSoft,
    borderColor: colors.rose,
  },
  monthDay: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    minHeight: 54,
    paddingVertical: spacing.xs,
    width: 54,
  },
  calendarWeekday: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  calendarNumber: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  calendarTextSelected: {
    color: '#FFFFFF',
  },
  dateRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  streakRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  streakText: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.green,
    fontSize: 14,
    fontWeight: '900',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  calendarToggle: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 40,
    paddingHorizontal: spacing.md,
  },
  calendarToggleText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  dateInput: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    height: 44,
    maxWidth: 180,
    paddingHorizontal: spacing.md,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  center: {
    padding: spacing.xxl,
  },
  content: {
    gap: spacing.xl,
    padding: spacing.lg,
  },
  empty: {
    color: colors.muted,
    fontSize: 16,
  },
  sleepCard: {
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  sleepTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '900',
  },
  sleepRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  sleepField: {
    flex: 1,
    gap: spacing.sm,
    minWidth: 160,
  },
  sleepInput: {
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  inputLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  progressButton: {
    alignItems: 'center',
    backgroundColor: colors.blue,
    borderRadius: 8,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  completeButton: {
    alignItems: 'center',
    backgroundColor: colors.green,
    borderRadius: 8,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  saveText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  message: {
    color: colors.muted,
    fontSize: 14,
  },
});
