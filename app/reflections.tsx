import { ArrowLeft, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/src/components/ui';
import { getJournalEntries, type JournalEntry } from '@/src/repositories/cheshbonRepo';
import { addDaysIso, dayOfMonth, monthDay, todayIsoDate } from '@/src/utils/dates';

export default function ReflectionsScreen() {
  const today = todayIsoDate();
  const [monthCursor, setMonthCursor] = useState(() => firstOfMonth(today));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [monthEntries, setMonthEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const calendarDates = useMemo(() => getMonthDates(monthCursor), [monthCursor]);
  const reflectionDates = useMemo(() => new Set(monthEntries.map((entry) => entry.date)), [monthEntries]);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const monthDates = getMonthDates(monthCursor);
      const [nextEntries, nextMonthEntries] = await Promise.all([
        getJournalEntries('reflections', selectedDate ? { date: selectedDate, limit: 100 } : { limit: 300 }),
        getJournalEntries('reflections', {
          startDate: monthDates[0],
          endDate: monthDates[monthDates.length - 1],
          limit: 500,
        }),
      ]);
      setEntries(nextEntries);
      setMonthEntries(nextMonthEntries);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load reflections.');
    } finally {
      setLoading(false);
    }
  }, [monthCursor, selectedDate]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const changeMonth = (delta: number) => {
    setMonthCursor(shiftMonth(monthCursor, delta));
    setSelectedDate(null);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.backButton}>
        <ArrowLeft color={colors.ink} size={18} />
        <Text style={styles.buttonText}>Back home</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.eyebrow}>Journal</Text>
        <Text style={styles.title}>Reflections</Text>
        <Text style={styles.subtitle}>Return to a particular day, or read through your reflections over time.</Text>
      </View>

      <View style={styles.calendarPanel}>
        <View style={styles.monthHeader}>
          <Pressable accessibilityLabel="Previous month" accessibilityRole="button" onPress={() => changeMonth(-1)} style={styles.iconButton}>
            <ChevronLeft color={colors.ink} size={20} />
          </Pressable>
          <Text style={styles.monthTitle}>{formatMonth(monthCursor)}</Text>
          <Pressable
            accessibilityLabel="Next month"
            accessibilityRole="button"
            disabled={monthCursor >= firstOfMonth(today)}
            onPress={() => changeMonth(1)}
            style={[styles.iconButton, monthCursor >= firstOfMonth(today) && styles.disabled]}
          >
            <ChevronRight color={colors.ink} size={20} />
          </Pressable>
        </View>

        <View style={styles.weekdayRow}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <Text key={`${day}-${index}`} style={styles.weekday}>{day}</Text>)}
        </View>
        <View style={styles.calendarGrid}>
          {calendarDates.map((date) => {
            const outsideMonth = date.slice(0, 7) !== monthCursor.slice(0, 7);
            const future = date > today;
            const selected = date === selectedDate;
            const hasReflection = reflectionDates.has(date);
            return (
              <View key={date} style={styles.dayCell}>
                <Pressable
                  accessibilityLabel={`${formatFullDate(date)}${hasReflection ? ', has reflection' : ''}`}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: future, selected }}
                  disabled={future}
                  onPress={() => setSelectedDate(date)}
                  style={[
                    styles.dayButton,
                    outsideMonth && styles.outsideMonth,
                    hasReflection && styles.dayWithReflection,
                    selected && styles.selectedDay,
                    future && styles.disabled,
                  ]}
                >
                  <Text style={[styles.dayNumber, selected && styles.selectedDayText]}>{dayOfMonth(date)}</Text>
                  {hasReflection ? <View style={[styles.entryDot, selected && styles.selectedDot]} /> : null}
                </Pressable>
              </View>
            );
          })}
        </View>
        <View style={styles.calendarFooter}>
          <Text style={styles.calendarHint}>Marked dates contain a reflection.</Text>
          {selectedDate ? (
            <Pressable accessibilityRole="button" onPress={() => setSelectedDate(null)} style={styles.showAllButton}>
              <X color={colors.ink} size={16} />
              <Text style={styles.buttonText}>Show all</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.resultsHeader}>
        <Text style={styles.resultsTitle}>{selectedDate ? formatFullDate(selectedDate) : 'All reflections'}</Text>
        {selectedDate ? <Text style={styles.resultsSubtitle}>Reflection recorded for this day</Text> : null}
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.blue} /></View>
      ) : entries.length ? (
        <View style={styles.list}>
          {entries.map((entry) => (
            <View key={`${entry.date}-${entry.practiceName}-${entry.text}`} style={styles.item}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemDate}>{monthDay(entry.date)}</Text>
                <Text style={styles.practiceName}>{entry.practiceName}</Text>
              </View>
              <Text style={styles.itemText}>{entry.text}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>{selectedDate ? 'No reflection was recorded for this day.' : 'No reflections yet.'}</Text>
      )}
    </ScrollView>
  );
}

