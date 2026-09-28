import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isDiasporaYomTovDateFallback,
  isFullDiasporaYomTovHebrewDate,
  isFullDiasporaYomTovTitle,
} from '../src/services/jewishCalendarService.ts';

test('recognizes one-day and two-day diaspora Yom Tov dates', () => {
  assert.equal(isDiasporaYomTovDateFallback('2026-09-21'), true); // Yom Kippur
  assert.equal(isDiasporaYomTovDateFallback('2026-09-26'), true); // Sukkot I
  assert.equal(isDiasporaYomTovDateFallback('2026-09-27'), true); // Sukkot II
  assert.equal(isDiasporaYomTovDateFallback('2026-10-03'), true); // Shmini Atzeret
  assert.equal(isDiasporaYomTovDateFallback('2026-10-04'), true); // Simchat Torah
});

test('does not treat Chol Hamoed as a Shabbos-schedule day', () => {
  assert.equal(isDiasporaYomTovDateFallback('2026-09-28'), false);
  assert.equal(isFullDiasporaYomTovHebrewDate('Tishri', 17), false);
  assert.equal(isFullDiasporaYomTovTitle('Sukkot III (CH’’M)'), false);
});

test('filters Hebcal titles to full Yom Tov only', () => {
  assert.equal(isFullDiasporaYomTovTitle('Pesach VIII'), true);
  assert.equal(isFullDiasporaYomTovTitle('Shavuot II'), true);
  assert.equal(isFullDiasporaYomTovTitle('Erev Pesach'), false);
  assert.equal(isFullDiasporaYomTovTitle('Chanukah: 1 Candle'), false);
});
