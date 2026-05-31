import { StyleSheet, Text, View } from 'react-native';

import { PracticeEntryCard } from '@/src/components/PracticeEntryCard';
import { colors, spacing } from '@/src/components/ui';
import type { Blocker, EntryDraft, NightlyReviewSection as NightlySection } from '@/src/models/types';

type Props = {
  section: NightlySection;
  blockers: Blocker[];
  entries: Record<string, EntryDraft>;
  onEntryChange: (entry: EntryDraft) => void;
};

export function ReviewSection({ section, blockers, entries, onEntryChange }: Props) {
  const groups = section.id === 'section_overall' ? groupOverviewItems(section.items) : [{ title: null, items: section.items }];

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>{section.name}</Text>
        {section.description ? <Text style={styles.description}>{section.description}</Text> : null}
      </View>
      <View style={styles.list}>
        {groups.map((group) => (
          <View key={group.title ?? section.id} style={styles.group}>
            {group.title ? <Text style={styles.groupTitle}>{group.title}</Text> : null}
            {group.items.map((item) => (
              <PracticeEntryCard
                blockers={blockers}
                draft={entries[item.practiceId]}
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

function groupOverviewItems(items: NightlySection['items']) {
  const groups = [
    { title: 'Health', rank: 1, items: [] as NightlySection['items'] },
    { title: 'Spiritual', rank: 2, items: [] as NightlySection['items'] },
    { title: 'Middos', rank: 3, items: [] as NightlySection['items'] },
    { title: 'Other', rank: 4, items: [] as NightlySection['items'] },
  ];
  for (const item of items) {
    groups[overviewGroupIndex(item.domainId, item.practiceName)].items.push(item);
  }
  return groups
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => overviewItemRank(a) - overviewItemRank(b) || a.sortOrder - b.sortOrder),
    }))
    .filter((group) => group.items.length > 0);
}

function overviewGroupIndex(domainId: string, practiceName: string) {
  const name = practiceName.toLowerCase();
  if (domainId === 'domain_health' || name.includes('phone') || name.includes('computer')) return 0;
  if (domainId === 'domain_tefillah_brachot') return 1;
  if (domainId === 'domain_middos') return 2;
  return 3;
}

function overviewItemRank(item: NightlySection['items'][number]) {
  const name = item.practiceName.toLowerCase();
  if (name.includes('eating')) return 10;
  if (name.includes('phone') || name.includes('computer')) return 20;
  if (name.includes('brachot')) return 110;
  if (name.includes('positivity')) return 210;
  if (name.includes('complimentary')) return 220;
  if (name.includes('gratitude')) return 230;
  return item.sortOrder;
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
    color: colors.green,
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
});
