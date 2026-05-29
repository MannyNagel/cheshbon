import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/src/components/ui';
import type { Blocker } from '@/src/models/types';

type Props = {
  blockers: Blocker[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
};

export function BlockerSelector({ blockers, selectedIds, onChange }: Props) {
  const [expanded, setExpanded] = useState(selectedIds.length > 0);

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((value) => value !== id) : [...selectedIds, id]);
  }

  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" onPress={() => setExpanded((value) => !value)} style={styles.disclosure}>
        <Text style={styles.label}>
          Blockers{selectedIds.length ? ` (${selectedIds.length})` : ''}
        </Text>
        {expanded ? <ChevronUp color={colors.ink} size={18} /> : <ChevronDown color={colors.ink} size={18} />}
      </Pressable>
      {expanded ? (
        <View style={styles.wrap}>
          {blockers.map((blocker) => {
            const selected = selectedIds.includes(blocker.id);
            return (
              <Pressable
                accessibilityRole="button"
                key={blocker.id}
                onPress={() => toggle(blocker.id)}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{blocker.name}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  disclosure: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 40,
    paddingHorizontal: spacing.md,
  },
  label: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderColor: colors.line,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipSelected: {
    backgroundColor: colors.amberSoft,
    borderColor: colors.amber,
  },
  chipText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: colors.ink,
  },
});
