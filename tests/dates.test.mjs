import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addDaysIso,
  calculateReviewStreak,
  isIsoDate,
  normalizeReviewDate,
} from '../src/utils/dates.ts';

test('validates calendar dates strictly', () => {
  assert.equal(isIsoDate('2028-02-29'), true);
  assert.equal(isIsoDate('2027-02-29'), false);
  assert.equal(isIsoDate('2026-2-03'), false);
  assert.equal(isIsoDate('not-a-date'), false);
});

test('normalizes review dates without allowing future reviews', () => {
  assert.equal(normalizeReviewDate('2026-09-20', '2026-09-28'), '2026-09-20');
  assert.equal(normalizeReviewDate('2026-10-01', '2026-09-28'), '2026-09-28');
  assert.equal(normalizeReviewDate('2026-09-31', '2026-09-28'), null);
});

test('keeps the streak through yesterday when today is incomplete', () => {
  const completed = ['2026-09-25', '2026-09-26', '2026-09-27'];
  assert.equal(calculateReviewStreak(completed, '2026-09-28'), 3);
});

test('includes today when complete and ends when yesterday is missed', () => {
  assert.equal(calculateReviewStreak(['2026-09-27', '2026-09-28'], '2026-09-28'), 2);
  assert.equal(calculateReviewStreak(['2026-09-26'], '2026-09-28'), 0);
});

test('does not cap long streaks at one year', () => {
  const today = '2026-09-28';
  const completed = Array.from({ length: 400 }, (_, index) => addDaysIso(today, -index));
  assert.equal(calculateReviewStreak(completed, today), 400);
});
