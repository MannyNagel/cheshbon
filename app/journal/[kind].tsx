import { ArrowLeft, CalendarDays, Search, X } from 'lucide-react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, spacing } from '@/src/components/ui';
import { getJournalEntries, type JournalEntry, type JournalKind } from '@/src/repositories/cheshbonRepo';
import { monthDay } from '@/src/utils/dates';

export default function JournalArchiveScreen() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind: JournalKind = params.kind === 'thoughts' ? 'thoughts' : 'gratitude';
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [dateInput, setDateInput] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      setEntries(await getJournalEntries(kind, { date: selectedDate ?? undefined, limit: 300 }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load journal.');
    } finally {
      setLoading(false);
    }
  }, [kind, selectedDate]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const title = kind === 'gratitude' ? 'Gratitude Journal' : 'Thought Journal';
  const emptyText = selectedDate ? 'No entries found for that day.' : 'No journal entries yet.';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.backButton}>
        <ArrowLeft color={colors.ink} size={18} />
        <Text style={styles.backText}>Back home</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.eyebrow}>Journal</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>
          {selectedDate ? `Showing ${selectedDate}` : 'All previous entries'}
        </Text>
      </View>

      <View style={styles.filterBox}>
        <View style={styles.dateRow}>
          <CalendarDays color={colors.muted} size={18} />
          <TextInput
            onChangeText={setDateInput}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.muted}
            style={styles.dateInput}
            value={dateInput}
          />
        </View>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={() => setSelectedDate(dateInput.trim() || null)} style={styles.actionButton}>
            <Search color={colors.ink} size={17} />
            <Text style={styles.actionText}>Open day</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setDateInput('');
              setSelectedDate(null);
            }}
            style={styles.actionButton}
          >
            <X color={colors.ink} size={17} />
            <Text style={styles.actionText}>Show all</Text>
          </Pressable>
        </View>
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.blue} />
        </View>
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
        <Text style={styles.emptyText}>{emptyText}</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  actionText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  backButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  backText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  center: {
    alignItems: 'center',
    padding: spacing.xxl,
  },
  container: {
    backgroundColor: colors.paper,
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: 96,
  },
  dateInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    minHeight: 42,
    minWidth: 160,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  dateRow: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
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
    textTransform: 'uppercase',
  },
  filterBox: {
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  item: {
    borderTopColor: colors.softLine,
    borderTopWidth: 1,
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  itemDate: {
    color: colors.green,
    fontSize: 13,
    fontWeight: '900',
    minWidth: 72,
  },
  itemHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  itemText: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'left',
  },
  list: {
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
  },
  message: {
    color: colors.rose,
    fontSize: 14,
    fontWeight: '800',
  },
  practiceName: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 22,
  },
  title: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: '900',
  },
});
