import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSavedRadioTime, shouldAutoplayOnMount, shouldResumeOnVisible } from '../src/lib/radioState.ts';

test('parseSavedRadioTime accepts non-negative finite numbers', () => {
  assert.equal(parseSavedRadioTime('12.5'), 12.5);
  assert.equal(parseSavedRadioTime('0'), 0);
  assert.equal(parseSavedRadioTime('93.000001'), 93.000001);
});

test('parseSavedRadioTime maps missing, garbage, negative and infinite values to 0', () => {
  assert.equal(parseSavedRadioTime(null), 0);
  assert.equal(parseSavedRadioTime(''), 0);
  assert.equal(parseSavedRadioTime('abc'), 0);
  assert.equal(parseSavedRadioTime('-3'), 0);
  assert.equal(parseSavedRadioTime('Infinity'), 0);
});

test('shouldAutoplayOnMount: first visit and an explicit true play; mute (or anything else) stays silent', () => {
  assert.equal(shouldAutoplayOnMount(null), true);
  assert.equal(shouldAutoplayOnMount('true'), true);
  assert.equal(shouldAutoplayOnMount('false'), false);
  assert.equal(shouldAutoplayOnMount('weird'), false);
});

test('shouldResumeOnVisible: only an explicit false keeps the radio paused', () => {
  assert.equal(shouldResumeOnVisible(null), true);
  assert.equal(shouldResumeOnVisible('true'), true);
  assert.equal(shouldResumeOnVisible('weird'), true);
  assert.equal(shouldResumeOnVisible('false'), false);
});
