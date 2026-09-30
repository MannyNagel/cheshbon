import assert from 'node:assert/strict';
import test from 'node:test';

import { groupOverviewItems } from '../src/utils/overviewGroups.ts';

function item(overrides) {
  return {
    practiceId: overrides.practiceId,
    displayName: overrides.displayName,
    domainId: overrides.domainId,
    domainName: overrides.domainName,
    domainSortOrder: overrides.domainSortOrder,
    sortOrder: overrides.sortOrder,
  };
}

test('keeps overview domains separate and follows the saved section order', () => {
  const groups = groupOverviewItems([
    item({ practiceId: 'reflection', displayName: 'Daily reflection', domainId: 'reflection', domainName: 'Reflection', domainSortOrder: 2, sortOrder: 10 }),
    item({ practiceId: 'phone', displayName: 'Phone use', domainId: 'technology', domainName: 'Technology', domainSortOrder: 1, sortOrder: 10 }),
    item({ practiceId: 'eating', displayName: 'Eating', domainId: 'health', domainName: 'Health', domainSortOrder: 0, sortOrder: 20 }),
    item({ practiceId: 'exercise', displayName: 'Exercise', domainId: 'health', domainName: 'Health', domainSortOrder: 0, sortOrder: 10 }),
  ]);

  assert.deepEqual(groups.map((group) => group.title), ['Health', 'Technology', 'Reflection']);
  assert.deepEqual(groups[0].items.map((practice) => practice.displayName), ['Exercise', 'Eating']);
});
