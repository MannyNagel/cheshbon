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

test('keeps a newer removed sub-practice choice inactive', () => {
  const cloud = snapshot({
    metric_options: [{
      id: 'option-1',
      metric_id: 'metric-1',
      label: 'Late',
      value: 'late',
      active: 1,
      updated_at: '2026-09-28T01:00:00.000Z',
    }],
  });
  const local = snapshot({
    metric_options: [{
      id: 'option-1',
      metric_id: 'metric-1',
      label: 'Late',
      value: 'late',
      active: 0,
      updated_at: '2026-09-28T02:00:00.000Z',
    }],
  });

  const merged = mergeCloudSnapshots(local, cloud);
  assert.equal(merged.tables.metric_options[0].active, 0);
});

test('keeps a practice identity and history when it is moved under a parent', () => {
  const cloud = snapshot({
    practices: [{
      id: 'practice-modeh-ani',
      name: 'Modeh Ani',
      parent_practice_id: null,
      updated_at: '2026-09-28T01:00:00.000Z',
    }],
    daily_entries: [{
      id: 'entry-before-move',
      user_id: 'local',
      practice_id: 'practice-modeh-ani',
      entry_date: '2026-09-27',
      updated_at: '2026-09-28T01:00:00.000Z',
    }],
  });
  const local = snapshot({
    practices: [{
      id: 'practice-modeh-ani',
      name: 'Modeh Ani',
      parent_practice_id: 'practice-wake-lion',
      parent_sort_order: 30,
      updated_at: '2026-09-28T02:00:00.000Z',
    }],
    daily_entries: [{
      id: 'entry-before-move',
      user_id: 'local',
      practice_id: 'practice-modeh-ani',
      entry_date: '2026-09-27',
      updated_at: '2026-09-28T01:00:00.000Z',
    }],
  });

  const merged = mergeCloudSnapshots(local, cloud);
  assert.equal(merged.tables.practices[0].id, 'practice-modeh-ani');
  assert.equal(merged.tables.practices[0].parent_practice_id, 'practice-wake-lion');
  assert.equal(merged.tables.daily_entries[0].practice_id, 'practice-modeh-ani');
});

test('keeps a reset and its newer nightly outcome during cloud merge', () => {
  const cloud = snapshot({
    reset_events: [{
      id: 'reset-1',
      user_id: 'local',
      reset_date: '2026-09-28',
      initiated_at: '2026-09-28T18:07:00.000Z',
      trigger: 'Unstructured time',
      what_matters_next: 'Learning',
      outcome: null,
      updated_at: '2026-09-28T18:07:00.000Z',
    }],
  });
  const local = snapshot({
    reset_events: [{
      id: 'reset-1',
      user_id: 'local',
      reset_date: '2026-09-28',
      initiated_at: '2026-09-28T18:07:00.000Z',
      trigger: 'Unstructured time',
      what_matters_next: 'Learning',
      outcome: 'worked',
      outcome_reflection: 'I put the phone away and began learning.',
      reviewed_at: '2026-09-29T01:00:00.000Z',
      updated_at: '2026-09-29T01:00:00.000Z',
    }],
  });

  const merged = mergeCloudSnapshots(local, cloud);
  assert.equal(merged.tables.reset_events.length, 1);
  assert.equal(merged.tables.reset_events[0].outcome, 'worked');
  assert.equal(merged.tables.reset_events[0].outcome_reflection, 'I put the phone away and began learning.');
  assert.equal(merged.tables.reset_events[0].reviewed_at, '2026-09-29T01:00:00.000Z');
});

test('keeps Avodah evidence and modification lineage during cloud merge', () => {
  const cloud = snapshot({
    avodah_experiments: [{
      id: 'avodah-1', user_id: 'local', title: 'Focused learning', status: 'active',
      updated_at: '2026-09-27T22:00:00.000Z',
    }],
    avodah_daily_entries: [{
      id: 'cloud-evidence', user_id: 'local', experiment_id: 'avodah-1', review_date: '2026-09-27',
      opportunity: 1, response: 'mixed', reflection: 'Started late', updated_at: '2026-09-27T23:00:00.000Z',
    }],
  });
  const local = snapshot({
    avodah_experiments: [
      { id: 'avodah-1', user_id: 'local', title: 'Focused learning', status: 'modified', updated_at: '2026-09-28T12:00:00.000Z' },
      { id: 'avodah-2', user_id: 'local', title: 'Focused learning earlier', status: 'draft', parent_experiment_id: 'avodah-1', updated_at: '2026-09-28T12:00:00.000Z' },
    ],
    avodah_daily_entries: [{
      id: 'local-evidence', user_id: 'local', experiment_id: 'avodah-1', review_date: '2026-09-27',
      opportunity: 1, response: 'did_well', reflection: 'Recovered and learned', updated_at: '2026-09-28T01:00:00.000Z',
    }],
  });

  const merged = mergeCloudSnapshots(local, cloud);
  assert.equal(merged.tables.avodah_experiments.length, 2);
  assert.equal(merged.tables.avodah_experiments.find((row) => row.id === 'avodah-1').status, 'modified');
  assert.equal(merged.tables.avodah_experiments.find((row) => row.id === 'avodah-2').parent_experiment_id, 'avodah-1');
  assert.equal(merged.tables.avodah_daily_entries.length, 1);
  assert.equal(merged.tables.avodah_daily_entries[0].response, 'did_well');
  assert.equal(merged.tables.avodah_daily_entries[0].reflection, 'Recovered and learned');
});
