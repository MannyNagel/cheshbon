import type { NightlyReviewItem } from '@/src/models/types';

export type OverviewGroup = {
  domainId: string;
  title: string;
  items: NightlyReviewItem[];
  sortOrder: number;
};

export function groupOverviewItems(items: NightlyReviewItem[]): OverviewGroup[] {
  const groups = new Map<string, OverviewGroup>();
  for (const item of items) {
    const group = groups.get(item.domainId) ?? {
      domainId: item.domainId,
      title: item.domainName,
      items: [],
      sortOrder: item.domainSortOrder,
    };
    group.items.push(item);
    group.sortOrder = Math.min(group.sortOrder, item.domainSortOrder);
    groups.set(item.domainId, group);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => a.sortOrder - b.sortOrder || a.displayName.localeCompare(b.displayName)),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
}
