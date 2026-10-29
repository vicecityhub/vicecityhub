import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PAGE, MAX_BYTES, mimeOf, checkPickedFile, titleFromFileName, titleError, storagePaths, uploadFailureMessage, isHttpOk,
  insertFailureMessage, platformLabel, ago, pageRange, hasMorePages, mergePage, toggledSet, withLikeDelta, withoutItem,
  isReportAccepted, codeDeadline, pollStatusOutcome, isCodeComplete, requestAge,
} from '../src/lib/highlights.ts';

const hl = (id, likes = 0) => ({ id, likes, title: `t${id}` });

test('mimeOf: trusts the browser, falls back to the extension, else empty', () => {
  assert.equal(mimeOf({ type: 'video/webm', name: 'a.mp4' }), 'video/webm');
  assert.equal(mimeOf({ type: '', name: 'Clip.WEBM' }), 'video/webm');
  assert.equal(mimeOf({ type: '', name: 'a.jpeg' }), 'image/jpeg');
  assert.equal(mimeOf({ type: '', name: 'a.mov' }), 'video/quicktime');
  assert.equal(mimeOf({ type: '', name: 'a.exe' }), '');
  assert.equal(mimeOf({ type: '', name: 'noext' }), '');
});

test('checkPickedFile: accepts media, names the problem otherwise', () => {
  assert.equal(checkPickedFile({ type: 'image/png', name: 'a.png', size: 10 }), null);
  assert.equal(checkPickedFile({ type: '', name: 'a.webm', size: MAX_BYTES }), null);
  assert.match(checkPickedFile({ type: 'application/pdf', name: 'a.pdf', size: 10 }), /\(application\/pdf\) is not supported/);
  assert.match(checkPickedFile({ type: '', name: 'a.xyz', size: 10 }), /\(unknown\) is not supported/);
  assert.match(checkPickedFile({ type: 'video/mp4', name: 'a.mp4', size: 60 * 1048576 }), /That file is 60 MB\. The limit is 50 MB/);
});

test('titleFromFileName / titleError', () => {
  assert.equal(titleFromFileName('my_great-clip.final.webm'), 'my great clip.final');
  assert.equal(titleFromFileName('x'.repeat(100) + '.png').length, 60);
  assert.equal(titleError('ab'), 'Give it a title (at least 3 characters). "untitled" is not a personality.');
  assert.equal(titleError('abc'), null);
});

test('storagePaths: poster only when present', () => {
  assert.deepEqual(storagePaths('m', null), ['m']);
  assert.deepEqual(storagePaths('m', 'p'), ['m', 'p']);
});

test('uploadFailureMessage: server message, else generic', () => {
  assert.equal(uploadFailureMessage(413, '{"message":"Payload too large"}'), 'Payload too large');
  assert.equal(uploadFailureMessage(400, '{"message":42}'), '42');
  assert.equal(uploadFailureMessage(500, '<html>oops</html>'), 'upload failed (500)');
  assert.equal(uploadFailureMessage(500, ''), 'upload failed (500)');
  assert.equal(uploadFailureMessage(401, '{"error":"x"}'), 'upload failed (401)');
  assert.equal(uploadFailureMessage(401, 'null'), 'upload failed (401)');
  assert.ok(isHttpOk(200) && isHttpOk(299) && !isHttpOk(199) && !isHttpOk(300));
});

test('insertFailureMessage: daily limit gets the friendly text', () => {
  assert.match(insertFailureMessage('new row violates daily_limit'), /^Daily limit reached: 10 uploads per 24 hours/);
  assert.equal(insertFailureMessage('permission denied'), 'permission denied');
});

test('platformLabel: known label or the raw value', () => {
  assert.equal(platformLabel('ps5'), 'PS5');
  assert.equal(platformLabel('xbox'), 'Xbox');
  assert.equal(platformLabel('weird'), 'weird');
});

test('ago: minutes, hours, days, never below 1m', () => {
  const now = Date.parse('2026-10-29T12:00:00Z');
  const at = (sec) => new Date(now - sec * 1000).toISOString();
  assert.equal(ago(at(0), now), '1m ago');
  assert.equal(ago(at(30), now), '1m ago');
  assert.equal(ago(at(600), now), '10m ago');
  assert.equal(ago(at(3599), now), '60m ago');
  assert.equal(ago(at(3600), now), '1h ago');
  assert.equal(ago(at(7200), now), '2h ago');
  assert.equal(ago(at(86400), now), '1d ago');
  assert.equal(ago(at(200000), now), '2d ago');
});

test('paging: ranges, "has more", reset vs append', () => {
  assert.deepEqual(pageRange(0), [0, PAGE - 1]);
  assert.deepEqual(pageRange(2), [2 * PAGE, 3 * PAGE - 1]);
  assert.equal(hasMorePages(new Array(PAGE).fill(0)), true);
  assert.equal(hasMorePages(new Array(PAGE - 1).fill(0)), false);
  assert.deepEqual(mergePage([hl(1)], [hl(2)], true), [hl(2)]);
  assert.deepEqual(mergePage([hl(1)], [hl(2)], false), [hl(1), hl(2)]);
});

test('likes: set toggling does not mutate, counter never goes negative', () => {
  const s = new Set([1]);
  assert.deepEqual([...toggledSet(s, 2, false)], [1, 2]);
  assert.deepEqual([...toggledSet(s, 1, true)], []);
  assert.deepEqual([...s], [1]);
  const items = [hl(1, 3), hl(2, 0)];
  assert.deepEqual(withLikeDelta(items, 1, false).map((x) => x.likes), [4, 0]);
  assert.deepEqual(withLikeDelta(items, 1, true).map((x) => x.likes), [2, 0]);
  assert.deepEqual(withLikeDelta(items, 2, true).map((x) => x.likes), [3, 0]);
  assert.equal(items[0].likes, 3);
  assert.deepEqual(withoutItem(items, 1), [hl(2, 0)]);
});

test('isReportAccepted: ok or duplicate', () => {
  assert.equal(isReportAccepted(null), true);
  assert.equal(isReportAccepted({ message: 'duplicate key value violates unique constraint' }), true);
  assert.equal(isReportAccepted({ message: 'permission denied' }), false);
});

test('device login helpers', () => {
  assert.equal(codeDeadline(1000, 60), 61000);
  assert.equal(codeDeadline(1000), 601000);
  assert.equal(codeDeadline(1000, 0), 601000);
  assert.equal(pollStatusOutcome(200), 'approved');
  assert.equal(pollStatusOutcome(410), 'expired');
  assert.equal(pollStatusOutcome(202), 'retry');
  assert.equal(pollStatusOutcome(500), 'retry');
  assert.equal(isCodeComplete('ABCD-2345'), true);
  assert.equal(isCodeComplete('abcd2345'), true);
  assert.equal(isCodeComplete('ABCD-234'), false);
  assert.equal(isCodeComplete('ABCD-23456'), false);
  assert.equal(requestAge(45), '45s');
  assert.equal(requestAge(89), '89s');
  assert.equal(requestAge(90), '2 min');
  assert.equal(requestAge(600), '10 min');
});
