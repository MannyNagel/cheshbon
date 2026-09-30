import { StyleSheet, Text, View } from 'react-native';

import { PracticeEntryCard } from '@/src/components/PracticeEntryCard';
import { colors, spacing } from '@/src/components/ui';
import type { EntryDraft, NightlyReviewSection as NightlySection } from '@/src/models/types';
import { groupOverviewItems } from '@/src/utils/overviewGroups';

type Props = {
  section: NightlySection;
  entries: Record<string, EntryDraft>;
  onEntryChange: (entry: EntryDraft) => void;
};

export function ReviewSection({ section, entries, onEntryChange }: Props) {
  const groups = section.id === 'section_overall' ? groupOverviewItems(section.items) : [{ title: null, items: section.items }];

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Foundations</Text>
        <Text style={styles.title}>{section.name}</Text>
        {section.description ? <Text style={styles.description}>{section.description}</Text> : null}
      </View>
      <View style={styles.list}>
        {groups.map((group) => (
          <View key={group.title ?? section.id} style={styles.group}>
            {group.title ? <Text style={styles.groupTitle}>{group.title}</Text> : null}
            {group.items.map((item) => (
              <PracticeEntryCard
                entries={entries}
                item={item}
                key={item.practiceId}
                onChange={onEntryChange}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  header: {
    gap: spacing.xs,
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '900',
  },
  eyebrow: {
    color: '#52677D',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  description: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  list: {
    gap: spacing.md,
  },
  group: {
    gap: spacing.md,
  },
  groupTitle: {
    color: '#52677D',
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
});