function firstOfMonth(date: string) {
  return `${date.slice(0, 7)}-01`;
}

function shiftMonth(date: string, delta: number) {
  const [year, month] = date.split('-').map(Number);
  const shifted = new Date(year, month - 1 + delta, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}-01`;
}

function getMonthDates(monthCursor: string) {
  const [year, month] = monthCursor.split('-').map(Number);
  const first = new Date(year, month - 1, 1);
  const count = new Date(year, month, 0).getDate();
  const start = addDaysIso(monthCursor, -first.getDay());
  const total = Math.ceil((first.getDay() + count) / 7) * 7;
  return Array.from({ length: total }, (_, index) => addDaysIso(start, index));
}

function formatMonth(date: string) {
  const [year, month] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

function formatFullDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(year, month - 1, day));
}

const styles = StyleSheet.create({
  backButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 42, paddingHorizontal: spacing.md },
  buttonText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  calendarFooter: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'space-between' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', maxWidth: 430, width: '100%' },
  calendarHint: { color: colors.muted, flex: 1, fontSize: 12, minWidth: 180 },
  calendarPanel: { alignItems: 'flex-start', backgroundColor: colors.surface, borderColor: colors.softLine, borderRadius: 8, borderWidth: 1, gap: spacing.md, padding: spacing.lg },
  center: { alignItems: 'center', padding: spacing.xxl },
  container: { backgroundColor: colors.paper, gap: spacing.lg, padding: spacing.lg, paddingBottom: 96 },
  dayButton: { alignItems: 'center', aspectRatio: 1, borderColor: 'transparent', borderRadius: 8, borderWidth: 1, justifyContent: 'center', width: '100%' },
  dayCell: { padding: 2, width: '14.2857%' },
  dayNumber: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  dayWithReflection: { backgroundColor: colors.greenSoft, borderColor: colors.green },
  disabled: { opacity: 0.3 },
  emptyText: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'left' },
  entryDot: { backgroundColor: colors.green, borderRadius: 3, bottom: 5, height: 5, position: 'absolute', width: 5 },
  eyebrow: { color: colors.green, fontSize: 13, fontWeight: '900', textTransform: 'uppercase' },
  header: { gap: spacing.xs },
  iconButton: { alignItems: 'center', backgroundColor: colors.paper, borderColor: colors.line, borderRadius: 8, borderWidth: 1, height: 40, justifyContent: 'center', width: 40 },
  item: { borderTopColor: colors.softLine, borderTopWidth: 1, gap: spacing.xs, paddingVertical: spacing.md },
  itemDate: { color: colors.green, fontSize: 13, fontWeight: '900', minWidth: 72 },
  itemHeader: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  itemText: { color: colors.ink, fontSize: 15, lineHeight: 22, textAlign: 'left' },
  list: { backgroundColor: colors.surface, borderColor: colors.softLine, borderRadius: 8, borderWidth: 1, paddingHorizontal: spacing.lg },
  message: { color: colors.rose, fontSize: 14, fontWeight: '800' },
  monthHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', maxWidth: 430, width: '100%' },
  monthTitle: { color: colors.ink, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  outsideMonth: { opacity: 0.35 },
  practiceName: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  resultsHeader: { gap: spacing.xs },
  resultsSubtitle: { color: colors.muted, fontSize: 13 },
  resultsTitle: { color: colors.ink, fontSize: 21, fontWeight: '900' },
  selectedDay: { backgroundColor: colors.blue, borderColor: colors.blue },
  selectedDayText: { color: '#FFFFFF' },
  selectedDot: { backgroundColor: '#FFFFFF' },
  showAllButton: { alignItems: 'center', backgroundColor: colors.paper, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: spacing.xs, minHeight: 38, paddingHorizontal: spacing.md },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 23, maxWidth: 620 },
  title: { color: colors.ink, fontSize: 32, fontWeight: '900' },
  weekday: { color: colors.muted, fontSize: 11, fontWeight: '900', textAlign: 'center', width: '14.2857%' },
  weekdayRow: { flexDirection: 'row', maxWidth: 430, width: '100%' },
});
