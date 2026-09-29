import { RotateCcw } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, spacing } from '@/src/components/ui';
import type { ResetEvent, ResetOutcome } from '@/src/models/types';

const outcomes: Array<{ value: ResetOutcome; label: string }> = [
  { value: 'worked', label: 'Worked' },
  { value: 'partially', label: 'Partially' },
  { value: 'did_not_work', label: "Didn't work" },
];

export function ResetReviewSection({ resets, onChange }: { resets: ResetEvent[]; onChange: (reset: ResetEvent) => void }) {
  if (!resets.length) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <RotateCcw color={colors.green} size={20} />
        <View style={styles.sectionHeaderText}>
          <Text style={styles.sectionTitle}>{resets.length === 1 ? 'Reset today' : 'Resets today'}</Text>
          <Text style={styles.sectionCopy}>These are markers of recovery, not another score.</Text>
        </View>
      </View>
      <View style={styles.list}>
        {resets.map((reset) => (
          <View key={reset.id} style={styles.card}>
            <Text style={styles.time}>Reset at {formatTime(reset.initiatedAt)}</Text>
            <Text style={styles.summary}>
              {reset.triggerDetail || reset.trigger} <Text style={styles.arrow}>→</Text> {reset.whatMattersNext}
            </Text>
            {reset.firstAction ? <Text style={styles.firstAction}>First action: {reset.firstAction}</Text> : null}
            <Text style={styles.question}>Did you get back on track?</Text>
            <View style={styles.outcomeRow}>
              {outcomes.map((outcome) => {
                const selected = reset.outcome === outcome.value;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={outcome.value}
                    onPress={() => onChange({ ...reset, outcome: selected ? null : outcome.value })}
                    style={[styles.outcomeButton, selected && styles.outcomeButtonSelected]}
                  >
                    <Text style={[styles.outcomeText, selected && styles.outcomeTextSelected]}>{outcome.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.reflectionLabel}>How did the reset go?</Text>
            <TextInput
              multiline
              value={reset.outcomeReflection ?? ''}
              onChangeText={(outcomeReflection) => onChange({ ...reset, outcomeReflection })}
              placeholder="What helped, or what got in the way?"
              placeholderTextColor={colors.muted}
              style={styles.reflectionInput}
              textAlign="left"
            />
          </View>
        ))}
      </View>
    </View>
  );
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const styles = StyleSheet.create({
  arrow: {
    color: colors.green,
    fontWeight: '900',
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.softLine,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  firstAction: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  list: {
    gap: spacing.md,
  },
  outcomeButton: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: 42,
    minWidth: 100,
    paddingHorizontal: spacing.md,
  },
  outcomeButtonSelected: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  outcomeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  outcomeText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  outcomeTextSelected: {
    color: colors.green,
    fontWeight: '900',
  },
  question: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  reflectionInput: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    lineHeight: 21,
    minHeight: 76,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    textAlignVertical: 'top',
  },
  reflectionLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  section: {
    gap: spacing.md,
  },
  sectionCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sectionHeaderText: {
    flex: 1,
    gap: spacing.xs,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '900',
  },
  summary: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 23,
  },
  time: {
    color: colors.green,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
});
