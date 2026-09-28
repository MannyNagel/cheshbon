import assert from 'node:assert/strict';
import test from 'node:test';

import { mergeCloudSnapshots } from '../src/services/cloudSnapshotMerge.ts';

function snapshot(tables) {
  return { exportedAt: '2026-09-28T12:00:00.000Z', tables };
}

test('keeps a completed review complete when a newer copy lacks completion', () => {
  const cloud = snapshot({
    daily_review_sessions: [{
      id: 'cloud-session',
      user_id: 'local',
      review_date: '2026-09-27',
      completed_at: '2026-09-28T01:00:00.000Z',
      updated_at: '2026-09-28T01:00:00.000Z',
    }],
  });
  const local = snapshot({
    daily_review_sessions: [{
      id: 'local-session',
      user_id: 'local',
      review_date: '2026-09-27',
      completed_at: null,
      updated_at: '2026-09-28T02:00:00.000Z',
    }],
  });

  const merged = mergeCloudSnapshots(local, cloud);
  assert.equal(merged.tables.daily_review_sessions.length, 1);
  assert.equal(merged.tables.daily_review_sessions[0].id, 'local-session');
  assert.equal(merged.tables.daily_review_sessions[0].completed_at, '2026-09-28T01:00:00.000Z');
});

test('keeps a disabled blocker tombstone from a newer local entry', () => {
  const cloud = snapshot({
    daily_review_sessions: [{ id: 'cloud-session', user_id: 'local', review_date: '2026-09-27', updated_at: '2026-09-28T01:00:00.000Z' }],
    daily_entries: [{ id: 'cloud-entry', user_id: 'local', practice_id: 'practice-1', entry_date: '2026-09-27', review_session_id: 'cloud-session', updated_at: '2026-09-28T01:00:00.000Z' }],
    entry_blockers: [{ entry_id: 'cloud-entry', blocker_id: 'blocker-1', enabled: 1 }],
  });
  const local = snapshot({
    daily_review_sessions: [{ id: 'local-session', user_id: 'local', review_date: '2026-09-27', updated_at: '2026-09-28T02:00:00.000Z' }],
    daily_entries: [{ id: 'local-entry', user_id: 'local', practice_id: 'practice-1', entry_date: '2026-09-27', review_session_id: 'local-session', updated_at: '2026-09-28T02:00:00.000Z' }],
    entry_blockers: [{ entry_id: 'local-entry', blocker_id: 'blocker-1', enabled: 0 }],
  });

  const merged = mergeCloudSnapshots(local, cloud);
  assert.deepEqual(merged.tables.entry_blockers, [{ entry_id: 'local-entry', blocker_id: 'blocker-1', enabled: 0 }]);
});

test('keeps a newer soft-deleted routine deleted', () => {
  const cloud = snapshot({
    routine_templates: [{ id: 'routine-1', active: 1, deleted_at: null, updated_at: '2026-09-28T01:00:00.000Z' }],
  });
  const local = snapshot({
    routine_templates: [{ id: 'routine-1', active: 0, deleted_at: '2026-09-28T02:00:00.000Z', updated_at: '2026-09-28T02:00:00.000Z' }],
  });

  const merged = mergeCloudSnapshots(local, cloud);
  assert.equal(merged.tables.routine_templates[0].active, 0);
  assert.equal(merged.tables.routine_templates[0].deleted_at, '2026-09-28T02:00:00.000Z');
});
