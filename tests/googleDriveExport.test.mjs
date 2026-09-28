import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { _test } = require('../api/google-drive.js');

test('formats a cloud snapshot as an analysis-ready review history', () => {
  const markdown = _test.buildReadableCloudExport({
    exportedAt: '2026-09-28T12:00:00.000Z',
    tables: {
      domains: [{ id: 'domain_1', name: 'Health', active: 1 }],
      practices: [{ id: 'practice_1', domain_id: 'domain_1', name: 'Exercise', active: 1, weekly_target: 3 }],
      metrics: [{ id: 'metric_1', practice_id: 'practice_1', name: 'Completed', metric_type: 'boolean', active: 1 }],
      daily_review_sessions: [{ id: 'session_1', review_date: '2026-09-27', completed_at: '2026-09-28T10:00:00Z' }],
      daily_entries: [{ id: 'entry_1', practice_id: 'practice_1', entry_date: '2026-09-27', note: 'Morning walk' }],
      entry_metric_values: [{ entry_id: 'entry_1', metric_id: 'metric_1', value_boolean: 1 }],
    },
  });

  assert.match(markdown, /## Review History/);
  assert.match(markdown, /### 2026-09-27/);
  assert.match(markdown, /Exercise; domain: Health; Completed: yes; note: Morning walk/);
  assert.doesNotMatch(markdown, /session_1|entry_1|metric_1/);
});

test('removes control characters rejected by Google Docs', () => {
  assert.equal(_test.sanitizeDocumentText('A\u0000B\u0007C'), 'ABC\n');
});
