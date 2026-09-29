import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { _test } = require('../api/google-drive.js');

test('formats a cloud snapshot as an analysis-ready review history', () => {
  const markdown = _test.buildReadableCloudExport({
    exportedAt: '2026-09-28T12:00:00.000Z',
    tables: {
      domains: [{ id: 'domain_1', name: 'Health', active: 1 }, { id: 'domain_2', name: 'Middos', active: 1 }],
      practices: [
        { id: 'practice_parent', domain_id: 'domain_1', name: 'Morning start', active: 1 },
        { id: 'practice_1', domain_id: 'domain_1', parent_practice_id: 'practice_parent', name: 'Exercise', active: 1, weekly_target: 3 },
      ],
      metrics: [{ id: 'metric_1', practice_id: 'practice_1', domain_id: 'domain_2', is_primary: 1, name: 'Completed', metric_type: 'boolean', active: 1 }],
      daily_review_sessions: [{ id: 'session_1', review_date: '2026-09-27', completed_at: '2026-09-28T10:00:00Z' }],
      reset_events: [{
        id: 'reset_1',
        reset_date: '2026-09-27',
        initiated_at: '2026-09-27T18:07:00.000Z',
        trigger: 'Unstructured time',
        what_matters_next: 'Learning',
        first_action: 'Open Gemara',
        outcome: 'worked',
      }],
      daily_entries: [{ id: 'entry_1', practice_id: 'practice_1', entry_date: '2026-09-27', note: 'Morning walk' }],
      entry_metric_values: [{ entry_id: 'entry_1', metric_id: 'metric_1', value_boolean: 1 }],
    },
  });

  assert.match(markdown, /## Review History/);
  assert.match(markdown, /### 2026-09-27/);
  assert.match(markdown, /Exercise; sub-practice of: Morning start; domain: Health; Completed \[Middos\]: yes; note: Morning walk/);
  assert.match(markdown, /sub-practice of: Morning start/);
  assert.match(markdown, /Completed \[Middos\]: yes/);
  assert.match(markdown, /Resets:/);
  assert.match(markdown, /trigger: Unstructured time; what mattered next: Learning; first action: Open Gemara; outcome: worked/);
  assert.doesNotMatch(markdown, /session_1|entry_1|metric_1/);
});

test('includes a reset-only day in review history', () => {
  const markdown = _test.buildReadableCloudExport({
    tables: {
      reset_events: [{
        id: 'reset_only',
        reset_date: '2026-09-28',
        initiated_at: '2026-09-28T14:00:00.000Z',
        trigger: 'Tired',
        what_matters_next: 'Take a walk',
      }],
    },
  });

  assert.match(markdown, /### 2026-09-28/);
  assert.match(markdown, /Review: incomplete/);
  assert.match(markdown, /trigger: Tired; what mattered next: Take a walk; outcome: not reviewed yet/);
});

test('removes control characters rejected by Google Docs', () => {
  assert.equal(_test.sanitizeDocumentText('A\u0000B\u0007C'), 'ABC\n');
});

test('includes Avodah experiments and evidence without turning them into scores', () => {
  const markdown = _test.buildReadableCloudExport({
    tables: {
      avodah_experiments: [{
        id: 'avodah_1', experiment_type: 'middah', title: 'Patience in interruptions',
        status: 'active', start_date: '2026-09-20', review_date: '2026-10-04',
        goal: 'Respond calmly', behavior: 'Pause before answering', hypothesis: 'A pause creates choice',
      }],
      avodah_daily_entries: [{
        experiment_id: 'avodah_1', review_date: '2026-09-27', opportunity: 1,
        response: 'did_well', reflection: 'Paused and listened first',
      }],
      avodah_weekly_reviews: [{ experiment_id: 'avodah_1', week_start_date: '2026-09-26', learning: 'The pause helped', decision: 'continue' }],
    },
  });

  assert.match(markdown, /## Avodah Experiments/);
  assert.match(markdown, /Patience in interruptions \(middah\)/);
  assert.match(markdown, /Behavior: Pause before answering/);
  assert.match(markdown, /response did well; reflection: Paused and listened first/);
  assert.match(markdown, /Week of 2026-09-26: The pause helped; decision continue/);
  assert.doesNotMatch(markdown, /avodah_1/);
});
